import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { RECIPE } from '../data/recipes';
import { FAST_LABEL } from '../logic/fasting';
import { perServing } from '../logic/nutrition';
import { MAIN_SLOTS, mealKey, mealLabel, mealMacros, sidesLabel } from '../logic/planner';
import { STORE, type StoreId } from '../logic/stores';
import { eatenKey } from '../store/useStore';
import type { FastLevel, PlannedMeal, Recipe, WeekPlan } from '../logic/types';
import { Chip, DISPLAY, DISPLAY_X, FoodImage, Icon, IconBtn, Pill, Row, T, useTheme } from './kit';
import { fmtPortion } from './visual';

export function FastBadge({ level }: { level: FastLevel }) {
  if (level === 'none') return null;
  return <Chip label={FAST_LABEL[level]} tone={level === 'no_meat' ? 'warn' : 'accent'} icon="leaf" />;
}

/** insigna magazinului, în culorile lui */
export function StoreBadge({ id, small, onPress }: { id: StoreId; small?: boolean; onPress?: () => void }) {
  const s = STORE[id] ?? STORE.altul;
  const body = (
    <View style={{ backgroundColor: s.color, borderRadius: 10, paddingHorizontal: small ? 8 : 12, paddingVertical: small ? 4 : 7, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text style={{ color: s.ink, fontFamily: DISPLAY_X, fontSize: small ? 12 : 15, letterSpacing: -0.2 }}>{s.name}</Text>
      {onPress && <Icon name="chevron-down" size={small ? 12 : 15} color={s.ink} />}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

export function RateButtons({ rating, onRate }: { rating?: 1 | -1; onRate: (v: 1 | -1) => void }) {
  const t = useTheme();
  return (
    <Row gap={6}>
      {([1, -1] as const).map((v) => {
        const on = rating === v;
        const c = v === 1 ? t.accent : t.danger;
        return (
          <Pressable key={v} hitSlop={6} onPress={() => onRate(v)} style={{
            width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
            backgroundColor: on ? c : t.chip, opacity: rating && !on ? 0.5 : 1,
          }}>
            <Icon name={v === 1 ? 'thumbs-up' : 'thumbs-down'} size={16} color={on ? '#fff' : t.muted} />
          </Pressable>
        );
      })}
    </Row>
  );
}

/** cardul unei mese din plan: poză mare, porția ta, stare */
export function MealCard({ plan, meal, mainId, onSwap, showEaten, onToggleEaten, rating, onRate }: {
  plan: WeekPlan; meal: PlannedMeal; mainId?: string; onSwap?: () => void; showEaten?: boolean; onToggleEaten?: () => void;
  rating?: 1 | -1; onRate?: (v: 1 | -1) => void;
}) {
  const t = useTheme();
  const router = useRouter();
  const r = RECIPE[meal.recipeId];
  if (!r) return null;
  const share = meal.shares.find((s) => s.memberId === mainId)?.factor ?? meal.shares[0]?.factor ?? 1;
  const ps = perServing(r);
  const session = plan.sessions.find((s) => s.id === meal.sessionId);
  const portions = session?.portions ?? Math.ceil(meal.shares.reduce((a, b) => a + b.factor, 0));
  const leftover = MAIN_SLOTS.includes(meal.slot) && session && session.day !== meal.day && !session.extra;
  const eaten = plan.eaten.includes(eatenKey(mainId ?? '', meal.day, meal.slot)) || plan.eaten.includes(mealKey(meal.day, meal.slot));
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/reteta/[id]', params: { id: r.id, portions: String(portions) } })}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 12, paddingVertical: 8, opacity: pressed ? 0.8 : 1 })}
    >
      <View>
        <FoodImage recipe={r} size={84} radius={18} style={{ opacity: eaten ? 0.55 : 1 }} />
        {showEaten && (
          <Pressable hitSlop={8} onPress={onToggleEaten} style={{ position: 'absolute', bottom: -6, right: -6 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: eaten ? t.accent : t.card, borderWidth: eaten ? 0 : 2, borderColor: t.border, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="checkmark" size={18} color={eaten ? '#fff' : t.muted} />
            </View>
          </Pressable>
        )}
      </View>
      <View style={{ flex: 1, gap: 3, justifyContent: 'center' }}>
        <T v="label" color={t.primary}>{mealLabel(meal.slot)}</T>
        <T v="h3" numberOfLines={2} style={{ textDecorationLine: eaten ? 'line-through' : 'none' }}>{r.name}</T>
        <Row gap={6} wrap>
          <T v="small">{fmtPortion(share)} {share === 1 ? 'porție' : 'porții'} · {Math.round(mainId ? mealMacros(meal, mainId).kcal : ps.kcal * share)} kcal · {Math.round(mainId ? mealMacros(meal, mainId).p : ps.p * share)} g prot.</T>
        </Row>
        {sidesLabel(meal) ? <T v="small" color={t.text}>{sidesLabel(meal)}</T> : null}
        <Row gap={6} wrap>
          {meal.frozen ? <Pill text="din congelator" icon="snow" color={t.protein} /> : leftover ? <Pill text="gătit deja" icon="checkmark-done" color={t.accent} /> : null}
          {session?.extra ? <Pill text="gătești azi" icon="flame" color={t.primary} /> : null}
          {eaten && onRate ? <RateButtons rating={rating} onRate={onRate} /> : null}
        </Row>
      </View>
      {onSwap && <View style={{ justifyContent: 'center' }}><IconBtn icon="shuffle" size={36} onPress={onSwap} /></View>}
    </Pressable>
  );
}

/** compatibilitate cu ecranele vechi */
export const MealRow = MealCard;

/** card de rețetă pentru grilă */
export function RecipeTile({ r, onPress, width, sub }: { r: Recipe; onPress: () => void; width: number | `${number}%`; sub?: string }) {
  const t = useTheme();
  const ps = perServing(r);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ width, gap: 6, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <FoodImage recipe={r} width="100%" height={150} radius={20} />
      <View style={{ position: 'absolute', top: 8, left: 8 }}>
        <Pill text={`${r.prep} min`} icon="time" color="#fff" bg="rgba(0,0,0,0.55)" />
      </View>
      <T v="h3" numberOfLines={2} style={{ fontSize: 15 }}>{r.name}</T>
      <T v="small">{sub ?? `${Math.round(ps.kcal)} kcal · ${Math.round(ps.p)} g proteine`}</T>
      {r.custom ? <View style={{ position: 'absolute', top: 8, right: 8 }}><Pill text="a ta" color={t.onPrimary} bg={t.primary} /></View> : null}
    </Pressable>
  );
}

export function Avatar({ name, color, size = 40, dim }: { name: string; color: string; size?: number; dim?: boolean }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: dim ? '#A8ADA9' : color, alignItems: 'center', justifyContent: 'center' }}>
      <T style={{ color: '#fff', fontFamily: DISPLAY, fontSize: size * 0.42, lineHeight: size * 0.52 }}>{(name.trim()[0] ?? 'Eu').toUpperCase()}</T>
    </View>
  );
}
