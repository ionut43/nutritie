import { useRouter } from 'expo-router';
import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RECIPE } from '../data/recipes';
import { addDays, DAY_NAMES, fromISO, todayISO, toISO, weekdayMon } from '../logic/dates';
import { perServing } from '../logic/nutrition';
import { mealKey, mealLabel } from '../logic/planner';
import type { PlannedMeal, WeekPlan } from '../logic/types';
import { eatenKey, useStore } from '../store/useStore';
import { success, tick } from './haptics';
import { Btn, FoodImage, Row, T, useTheme } from './kit';

/** Ce poți face cu o masă: aceleași 4 acțiuni, mereu în același loc */
export function MealSheet({ open, mainId, onClose }: { open: { plan: WeekPlan; meal: PlannedMeal } | null; mainId: string; onClose: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toggleEaten, skipMeal, toggleLock } = useStore();
  const plan = useStore((s) => (open ? s.plans[open.plan.id] : undefined));
  if (!open || !plan) return null;
  const m = open.meal;
  const r = RECIPE[m.recipeId];
  const key = eatenKey(mainId, m.day, m.slot);
  const done = plan.eaten.includes(key);
  const f = m.shares.find((x) => x.memberId === mainId)?.factor ?? 1;
  const ses = plan.sessions.find((s) => s.id === m.sessionId);
  const go = (fn: () => void) => { onClose(); setTimeout(fn, 60); };
  const past = toISO(addDays(fromISO(plan.startISO), m.day)) <= todayISO();
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(14,20,32,0.45)' }} onPress={onClose} />
      <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 20 + insets.bottom, gap: 14 }}>
        <Row gap={14}>
          <FoodImage recipe={r} size={72} radius={16} />
          <View style={{ flex: 1 }}>
            <T v="h2" numberOfLines={2}>{r?.name}</T>
            <T v="small">{DAY_NAMES[weekdayMon(addDays(fromISO(plan.startISO), m.day))]}, {mealLabel(m.slot).toLowerCase()}, {r ? Math.round(perServing(r).kcal * f) : 0} kcal</T>
          </View>
        </Row>
        {!past ? null : done ? (
          <Btn title="N-am mâncat-o" variant="secondary" icon="close" onPress={() => { tick(); skipMeal(plan.id, m.day, m.slot); onClose(); }} />
        ) : (
          <Btn title="Am mâncat-o" icon="checkmark" onPress={() => { success(); toggleEaten(plan.id, m.day, m.slot); onClose(); }} />
        )}
        {past && <Btn title="Am mâncat altceva" variant="secondary" icon="swap-horizontal"
          onPress={() => go(() => { skipMeal(plan.id, m.day, m.slot); router.push({ pathname: '/adauga', params: { slot: m.slot } }); })} />}
        {!past && (
          <Btn title={plan.locked?.includes(`${m.day}|${m.slot}`) ? 'Scoate lacătul' : 'Fixează cu lacătul'} variant="secondary" small
            icon={plan.locked?.includes(`${m.day}|${m.slot}`) ? 'lock-open' : 'lock-closed'}
            onPress={() => { tick(); toggleLock(plan.id, m.day, m.slot); }} />
        )}
        <Row>
          <Btn title="Rețeta" variant="secondary" small style={{ flex: 1 }}
            onPress={() => go(() => router.push({ pathname: '/reteta/[id]', params: { id: m.recipeId, portions: String(ses?.portions ?? 1) } }))} />
          <Btn title="Altă rețetă" variant="secondary" small style={{ flex: 1 }}
            onPress={() => go(() => router.push({ pathname: '/schimba', params: { planId: plan.id, key: mealKey(m.day, m.slot) } }))} />
        </Row>
      </View>
    </Modal>
  );
}

