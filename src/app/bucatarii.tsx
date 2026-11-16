import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RECIPE } from '../data/recipes';
import { addDays, DAY_NAMES, fromISO, todayISO, weekdayMon } from '../logic/dates';
import { fmtRon } from '../logic/format';
import { BUDGET_SLACK, buildOnce } from '../logic/planner';
import type { Cuisine, WeekHousehold } from '../logic/types';
import { useStore } from '../store/useStore';
import { success, tick } from '../ui/haptics';
import { Btn, DISPLAY, FoodImage, Icon, IconBtn, Row, T, useTheme } from '../ui/kit';
import { CUISINE_LABEL, CUISINE_SAMPLE } from '../ui/visual';

const ORDER: Cuisine[] = ['ro', 'it', 'med', 'as', 'or', 'eu', 'mx', 'us', 'in'];
const DESC: Record<Cuisine, string> = {
  ro: 'sarmale, ciorbe, tocănițe', it: 'paste, lasagna, risotto', med: 'grecească, la grătar, cu legume',
  as: 'wok, teriyaki, curry thai', or: 'shaorma, kebab, hummus', eu: 'șnițel, gulaș, stroganoff',
  mx: 'tacos, chili, burrito', us: 'burgeri, aripioare, BBQ', in: 'tikka masala, dal, tandoori',
};

/** Planul săptămânii: alegi doar ce bucătării ai chef săptămâna asta, restul îl fac eu în bugetul tău */
export default function WeekCuisines() {
  const t = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ start?: string; ids?: string; guests?: string; fast?: string }>();
  const { members, settings, generate, planInput } = useStore();
  const start = params.start ?? todayISO();
  const hh: WeekHousehold = useMemo(() => ({
    memberIds: params.ids ? params.ids.split(',') : members.map((m) => m.id),
    guests: Number(params.guests ?? 0) || 0,
    applyFasting: params.fast !== '0',
  }), [params.ids, params.guests, params.fast]);
  const liked = (Object.entries(settings.cuisines ?? {}) as [Cuisine, number][]).filter(([, v]) => v === 1).map(([c]) => c);
  const [sel, setSel] = useState<Cuisine[]>(() => settings.lastWeekCuisines?.length ? settings.lastWeekCuisines : liked.length ? liked : ['ro', 'it', 'med']);
  const tile = (Math.min(width, 520) - 40 - 12) / 2;
  // cât ar costa săptămâna cu bucătăriile alese, înainte să faci planul
  const selKey = sel.join(',');
  const cost = useMemo(() => {
    if (!sel.length) return null;
    try { return buildOnce({ ...planInput(start, hh, 7), weekCuisines: sel }, 3.5).cost; } catch { return null; }
  }, [selKey, start, hh]); // eslint-disable-line react-hooks/exhaustive-deps
  const startDate = fromISO(start);

  const make = () => {
    generate(start, hh, undefined, undefined, { cuisines: sel });
    success();
    router.back();
    router.navigate('/plan');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 }}>
        <View style={{ flex: 1 }}>
          <T v="h1">Ce ai chef săptămâna asta?</T>
          <T v="small">De {start === todayISO() ? 'azi' : DAY_NAMES[weekdayMon(startDate)].toLowerCase()} până {DAY_NAMES[weekdayMon(addDays(startDate, 6))].toLowerCase()}. Alege una sau mai multe.</T>
        </View>
        <IconBtn icon="close" onPress={() => router.back()} />
      </Row>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, flexDirection: 'row', flexWrap: 'wrap' }}>
        {ORDER.map((c) => {
          const on = sel.includes(c);
          return (
            <Pressable key={c} onPress={() => { tick(); setSel((x) => (on ? x.filter((y) => y !== c) : [...x, c])); }}
              accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              style={({ pressed }) => ({ width: tile, gap: 6, opacity: pressed ? 0.85 : 1 })}>
              <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 3, borderColor: on ? t.primary : 'transparent' }}>
                <FoodImage recipe={RECIPE[CUISINE_SAMPLE[c]]} width="100%" height={tile * 0.78} radius={0} style={{ opacity: on ? 1 : 0.55 }} />
                <View style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: on ? t.primary : 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Icon name="checkmark" color="#fff" size={18} /> : null}
                </View>
              </View>
              <T style={{ fontFamily: DISPLAY, fontSize: 16 }} color={on ? t.text : t.muted}>{CUISINE_LABEL[c]}</T>
              <T v="small" style={{ marginTop: -4 }}>{DESC[c]}</T>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ padding: 20, paddingTop: 8, gap: 8 }}>
        <Btn title="Fă planul și lista" icon="checkmark" disabled={!sel.length} onPress={make} />
        {cost !== null ? (
          <T style={{ textAlign: 'center' }}>
            Cam <T style={{ fontFamily: DISPLAY }}>{fmtRon(Math.min(cost, settings.budgetRon + BUDGET_SLACK))}</T> săptămâna asta, din bugetul de {fmtRon(settings.budgetRon)}.
          </T>
        ) : null}
        <T v="small" style={{ textAlign: 'center' }}>Fără ce nu mănânci. Orice masă se poate schimba după.</T>
      </View>
    </SafeAreaView>
  );
}
