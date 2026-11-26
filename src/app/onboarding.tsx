import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RECIPE_PHOTO } from '../data/photos';
import { computeTargets } from '../logic/energy';
import { uid } from '../logic/pantry';
import type { Member, Settings } from '../logic/types';
import { DEFAULT_SETTINGS, newMember, useStore } from '../store/useStore';
import {
  ActivityForm, AvoidForm, BodyForm, DietStyleForm, MealStyleForm, MealsPerDay, FastingForm, GoalForm, HealthForm, SportForm, StoresForm, TargetPreview,
} from '../ui/forms';
import { Btn, Card, DISPLAY, Icon, type IconName, NumberField, Row, Segmented, T, useTheme } from '../ui/kit';
import { pickBackup } from '../ui/backup';
import { MemberModal } from '../ui/MemberEditor';
import { ThemePicker } from '../ui/ThemePicker';
import { setThemeId } from '../ui/themeState';

type Household = 'singur' | 'cuplu' | 'familie';

export default function Onboarding() {
  const t = useTheme();
  const router = useRouter();
  const complete = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [me, setMe] = useState<Member>(() => ({ ...newMember(true, ''), id: 'me' }));
  const [hh, setHh] = useState<Household>('singur');
  const [others, setOthers] = useState<Member[]>([]);
  const [editing, setEditing] = useState<Member | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [more, setMore] = useState(false);
  const [avoid, setAvoid] = useState(false);
  const patch = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));
  const importData = useStore((s) => s.importData);
  const restore = async () => {
    const d = await pickBackup();
    if (!d) { Alert.alert('Fișier invalid', 'Alege un fișier de backup făcut din aplicație.'); return; }
    if (importData(d)) router.replace('/');
  };

  const people = 1 + others.length;
  const suggestedBudget = useMemo(() => {
    const kcal = [me, ...others].reduce((s, m) => s + computeTargets(m).kcal, 0);
    return Math.round((kcal * 7 * 0.018) / 10) * 10; // ~18 lei / 1000 kcal, cu carne
  }, [me, others]);

  const steps: { title: string; sub?: string; body: React.ReactNode; canNext?: boolean; optional?: boolean }[] = [
    {
      title: 'Mâncare bună, fără bătăi de cap',
      sub: 'Îți fac planul de mese, lista de cumpărături pentru magazinul tău și țin socoteala caloriilor și a banilor. Durează un minut.',
      body: (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['sarmale', 'shaorma_pui', 'pui_kung_pao', 'clatite_americane', 'lasagna_carne', 'salata_greceasca_pui'].map((id) => (
              <View key={id} style={{ width: '31.8%', aspectRatio: 1, borderRadius: 18, overflow: 'hidden' }}>
                <Image source={RECIPE_PHOTO[id]} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </View>
            ))}
          </View>
          {([
            ['flame', 'Calorii calculate pentru tine', 'Din activitatea zilnică, sport și obiectiv.'],
            ['heart', 'Alegi ce-ți face poftă', 'O singură dată, la început: dreapta da, stânga nu. Apoi alegi doar bucătăriile.'],
            ['basket', 'Lista pentru magazinul tău', 'Lidl, Kaufland, Mega Image… cu prețurile de pe bonurile tale.'],
          ] as [IconName, string, string][]).map(([i, a, b]) => (
            <Row key={a} gap={14} style={{ alignItems: 'flex-start' }}>
              <Icon name={i} color={t.primary} size={22} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <T v="h3">{a}</T>
                <T v="small">{b}</T>
              </View>
            </Row>
          ))}
          <T v="h3" style={{ marginTop: 6 }}>Cum vrei să arate?</T>
          <ThemePicker value={settings.theme ?? 'email'} onChange={(theme) => { patch({ theme }); setThemeId(theme); }} />
          <Pressable onPress={restore} hitSlop={8} style={{ alignSelf: 'center', padding: 6 }}>
            <T v="small" color={t.primary} style={{ fontFamily: DISPLAY }}>Ai deja un backup? Restaurează-l</T>
          </Pressable>
        </View>
      ),
    },
    {
      title: 'Cine ești', sub: 'Datele rămân doar pe telefonul tău.',
      body: (
        <View style={{ gap: 18 }}>
          <BodyForm m={me} onChange={setMe} />
          <T v="h3">O zi obișnuită</T>
          <ActivityForm m={me} onChange={setMe} />
          <T v="small">Sportul îl adaugi mai târziu din Profil, dacă faci.</T>
        </View>
      ),
    },
    {
      title: 'Ce vrei să obții?',
      body: (
        <View style={{ gap: 16 }}>
          <GoalForm m={me} onChange={setMe} />
          <Pressable onPress={() => setMore(!more)} hitSlop={6}>
            <Row gap={6}>
              <Icon name={more ? 'chevron-up' : 'chevron-down'} color={t.primary} size={18} />
              <T v="small" color={t.primary} style={{ fontFamily: DISPLAY }}>Mai precis (opțional): % grăsime, proteine, probleme medicale</T>
            </Row>
          </Pressable>
          {more && <HealthForm m={me} onChange={setMe} />}
          <TargetPreview m={me} />
        </View>
      ),
    },
    {
      title: 'Câte mese mănânci pe zi?', sub: 'Planul pune exact atâtea, iar suma lor iese cât ținta ta.',
      body: (
        <View style={{ gap: 18 }}>
          <MealsPerDay value={settings.slots} onChange={(slots) => patch({ slots, slotsAsked: true })} />
          <T v="h3">Cum mâncați de obicei?</T>
          <MealStyleForm s={settings} onSettings={patch} />
          <Pressable onPress={() => setAvoid(!avoid)} hitSlop={6}>
            <Row gap={6}>
              <Icon name={avoid ? 'chevron-up' : 'chevron-down'} color={t.primary} size={18} />
              <T v="small" color={t.primary} style={{ fontFamily: DISPLAY }}>Ceva ce nu mănânci? (opțional)</T>
            </Row>
          </Pressable>
          {avoid && (
            <View style={{ gap: 14 }}>
              <DietStyleForm m={me} s={settings} onMember={setMe} onSettings={patch} />
              <AvoidForm m={me} onChange={setMe} />
            </View>
          )}
          <T v="small">Magazinul, bugetul, postul și restul le găsești în Profil, doar dacă ai nevoie de ele.</T>
        </View>
      ),
    },
  ];

  const last = step === steps.length - 1;
  const cur = steps[step];
  const finish = () => {
    // bugetul: dacă nu l-ai schimbat, iau ce costă de obicei un plan cu carne pentru tine
    const s2 = settings.budgetRon === DEFAULT_SETTINGS.budgetRon ? { ...settings, budgetRon: suggestedBudget } : settings;
    complete([me, ...others.map((o, i) => ({ ...o, name: o.name.trim() || `Persoana ${i + 2}` }))], { ...s2, slotsAsked: true }, {});
    router.replace('/');
    setTimeout(() => router.push('/alege'), 50);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 10 }}>
          <Row gap={3}>
            {steps.map((_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? t.primary : t.chip }} />)}
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="small">Pasul {step + 1} din {steps.length}</T>
            {cur.optional && <Btn title="Sari peste" variant="ghost" small onPress={() => setStep(step + 1)} />}
          </Row>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <T v="h1">{cur.title}</T>
          {cur.sub ? <T color={t.muted}>{cur.sub}</T> : null}
          {cur.body}
        </ScrollView>
        <Row style={{ padding: 16, gap: 10 }}>
          {step > 0 && <Btn title="Înapoi" variant="secondary" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
          <Btn title={last ? 'Alege ce-ți place' : step === 0 ? 'Să începem' : 'Continuă'} disabled={cur.canNext === false}
            icon={last ? 'heart' : undefined} onPress={() => (last ? finish() : setStep(step + 1))} style={{ flex: 2 }} />
        </Row>
      </KeyboardAvoidingView>
      <MemberModal
        member={editing} visible={!!editing} onClose={() => setEditing(null)}
        onSave={(m) => { setOthers((o) => (o.some((x) => x.id === m.id) ? o.map((x) => (x.id === m.id ? m : x)) : [...o, m])); setEditing(null); }}
        onDelete={editing && others.some((o) => o.id === editing.id) ? () => { setOthers((o) => o.filter((x) => x.id !== editing.id)); setEditing(null); } : undefined}
      />
    </SafeAreaView>
  );
}
