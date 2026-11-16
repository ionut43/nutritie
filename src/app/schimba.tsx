import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { ING } from '../data/ingredients';
import { RECIPE } from '../data/recipes';
import { DAY_NAMES, weekdayMon } from '../logic/dates';
import { fmtRon } from '../logic/format';
import { perServing } from '../logic/nutrition';
import { pantryTotals } from '../logic/pantry';
import { alternativesFor, costPerPortion, mealKey, planDate, mealLabel } from '../logic/planner';
import { useStore } from '../store/useStore';
import { Card, Empty, FoodImage, Pill, Row, Screen, Segmented, T, useTheme } from '../ui/kit';

export default function Swap() {
  const t = useTheme();
  const router = useRouter();
  const { planId, key } = useLocalSearchParams<{ planId: string; key: string }>();
  const s = useStore();
  const plan = s.plans[planId];
  const meal = plan?.meals.find((m) => mealKey(m.day, m.slot) === key);
  const sessionMeals = plan && meal ? plan.meals.filter((m) => m.sessionId === meal.sessionId) : [];
  const [scope, setScope] = useState<'session' | 'meal'>(sessionMeals.length > 1 ? 'session' : 'meal');
  if (!plan || !meal) return <Screen><Empty icon="alert-circle" title="Masa nu mai există" /></Screen>;

  const input = s.planInput(plan.startISO, plan.household, plan.seed);
  const alts = alternativesFor(plan, scope === 'session' ? { sessionId: meal.sessionId } : { key }, input, 12);
  const pan = pantryTotals(s.pantry);
  const cur = RECIPE[meal.recipeId];
  const daysTxt = [...new Set(sessionMeals.map((m) => DAY_NAMES[weekdayMon(planDate(plan, m.day))]))].join(', ');

  return (
    <Screen edges={['bottom']}>
      <Row gap={12}>
        <FoodImage recipe={cur} size={64} radius={16} />
        <View style={{ flex: 1 }}>
          <T v="label">{DAY_NAMES[weekdayMon(planDate(plan, meal.day))]} · {mealLabel(meal.slot)}</T>
          <T v="h3">În loc de {cur?.name}</T>
        </View>
      </Row>
      {sessionMeals.length > 1 && (
        <View style={{ gap: 6 }}>
          <Segmented options={[{ label: `Toată gătirea (${sessionMeals.length} mese)`, value: 'session' }, { label: 'Doar masa asta', value: 'meal' }]}
            value={scope} onChange={setScope} />
          <T v="small">{scope === 'session' ? `Se schimbă la toate mesele din aceeași oală: ${daysTxt}.` : 'Gătești separat altceva doar pentru masa asta.'}</T>
        </View>
      )}
      {alts.length === 0 && <Empty icon="search" title="Nicio alternativă potrivită" text="Încearcă „Doar masa asta” sau verifică restricțiile și echipamentele." />}
      {alts.map((r) => {
        const ps = perServing(r);
        const real = r.ing.filter(([id]) => !ING[id]?.staple);
        const have = real.filter(([id]) => (pan[id] ?? 0) > 0).length;
        return (
          <Card key={r.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10 }} onPress={() => {
            if (scope === 'session') s.replaceSession(plan.id, meal.sessionId, r.id);
            else s.replaceMeal(plan.id, key, r.id);
            router.back();
          }}>
            <FoodImage recipe={r} size={76} radius={16} />
            <View style={{ flex: 1, gap: 4 }}>
              <T v="h3" numberOfLines={2}>{r.name}</T>
              <T v="small">{Math.round(ps.kcal)} kcal · {Math.round(ps.p)} g prot. · {r.prep} min · ~{fmtRon(costPerPortion(r, s.prices, plan.store, s.storePrices))}/porție</T>
              {have > 0 && <Pill text={`ai ${have}/${real.length} ingrediente`} icon="checkmark-circle" color={t.accent} bg={t.accentSoft} />}
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
