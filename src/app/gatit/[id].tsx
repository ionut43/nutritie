import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ING } from '../../data/ingredients';
import { RECIPE } from '../../data/recipes';
import { fmtQty } from '../../logic/format';
import { fmtClock, timersInStep } from '../../logic/timers';
import { useStore } from '../../store/useStore';
import { Btn, Card, DISPLAY, Divider, Icon, Row, T, useTheme } from '../../ui/kit';
import { cancelNotification, scheduleTimer } from '../../ui/notify';

interface Running { key: string; label: string; endsAt: number; total: number; notifId?: string; done?: boolean }

/** Mod de gătit: pași mari, ecranul rămâne aprins, cronometre cu notificare */
export default function CookMode() {
  useKeepAwake();
  const t = useTheme();
  const router = useRouter();
  const { id, portions: p0, planId, sessionId } = useLocalSearchParams<{ id: string; portions?: string; planId?: string; sessionId?: string }>();
  const cookSession = useStore((s) => s.cookSession);
  const r = RECIPE[id];
  const portions = Math.max(1, parseInt(p0 ?? '', 10) || r?.servings || 1);
  const [step, setStep] = useState(-1); // -1 = ingrediente
  const [timers, setTimers] = useState<Running[]>([]);
  const [, tick] = useState(0);
  const [checked, setChecked] = useState<string[]>([]);
  const done = useRef<Set<string>>(new Set());

  useEffect(() => {
    const h = setInterval(() => {
      tick((x) => x + 1);
      const now = Date.now();
      setTimers((ts) => ts.map((x) => {
        if (!x.done && x.endsAt <= now && !done.current.has(x.key)) {
          done.current.add(x.key);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          return { ...x, done: true };
        }
        return x;
      }));
    }, 1000);
    return () => clearInterval(h);
  }, []);

  if (!r) return <SafeAreaView><T>Rețeta nu există.</T></SafeAreaView>;
  const k = portions / r.servings;
  const total = r.steps.length;

  const start = async (label: string, seconds: number) => {
    const key = `${step}-${label}-${Date.now()}`;
    const notifId = await scheduleTimer(seconds, `${r.name}: ${label} au trecut (pasul ${step + 1}).`);
    setTimers((ts) => [...ts, { key, label: `Pasul ${step + 1} · ${label}`, endsAt: Date.now() + seconds * 1000, total: seconds, notifId }]);
  };
  const stop = (x: Running) => { cancelNotification(x.notifId); setTimers((ts) => ts.filter((y) => y.key !== x.key)); };
  const finish = () => {
    timers.forEach((x) => cancelNotification(x.notifId));
    if (planId && sessionId) {
      Alert.alert('Gata!', 'Scad ingredientele folosite din cămară?', [
        { text: 'Nu', onPress: () => router.back() },
        { text: 'Da', onPress: () => { cookSession(planId, sessionId); router.back(); } },
      ]);
    } else router.back();
  };

  const stepTimers = step >= 0 ? timersInStep(r.steps[step]) : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
        <Pressable hitSlop={10} onPress={() => (timers.some((x) => !x.done) ? Alert.alert('Ieși?', 'Cronometrele pornite rămân active ca notificări.', [{ text: 'Rămân', style: 'cancel' }, { text: 'Ies', onPress: () => router.back() }]) : router.back())}>
          <Icon name="close" size={28} />
        </Pressable>
        <T v="small">{portions} porții · ecranul rămâne aprins</T>
        <View style={{ width: 28 }} />
      </Row>
      <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 16, marginTop: 12 }}>
        {[-1, ...r.steps.map((_, i) => i)].map((i) => (
          <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= step ? t.primary : t.chip }} />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }}>
        <T v="label">{step < 0 ? 'Pregătește ingredientele' : `Pasul ${step + 1} din ${total}`}</T>
        {step < 0 ? (
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            {r.ing.map(([iid, g], i) => {
              const on = checked.includes(iid);
              return (
                <View key={iid}>
                  {i > 0 && <Divider />}
                  <Pressable onPress={() => setChecked(on ? checked.filter((x) => x !== iid) : [...checked, iid])}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
                    <Icon name={on ? 'checkbox' : 'square-outline'} size={26} color={on ? t.primary : t.muted} />
                    <T style={{ flex: 1, fontSize: 18, textDecorationLine: on ? 'line-through' : 'none', color: on ? t.muted : t.text }}>{ING[iid]?.name}</T>
                    <T style={{ fontSize: 18, fontWeight: '700' }}>{fmtQty(iid, g * k)}</T>
                  </Pressable>
                </View>
              );
            })}
          </Card>
        ) : (
          <>
            <T style={{ fontSize: 28, lineHeight: 38, fontWeight: '600' }}>{r.steps[step]}</T>
            {stepTimers.length > 0 && (
              <Row wrap>
                {stepTimers.map((x) => (
                  <Btn key={x.seconds} title={`Pornește ${x.label}`} icon="timer-outline" variant="accent" onPress={() => start(x.label, x.seconds)} />
                ))}
              </Row>
            )}
          </>
        )}

        {timers.length > 0 && (
          <View style={{ gap: 8, marginTop: 'auto' }}>
            {timers.map((x) => {
              const left = (x.endsAt - Date.now()) / 1000;
              return (
                <Card key={x.key} tone={x.done ? 'accent' : 'primary'} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Icon name={x.done ? 'alarm' : 'timer-outline'} size={24} color={x.done ? t.accent : t.primary} />
                  <View style={{ flex: 1 }}>
                    <T v="small">{x.label}</T>
                    <T style={{ fontSize: 26, fontFamily: DISPLAY }}>{x.done ? 'Gata!' : fmtClock(left)}</T>
                  </View>
                  <Btn title={x.done ? 'OK' : 'Oprește'} small variant="secondary" onPress={() => stop(x)} />
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Row style={{ padding: 16, gap: 10 }}>
        <Btn title="Înapoi" variant="secondary" disabled={step < 0} onPress={() => setStep(step - 1)} style={{ flex: 1 }} />
        {step < total - 1 ? (
          <Btn title={step < 0 ? 'Începe' : 'Pasul următor'} icon="arrow-forward" onPress={() => setStep(step + 1)} style={{ flex: 2 }} />
        ) : (
          <Btn title="Am terminat" icon="checkmark" onPress={finish} style={{ flex: 2 }} />
        )}
      </Row>
    </SafeAreaView>
  );
}
