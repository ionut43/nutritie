import { useRouter } from 'expo-router';
import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RECIPE } from '../data/recipes';
import { addDays, DAY_NAMES, fromISO, todayISO, toISO, weekdayMon } from '../logic/dates';
import { perServing } from '../logic/nutrition';
import { mealKey, mealLabel, mealMacros } from '../logic/planner';
import type { PlannedMeal, WeekPlan } from '../logic/types';
import { eatenKey, useStore } from '../store/useStore';
import { success, tick } from './haptics';
import { Btn, FoodImage, Row, T, useTheme } from './kit';

const portionText = (f: number) => {
  const whole = Math.floor(f);
  const frac = f - whole;
  const q = frac >= 0.7 ? '¾' : frac >= 0.45 ? '½' : frac >= 0.2 ? '¼' : '';
  if (!whole) return `${q} de porție`;
  return `${whole}${q ? ` ${q}` : ''} ${whole === 1 && !q ? 'porție' : 'porții'}`;
};

/** Ce poți face cu o masă: aceleași 4 acțiuni, mereu în același loc */
export function MealSheet({ open, mainId, onClose }: { open: { plan: WeekPlan; meal: PlannedMeal } | null; mainId: string; onClose: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toggleEaten, skipMeal, toggleLock, members } = useStore();
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
            <T v="small">{DAY_NAMES[weekdayMon(addDays(fromISO(plan.startISO), m.day))]}, {mealLabel(m.slot).toLowerCase()}, {Math.round(mealMacros(m, mainId).kcal)} kcal{f !== 1 ? `, felul principal ×${String(f).replace('.', ',')}` : ''}</T>
          </View>
        </Row>
        {members.length > 1 && (
          <View style={{ gap: 4, padding: 12, borderRadius: 14, backgroundColor: t.chip }}>
            <T v="small" style={{ fontWeight: '700' }}>Cine mănâncă</T>
            {members.map((p) => {
              const sh = m.shares.find((x) => x.memberId === p.id);
              const first = p.name.trim().split(' ')[0] || 'Membru';
              return (
                <T key={p.id} v="small">
                  {sh ? `${first}: ${portionText(sh.factor)} din felul principal, ${Math.round(mealMacros(m, p.id).kcal)} kcal cu tot cu garnituri` : `${first}: nu e acasă la masa asta`}
                </T>
              );
            })}
            {m.shares.filter((x) => x.memberId.startsWith('guest_')).length > 0 && <T v="small">și musafirii, câte o porție</T>}
          </View>
        )}
        {(m.sides ?? []).length > 0 && (
          <View style={{ gap: 8 }}>
            {(m.sides ?? []).map((sd) => {
              const sr = RECIPE[sd.recipeId];
              if (!sr) return null;
              const sf = sd.shares.find((x) => x.memberId === mainId)?.factor ?? 1;
              const sses = plan.sessions.find((x) => x.id === sd.sessionId);
              const tappable = sr.id !== 'garnitura_paine';
              return (
                <Pressable key={sd.recipeId} disabled={!tappable} onPress={() => go(() => router.push({ pathname: '/reteta/[id]', params: { id: sr.id, portions: String(sses?.portions ?? 1) } }))}>
                  <Row gap={12}>
                    <FoodImage recipe={sr} size={44} radius={12} />
                    <View style={{ flex: 1 }}>
                      <T numberOfLines={1} style={{ fontWeight: '600' }}>+ {sr.name}{sr.id === 'garnitura_paine' ? `, ${Math.round(sf * 100)} g` : ''}</T>
                      <T v="small">{Math.round(perServing(sr).kcal * sf)} kcal{tappable ? ', atinge pentru rețetă' : ''}</T>
                    </View>
                  </Row>
                </Pressable>
              );
            })}
          </View>
        )}
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

