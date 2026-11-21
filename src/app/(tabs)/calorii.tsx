import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RECIPE } from '../../data/recipes';
import { addDays, DAY_NAMES, DAY_SHORT, fromISO, todayISO, toISO, weekdayMon } from '../../logic/dates';
import { computeTargets, dailyBase, exerciseKcal } from '../../logic/energy';
import { recipeOfEntry, slotOfEntry } from '../../logic/foods';
import { nf } from '../../logic/format';
import { perServing } from '../../logic/nutrition';
import { mealLabel, mealMacros, sidesLabel, SLOT_ORDER } from '../../logic/planner';
import type { PlannedMeal } from '../../logic/types';
import { eatenKey, ownedBy, planForDate, useActiveMember, useStore } from '../../store/useStore';
import { DISPLAY, DISPLAY_X, Divider, FoodImage, Icon, IconBtn, Row, T, useTheme } from '../../ui/kit';
import { MealArc, MiniArc } from '../../ui/MealArc';

/**
 * Caloriile pe larg: arcul pe bucăți (fiecare masă cu poza ei), ținta, din ce sunt făcute,
 * ce ai mâncat și săptămâna ca șapte semicercuri mici. Poți merge înapoi pe zilele trecute.
 */
export default function Calories() {
  const t = useTheme();
  const { foodLog, members, plans, removeFood } = useStore();
  const main = useActiveMember();
  const mainId = members.find((m) => m.isMain)?.id;
  const today = todayISO();
  const [day, setDay] = useState(today);
  const [why, setWhy] = useState(false);
  const mine = useMemo(() => foodLog.filter((f) => ownedBy(main?.id, mainId, f.memberId)), [foodLog, main?.id, mainId]);
  if (!main) return null;

  const tg = computeTargets(main);
  const log = mine.filter((f) => f.dateISO === day)
    .sort((a, b) => SLOT_ORDER.indexOf(slotOfEntry(a) ?? 'cina') - SLOT_ORDER.indexOf(slotOfEntry(b) ?? 'cina'));
  const sum = log.reduce((a, f) => ({
    kcal: a.kcal + f.kcal, p: a.p + f.p, c: a.c + f.c, f: a.f + f.f, fib: a.fib + (f.fib ?? 0), sug: a.sug + (f.sug ?? 0), salt: a.salt + (f.salt ?? 0),
  }), { kcal: 0, p: 0, c: 0, f: 0, fib: 0, sug: 0, salt: 0 });
  const pieces = log.map((f) => ({ kcal: f.kcal, recipe: recipeOfEntry(f, plans), color: f.mealKey ? t.primary : t.arcMid }));

  // ce mai urmează azi din plan (doar pentru azi)
  const found = planForDate(plans, day);
  const upcoming = day === today && found ? found.plan.meals.filter((m) => m.day === found.day && m.shares.some((x) => x.memberId === main.id)
    && !found.plan.eaten.includes(eatenKey(main.id, m.day, m.slot)) && !found.plan.skipped?.includes(eatenKey(main.id, m.day, m.slot))
    && !log.some((f) => !f.mealKey && f.slot === m.slot)) : [];
  const kcalOf = (m: PlannedMeal) => mealMacros(m, main.id).kcal;
  const ghost = upcoming.reduce((a, m) => a + kcalOf(m), 0);

  // cât arzi într-o zi, pe bucăți
  const move = main.job ? Math.round(tg.bmr * (dailyBase(main) - 1)) : tg.tdee - tg.bmr;
  const sport = main.job ? Math.round(exerciseKcal(main)) : 0;
  const diff = tg.kcal - tg.tdee;
  const date = fromISO(day);
  const isToday = day === today;

  // săptămâna (luni–duminică) a zilei alese
  const monday = addDays(fromISO(day), -weekdayMon(fromISO(day)));
  const week = Array.from({ length: 7 }, (_, i) => {
    const iso = toISO(addDays(monday, i));
    return { iso, kcal: mine.filter((f) => f.dateISO === iso).reduce((a, f) => a + f.kcal, 0) };
  });
  const past = week.filter((w) => w.iso < today && w.kcal > 0);
  const avg = past.length ? Math.round(past.reduce((a, w) => a + w.kcal, 0) / past.length) : 0;
  const overDays = past.filter((w) => w.kcal > tg.kcal * 1.05);
  const hair = StyleSheet.hairlineWidth * 2;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 10, paddingBottom: 40, gap: 24 }} showsVerticalScrollIndicator={false}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="h1">Calorii</T>
          <Row gap={4}>
            <IconBtn icon="chevron-back" tone="card" onPress={() => setDay(toISO(addDays(date, -1)))} />
            <T style={{ fontFamily: DISPLAY, fontSize: 16, minWidth: 64, textAlign: 'center' }}>{isToday ? 'Azi' : `${DAY_SHORT[weekdayMon(date)]} ${date.getDate()}`}</T>
            <IconBtn icon="chevron-forward" tone="card" color={isToday ? t.border : undefined} onPress={isToday ? undefined : () => setDay(toISO(addDays(date, 1)))} />
          </Row>
        </Row>

        <View style={{ alignItems: 'center', gap: 14 }}>
          <MealArc target={tg.kcal} pieces={pieces} ghost={ghost} size={300} stroke={22} />
          <Row style={{ alignSelf: 'stretch', backgroundColor: t.card, borderRadius: 18, borderWidth: hair, borderColor: t.border, paddingVertical: 14 }}>
            <Big label="ținta pe zi" value={tg.kcal} />
            <View style={{ width: hair, alignSelf: 'stretch', backgroundColor: t.border }} />
            <Big label="ai mâncat" value={Math.round(sum.kcal)} color={t.primary} />
            <View style={{ width: hair, alignSelf: 'stretch', backgroundColor: t.border }} />
            <Big label="arzi pe zi" value={tg.tdee} />
          </Row>
          <Pressable onPress={() => setWhy(!why)} style={{ alignSelf: 'stretch', minHeight: 44, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: t.border, paddingHorizontal: 14, paddingVertical: 11, gap: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T>De unde vine ținta de {tg.kcal.toLocaleString('ro-RO')}</T>
              <Icon name={why ? 'chevron-up' : 'chevron-down'} size={18} color={t.muted} />
            </Row>
            {why && (
              <View style={{ gap: 8 }}>
                <Line label="Metabolism (corpul în repaus)" value={tg.bmr} />
                <Line label="Mișcarea de zi cu zi" value={move} />
                {sport > 0 && <Line label="Sport, în medie pe zi" value={sport} />}
                <Divider />
                <Line label="Arzi într-o zi" value={tg.tdee} bold />
                {diff !== 0 && <Line label={diff < 0 ? 'Deficit, ca să slăbești' : 'Surplus, ca să crești'} value={diff} sign />}
                <Line label="Ținta ta" value={tg.kcal} bold color={t.primary} />
                {diff < 0 && <T v="small">Un deficit de {Math.abs(diff)} kcal pe zi înseamnă cam {nf(Math.abs(diff) * 7 / 7700)} kg pe săptămână.</T>}
                <T v="small">
                  Calculat pentru {main.sex === 'm' ? 'bărbat' : 'femeie'}, {tg.age} ani, {main.heightCm} cm, {nf(main.weightKg)} kg, cu formula {tg.method}.
                  {' '}Două persoane diferite pot avea ținte apropiate: un bărbat greu care stă mult jos arde cam cât o femeie activă, iar deficitul nu trece de un sfert din ce arzi.
                </T>
                {tg.warnings.map((w) => <T key={w} v="small" color={t.danger}>{w}</T>)}
              </View>
            )}
          </Pressable>
        </View>

        <View style={{ gap: 12 }}>
          <T v="h3">Din ce sunt făcute</T>
          <Row gap={10}>
            <MacroArc label="proteine" v={sum.p} max={tg.protein} color={t.protein} />
            <MacroArc label="carbohidrați" v={sum.c} max={tg.carbs} color={t.carbs} />
            <MacroArc label="grăsimi" v={sum.f} max={tg.fat} color={t.accent} />
          </Row>
          <T v="small">Fibre {Math.round(sum.fib)} din {tg.fiber} g, sare {nf(sum.salt)} din maximum {tg.saltMax} g, zaharuri {Math.round(sum.sug)} g.</T>
        </View>

        <View style={{ gap: 10 }}>
          <T v="h3">Ce ai mâncat</T>
          {log.length === 0 && upcoming.length === 0 && <T color={t.muted}>Nimic notat {isToday ? 'încă azi' : 'în ziua asta'}.</T>}
          {log.map((f) => {
            const r = recipeOfEntry(f, plans);
            const slot = slotOfEntry(f);
            return (
              <Row key={f.id} gap={12} style={{ backgroundColor: t.card, borderRadius: 18, borderWidth: hair, borderColor: t.border, padding: 10 }}>
                {r ? <FoodImage recipe={r} size={52} radius={12} /> : (
                  <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: t.arcMid, alignItems: 'center', justifyContent: 'center' }}><Icon name="restaurant" color="#fff" size={20} /></View>
                )}
                <View style={{ flex: 1 }}>
                  <T numberOfLines={1} style={{ fontFamily: DISPLAY, fontSize: 16 }}>{f.label}</T>
                  <T v="small">{slot ? mealLabel(slot) : 'Altceva'}, {Math.round(f.p)} g proteine{f.mealKey ? '' : ', notată de tine'}</T>
                </View>
                <T style={{ fontFamily: DISPLAY_X, fontSize: 18, fontVariant: ['tabular-nums'] }}>{f.approx ? '≈' : ''}{Math.round(f.kcal).toLocaleString('ro-RO')}</T>
                {!f.mealKey && (
                  <Pressable hitSlop={10} onPress={() => removeFood(f.id)} accessibilityLabel="Șterge" style={{ width: 32, alignItems: 'center' }}>
                    <Icon name="close" size={18} color={t.muted} />
                  </Pressable>
                )}
              </Row>
            );
          })}
          {upcoming.map((m) => (
            <Row key={m.slot} gap={12} style={{ borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: t.border, padding: 10 }}>
              <View style={{ opacity: 0.55 }}><FoodImage recipe={RECIPE[m.recipeId]} size={52} radius={12} /></View>
              <View style={{ flex: 1 }}>
                <T numberOfLines={1} color={t.muted} style={{ fontFamily: DISPLAY, fontSize: 16 }}>{RECIPE[m.recipeId]?.name}</T>
                <T v="small" numberOfLines={1}>{mealLabel(m.slot)}, urmează{sidesLabel(m) ? `, ${sidesLabel(m)}` : ''}</T>
              </View>
              <T color={t.muted} style={{ fontFamily: DISPLAY_X, fontSize: 18, fontVariant: ['tabular-nums'] }}>{Math.round(kcalOf(m)).toLocaleString('ro-RO')}</T>
            </Row>
          ))}
        </View>

        <View style={{ gap: 12 }}>
          <T v="h3">Săptămâna asta</T>
          <Row style={{ backgroundColor: t.card, borderRadius: 18, borderWidth: hair, borderColor: t.border, paddingVertical: 14, paddingHorizontal: 6, justifyContent: 'space-between' }}>
            {week.map((w, i) => {
              const future = w.iso > today;
              const over = w.kcal > tg.kcal * 1.05;
              const sel = w.iso === day;
              return (
                <Pressable key={w.iso} disabled={future} onPress={() => setDay(w.iso)} accessibilityLabel={`${DAY_NAMES[i]}, ${Math.round(w.kcal)} kcal`}
                  style={{ flex: 1, alignItems: 'center', gap: 4, minHeight: 44 }}>
                  <MiniArc value={w.kcal} max={tg.kcal} size={42} stroke={5} color={over ? t.warn : sel ? t.primary : t.arcMid} dashed={future} />
                  <T style={{ fontSize: 13, fontFamily: sel ? DISPLAY_X : undefined, borderBottomWidth: sel ? 2 : 0, borderBottomColor: t.primary }}
                    color={sel ? t.primary : t.muted}>{DAY_SHORT[i].slice(0, 1)}</T>
                </Pressable>
              );
            })}
          </Row>
          {past.length > 0 && (
            <T v="small">
              În medie, {avg.toLocaleString('ro-RO')} kcal pe zi.{overDays.length ? ` Ai trecut de țintă ${overDays.length === 1 ? 'într-o zi' : `în ${overDays.length} zile`}.` : ' Nicio zi peste țintă.'}
            </T>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MacroArc({ label, v, max, color }: { label: string; v: number; max: number; color: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: t.card, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.border, paddingTop: 12, paddingBottom: 10, gap: 2 }}>
      <MiniArc value={v} max={max} color={color} size={88} stroke={9} />
      <T style={{ fontFamily: DISPLAY_X, fontSize: 18, marginTop: -16 }}>{Math.round(v)} g</T>
      <T v="small" style={{ textAlign: 'center' }}>{label} din {max}</T>
    </View>
  );
}

function Big({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <T v="h2" color={color} style={{ fontVariant: ['tabular-nums'] }}>{value.toLocaleString('ro-RO')}</T>
      <T v="small">{label}</T>
    </View>
  );
}

function Line({ label, value, bold, sign, color }: { label: string; value: number; bold?: boolean; sign?: boolean; color?: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T color={color} style={bold ? { fontFamily: DISPLAY } : undefined}>{label}</T>
      <T color={color} style={{ fontFamily: bold ? DISPLAY : undefined, fontVariant: ['tabular-nums'] }}>{sign && value > 0 ? '+' : ''}{value.toLocaleString('ro-RO')} kcal</T>
    </Row>
  );
}
