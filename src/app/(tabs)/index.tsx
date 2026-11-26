import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ING } from '../../data/ingredients';
import { RECIPE } from '../../data/recipes';
import { addDays, DAY_NAMES, fromISO, todayISO, toISO, weekdayMon } from '../../logic/dates';
import { computeTargets } from '../../logic/energy';
import { fastInfo } from '../../logic/fasting';
import { fmtRon, nf } from '../../logic/format';
import { perServing } from '../../logic/nutrition';
import { recipeOfEntry, slotOfEntry as slotOf } from '../../logic/foods';
import { daysLeft } from '../../logic/pantry';
import { mealLabel, mealMacros, sessionMeals, sidesLabel, SLOT_ORDER } from '../../logic/planner';
import { UpdateBanner } from '../../ui/UpdateBanner';
import { RefitBanner } from '../../ui/RefitBanner';
import type { FoodLogEntry, Member, PlannedMeal, Slot, WeekPlan } from '../../logic/types';
import { eatenKey, ownedBy, planForDate, useActiveMember, useFeature, useStore } from '../../store/useStore';
import { Btn, Chip, DISPLAY, DISPLAY_X, FoodImage, Icon, Row, T, useTheme } from '../../ui/kit';
import { MealSheet } from '../../ui/MealSheet';
import { Avatar } from '../../ui/shared';
import { MealArc } from '../../ui/MealArc';
import { MealsPerDay } from '../../ui/forms';
import { success, tick } from '../../ui/haptics';

export function loggingStreak(dates: string[], today: string): number {
  const set = new Set(dates);
  let d = set.has(today) ? fromISO(today) : addDays(fromISO(today), -1);
  let n = 0;
  while (set.has(toISO(d))) { n++; d = addDays(d, -1); }
  return n;
}

const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const HERO_IDS = ['shaorma_pui', 'sarmale', 'lasagna_carne', 'pui_kung_pao'];

type DayRow = { kind: 'plan'; meal: PlannedMeal; state: 'done' | 'skipped' | 'replaced' | 'todo' } | { kind: 'extra'; slot?: Slot; entry: FoodLogEntry };

/**
 * Azi: semicercul pe bucăți (fiecare masă mâncată, cu poza ei; ce urmează, mai deschis),
 * un buton mic „Adaugă o masă” lipit de el, apoi mesele zilei. Fără ore: bifezi tu.
 */
export default function Today() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { members, plans, foodLog, pantry, settings, spend, removeFood, lastRecapISO, toggleEaten, setMealSlots, pendingMeals, confirmDay } = useStore();
  const main = useActiveMember();
  const postOn = useFeature('post');
  const pantryOn = useFeature('camara');
  const mainMemberId = members.find((m) => m.isMain)?.id;
  const [open, setOpen] = useState<{ plan: WeekPlan; meal: PlannedMeal } | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = (text: string, undo?: () => void) => {
    setToast({ text, undo });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const today = todayISO();
  const yesterdayISO = toISO(addDays(fromISO(today), -1));
  const myLog = useMemo(() => foodLog.filter((f) => ownedBy(main?.id, mainMemberId, f.memberId)), [foodLog, main?.id, mainMemberId]);
  if (!main) return null;

  const now = new Date();
  const tg = computeTargets(main);
  const log = myLog.filter((f) => f.dateISO === today);
  const found = planForDate(plans, today);
  const plan = found?.plan;
  const day = found?.day ?? -1;
  const fi = fastInfo(now, settings.fasting, settings.fishOnDispensation);

  // rândurile zilei, în ordinea meselor
  const rows: DayRow[] = [];
  const extras = log.filter((f) => !f.mealKey);
  for (const slot of SLOT_ORDER) {
    const m = plan?.meals.find((x) => x.day === day && x.slot === slot);
    const slotExtras = extras.filter((f) => f.slot === slot);
    // la masa asta nu e acasă (serviciu, școală): nu apare în ziua lui
    if (m && plan && !m.shares.some((x) => x.memberId === main.id)) continue;
    if (m && plan) {
      const key = eatenKey(main.id, m.day, m.slot);
      const state = plan.eaten.includes(key) ? 'done' : slotExtras.length ? 'replaced' : plan.skipped?.includes(key) ? 'skipped' : 'todo';
      rows.push({ kind: 'plan', meal: m, state });
    }
    for (const e of slotExtras) rows.push({ kind: 'extra', slot, entry: e });
  }
  for (const e of extras.filter((f) => !f.slot || !SLOT_ORDER.includes(f.slot as Slot))) rows.push({ kind: 'extra', entry: e });
  const next = rows.find((r) => r.kind === 'plan' && r.state === 'todo') as Extract<DayRow, { kind: 'plan' }> | undefined;
  const kcalOf = (m: PlannedMeal) => mealMacros(m, main.id).kcal;
  const ghost = rows.reduce((a, r) => a + (r.kind === 'plan' && r.state === 'todo' ? kcalOf(r.meal) : 0), 0);

  // bucățile arcului: ce ai mâncat azi, în ordinea meselor
  const pieces = [...log]
    .sort((a, b) => SLOT_ORDER.indexOf(slotOf(a) ?? 'cina') - SLOT_ORDER.indexOf(slotOf(b) ?? 'cina'))
    .map((f) => ({ kcal: f.kcal, recipe: recipeOfEntry(f, plans), color: f.mealKey ? t.primary : t.arcMid, entry: f }));
  const eatenKcal = pieces.reduce((a, p) => a + p.kcal, 0);
  const ate = Math.round(eatenKcal);

  const pendingY = pendingMeals(yesterdayISO);
  const cookToday = plan ? plan.sessions.filter((s) => s.day === day && !s.done && !s.nocook && sessionMeals(plan, s.id).length > 1) : [];
  const expiring = pantry.filter((p) => daysLeft(p, today) <= 2 && !ING[p.ingId]?.staple);
  const monday = toISO(addDays(fromISO(today), -weekdayMon(now)));
  const spentWeek = spend.filter((x) => x.dateISO >= monday).reduce((a, x) => a + x.amount, 0);
  const nextMonday = toISO(addDays(fromISO(monday), 7));
  const needNext = weekdayMon(now) >= 3 && !planForDate(plans, nextMonday);
  const showRecap = weekdayMon(now) <= 2 && lastRecapISO !== monday && foodLog.some((f) => f.dateISO < monday);

  const check = (r: Extract<DayRow, { kind: 'plan' }>) => {
    if (!plan) return;
    const was = r.state === 'done';
    toggleEaten(plan.id, r.meal.day, r.meal.slot);
    const name = RECIPE[r.meal.recipeId]?.name ?? 'Masa';
    if (was) { tick(); say(`Am scos ${name.toLowerCase()} din ziua de azi.`, () => toggleEaten(plan.id, r.meal.day, r.meal.slot)); }
    else { success(); say(`Notat: ${name.toLowerCase()}.`, () => toggleEaten(plan.id, r.meal.day, r.meal.slot, r.state === 'todo')); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 90, gap: 22 }} showsVerticalScrollIndicator={false}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <T v="small">{DAY_NAMES[weekdayMon(now)]}, {now.getDate()} {MONTHS[now.getMonth()]}</T>
            <T v="h1" style={{ fontFamily: DISPLAY_X }}>{main.name.trim() ? `Bună, ${main.name.trim().split(' ')[0]}` : 'Bună!'}</T>
          </View>
          <Pressable onPress={() => router.push('/profil')} accessibilityLabel="Profilul și setările" hitSlop={10}>
            <Avatar name={main.name} color={t.primary} size={40} />
          </Pressable>
        </Row>

        {members.length > 1 && plan && <FamilyDay plan={plan} day={day} members={members} onOpen={(meal) => setOpen({ plan, meal })} />}

        <UpdateBanner />
        <RefitBanner />

        <View style={{ alignItems: 'center', gap: 12 }}>
          <MealArc target={tg.kcal} pieces={pieces} ghost={ghost} size={300} stroke={22}
            onPiece={(i) => { const e = pieces[i].entry; if (e.planId && e.mealKey && plan) { const r = rows.find((x) => x.kind === 'plan' && eatenKey(main.id, x.meal.day, x.meal.slot) === e.mealKey); if (r && r.kind === 'plan') setOpen({ plan, meal: r.meal }); } }} />
          <Pressable onPress={() => router.push('/adauga')} accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingLeft: 12, paddingRight: 18, borderRadius: 22,
              backgroundColor: t.primary, borderBottomWidth: 3, borderBottomColor: t.rim, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
            <Icon name="add" color={t.onPrimary} size={22} />
            <T color={t.onPrimary} style={{ fontFamily: DISPLAY, fontSize: 16 }}>Adaugă o masă</T>
          </Pressable>
          <Row gap={22}>
            <Legend color={t.primary} label={`mâncat ${ate.toLocaleString('ro-RO')}`} />
            {ghost > 0 && <Legend color={t.arcGhost} label={`urmează ${Math.round(ghost).toLocaleString('ro-RO')}`} />}
          </Row>
          {postOn && fi.level !== 'none' && <T v="small" color={t.accent}>{fi.reason}</T>}
        </View>

        {pendingY.length > 0 && (
          <View style={[st.card, { borderColor: t.border, backgroundColor: t.card }]}>
            <T v="h3">Ieri: ai mâncat ce era în plan?</T>
            <T v="small">{pendingY.map((m) => RECIPE[m.recipeId]?.name.toLowerCase()).filter(Boolean).join(', ')}</T>
            <Row wrap gap={8}>
              <Btn small title="Da, tot" onPress={() => { confirmDay(yesterdayISO, 'all'); success(); say('Am notat ziua de ieri.'); }} />
              {pendingY.length > 1 && <Btn small variant="secondary" title="Doar prima masă" onPress={() => { confirmDay(yesterdayISO, 'first'); success(); say('Am notat prima masă de ieri.'); }} />}
              <Btn small variant="secondary" title="Altceva" onPress={() => { confirmDay(yesterdayISO, 'none'); router.push({ pathname: '/adauga', params: { date: yesterdayISO } }); }} />
            </Row>
          </View>
        )}

        {!settings.slotsAsked && (
          <View style={[st.card, { borderColor: t.border, backgroundColor: t.card }]}>
            <T v="h3">Câte mese mănânci pe zi?</T>
            <T v="small">Alege câte mănânci de fapt și potrivesc planul pe loc, cu tot cu porții și listă.</T>
            <MealsPerDay value={settings.slots} onChange={(slots) => { setMealSlots(slots); success(); say(`Gata: ${slots.length} ${slots.length === 1 ? 'masă' : 'mese'} pe zi, în ținta ta de calorii.`); }} />
          </View>
        )}

        {showRecap && (
          <Pressable onPress={() => router.push('/recap')} style={[st.banner, { backgroundColor: t.primarySoft }]}>
            <T v="h3" color={t.primary} style={{ flex: 1 }}>Săptămâna trecută, pe scurt</T>
            <Icon name="chevron-forward" color={t.primary} />
          </Pressable>
        )}

        {!plan && <StartCard onSwipe={() => router.push('/bucatarii')} />}

        {plan && rows.length > 0 && (
          <View style={{ gap: 10 }}>
            <T v="h3">Mesele de azi</T>
            {rows.map((r) => r.kind === 'plan'
              ? <MealCard key={`p${r.meal.slot}`} row={r} next={r === next} mainId={main.id} plan={plan}
                  cooking={cookToday.some((c) => c.id === r.meal.sessionId)} onCheck={() => check(r)} onOpen={() => setOpen({ plan, meal: r.meal })} />
              : <ExtraCard key={r.entry.id} entry={r.entry} onRemove={() => { removeFood(r.entry.id); tick(); }} />)}
          </View>
        )}

        {cookToday.map((s) => {
          const r = RECIPE[s.recipeId];
          if (!r || !plan) return null;
          return (
            <Pressable key={s.id} onPress={() => router.push({ pathname: '/gatit/[id]', params: { id: r.id, portions: String(s.portions), planId: plan.id, sessionId: s.id } })}
              style={[st.banner, { backgroundColor: t.primarySoft }]}>
              <Icon name="flame" color={t.primary} size={22} />
              <T v="small" color={t.text} style={{ flex: 1 }}>Azi gătești {r.name.toLowerCase()}: {s.portions} porții, {r.prep} minute. Ajunge și pentru zilele următoare.</T>
              <Icon name="chevron-forward" color={t.primary} />
            </Pressable>
          );
        })}

        {needNext && (
          <Pressable onPress={() => router.push({ pathname: '/bucatarii', params: { start: nextMonday } })} style={[st.banner, { backgroundColor: t.primarySoft }]}>
            <View style={{ flex: 1 }}>
              <T v="h3" color={t.primary}>Ce mănânci săptămâna viitoare?</T>
              <T v="small" color={t.text}>Alege ce bucătării ai chef, iar planul și lista se fac singure.</T>
            </View>
            <Icon name="chevron-forward" color={t.primary} />
          </Pressable>
        )}

        {pantryOn && expiring.length > 0 && (
          <Pressable onPress={() => router.push({ pathname: '/lista', params: { tab: 'camara' } })} style={[st.banner, { backgroundColor: t.warnSoft }]}>
            <T v="small" color={t.text} style={{ flex: 1 }}>
              Se strică în curând: {expiring.slice(0, 3).map((p) => ING[p.ingId]?.name.toLowerCase()).join(', ')}{expiring.length > 3 ? ' și altele' : ''}.
            </T>
            <Icon name="chevron-forward" color={t.warn} />
          </Pressable>
        )}

        <Pressable onPress={() => router.push('/cheltuieli')} style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <T v="small">Cheltuit săptămâna asta</T>
          <T style={{ fontFamily: DISPLAY }}>{fmtRon(spentWeek)} <T v="small">din {fmtRon(settings.budgetRon)}</T></T>
        </Pressable>
      </ScrollView>

      {toast && (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 20, right: 20, bottom: 12 + Math.max(0, insets.bottom - 30) }}>
          <Toast text={toast.text} onUndo={toast.undo ? () => { toast.undo!(); tick(); setToast(null); } : undefined} />
        </View>
      )}

      <MealSheet open={open} mainId={main.id} onClose={() => setOpen(null)} />
    </SafeAreaView>
  );
}

/** ce mănâncă fiecare din casă azi: aceleași feluri, porții diferite; cine nu e acasă la o masă */
function FamilyDay({ plan, day, members, onOpen }: { plan: WeekPlan; day: number; members: Member[]; onOpen: (m: PlannedMeal) => void }) {
  const t = useTheme();
  const [who, setWho] = useState<string | null>(null);
  const meals = SLOT_ORDER.map((s) => plan.meals.find((m) => m.day === day && m.slot === s)).filter((m): m is PlannedMeal => !!m);
  const first = (m: Member) => m.name.trim().split(' ')[0] || 'Membru';
  const sel = members.find((m) => m.id === who);
  return (
    <View style={{ gap: 8 }}>
      <Row wrap gap={8}>
        <T v="small" style={{ fontWeight: '700' }}>Ce mănâncă azi</T>
        {members.filter((m) => !m.isMain).map((m) => (
          <Chip key={m.id} label={first(m)} icon="person" selected={m.id === who} onPress={() => { tick(); setWho(m.id === who ? null : m.id); }} />
        ))}
      </Row>
      {sel && (
        <View style={[st.card, { borderColor: t.border, backgroundColor: t.card, gap: 6 }]}>
          {meals.map((m) => {
            const sh = m.shares.find((x) => x.memberId === sel.id);
            return (
              <Pressable key={m.slot} onPress={() => onOpen(m)}>
                <T v="small">
                  <T v="small" style={{ fontWeight: '700' }}>{mealLabel(m.slot)}: </T>
                  {sh ? `${RECIPE[m.recipeId]?.name ?? ''}${sidesLabel(m) ? ` ${sidesLabel(m)}` : ''}, ${Math.round(mealMacros(m, sel.id).kcal)} kcal` : 'nu e acasă'}
                </T>
              </Pressable>
            );
          })}
          <T v="small" color={t.muted}>Aceleași feluri ca tine, în porția potrivită pentru {first(sel)}. Atinge o masă ca să vezi porțiile.</T>
        </View>
      )}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row gap={6}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <T v="small">{label}</T>
    </Row>
  );
}

/** o masă din plan: poza, ce e, cât are, și cercul pe care îl bifezi */
function MealCard({ row, next, cooking, mainId, plan, onOpen, onCheck }: {
  row: Extract<DayRow, { kind: 'plan' }>; next: boolean; cooking: boolean; mainId: string; plan: WeekPlan; onOpen: () => void; onCheck: () => void;
}) {
  const t = useTheme();
  const r = RECIPE[row.meal.recipeId];
  const f = row.meal.shares.find((x) => x.memberId === mainId)?.factor ?? 1;
  const kcal = Math.round(mealMacros(row.meal, mainId).kcal);
  const sidesTxt = sidesLabel(row.meal);
  const leftover = plan.sessions.find((s) => s.id === row.meal.sessionId)?.day !== row.meal.day;
  const label = mealLabel(row.meal.slot);
  const status = row.state === 'done' ? `${label}, mâncată` : row.state === 'replaced' ? `${label}, ai mâncat altceva`
    : row.state === 'skipped' ? `${label}, n-ai mâncat-o` : next ? `${label}, urmează` : label;
  const extra = cooking ? ', de gătit azi' : leftover ? (row.meal.frozen ? ', din congelator' : ', e deja gătită') : '';
  const dim = row.state === 'replaced' || row.state === 'skipped';
  return (
    <Squish onPress={onOpen} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: t.card, borderRadius: 18,
      borderWidth: next ? 2 : StyleSheet.hairlineWidth * 2, borderColor: next ? t.primary : t.border, padding: next ? 9 : 10, opacity: dim ? 0.55 : 1 }}>
      <FoodImage recipe={r} size={64} radius={14} />
      <View style={{ flex: 1, gap: 1 }}>
        <T v="small" color={row.state === 'done' ? t.accent : next ? t.primary : t.muted} style={{ fontWeight: '600' }}>{status}</T>
        <T numberOfLines={2} style={{ fontFamily: DISPLAY, fontSize: 16, textDecorationLine: dim ? 'line-through' : 'none' }}>{r?.name}</T>
        {sidesTxt ? <T v="small" numberOfLines={1} color={t.text}>{sidesTxt}</T> : null}
        <T v="small">{kcal.toLocaleString('ro-RO')} kcal{f !== 1 ? `, porția ×${nf(f)}` : ''}{extra}</T>
      </View>
      <CheckDot done={row.state === 'done'} active={next} onPress={onCheck} label={row.state === 'done' ? 'Nu am mâncat-o' : 'Am mâncat-o'} />
    </Squish>
  );
}

function ExtraCard({ entry, onRemove }: { entry: FoodLogEntry; onRemove: () => void }) {
  const t = useTheme();
  const r = entry.ref?.startsWith('r:') ? RECIPE[entry.ref.slice(2)] : undefined;
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: t.card, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.border, padding: 10 }}>
      {r ? <FoodImage recipe={r} size={52} radius={12} /> : (
        <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: t.arcMid, alignItems: 'center', justifyContent: 'center' }}><Icon name="restaurant" color="#fff" /></View>
      )}
      <View style={{ flex: 1 }}>
        <T numberOfLines={1} style={{ fontFamily: DISPLAY, fontSize: 16 }}>{entry.label}</T>
        <T v="small">{entry.approx ? '≈ ' : ''}{Math.round(entry.kcal).toLocaleString('ro-RO')} kcal, {entry.slot ? `${mealLabel(entry.slot).toLowerCase()}, ` : ''}notată de tine</T>
      </View>
      <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel="Șterge" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" color={t.muted} size={20} />
      </Pressable>
    </View>
  );
}

/** cercul din dreapta mesei: îl atingi și masa e notată, cu o mică săritură */
function CheckDot({ done, active, onPress, label }: { done: boolean; active: boolean; onPress: () => void; label: string }) {
  const t = useTheme();
  const scale = useState(() => new Animated.Value(1))[0];
  const fill = useState(() => new Animated.Value(done ? 1 : 0))[0];
  useEffect(() => {
    Animated.timing(fill, { toValue: done ? 1 : 0, duration: 180, useNativeDriver: false }).start();
    if (done) {
      scale.setValue(0.6);
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
    }
  }, [done]);
  const bg = fill.interpolate({ inputRange: [0, 1], outputRange: [t.bg, t.accent] });
  const border = fill.interpolate({ inputRange: [0, 1], outputRange: [active ? t.primary : t.muted, t.accent] });
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={label}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Animated.View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: border, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          {done && <Icon name="checkmark" size={22} color="#fff" />}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/** apăsare care se simte: cardul se strânge puțin sub deget */
function Squish({ onPress, style, children }: { onPress: () => void; style?: object; children: React.ReactNode }) {
  const s = useState(() => new Animated.Value(1))[0];
  const to = (v: number) => Animated.spring(s, { toValue: v, friction: 6, tension: 220, useNativeDriver: true }).start();
  return (
    <Pressable onPress={onPress} onPressIn={() => to(0.97)} onPressOut={() => to(1)}>
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** mesaj scurt deasupra butonului, cu „Anulează” */
function Toast({ text, onUndo }: { text: string; onUndo?: () => void }) {
  const t = useTheme();
  const y = useState(() => new Animated.Value(20))[0];
  const o = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    y.setValue(20); o.setValue(0);
    Animated.parallel([
      Animated.timing(y, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [text]);
  return (
    <Animated.View style={{ opacity: o, transform: [{ translateY: y }], marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: t.text, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 }}>
      <T color={t.bg} style={{ flex: 1 }} numberOfLines={2}>{text}</T>
      {onUndo && <Pressable onPress={onUndo} hitSlop={10}><T color={t.bg} style={{ fontFamily: DISPLAY, textDecorationLine: 'underline' }}>Anulează</T></Pressable>}
    </Animated.View>
  );
}

function StartCard({ onSwipe }: { onSwipe: () => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {HERO_IDS.map((id) => (
          <View key={id} style={{ width: '48.5%' }}><FoodImage recipe={RECIPE[id]} width="100%" height={120} radius={16} /></View>
        ))}
      </View>
      <T v="h1" style={{ fontFamily: DISPLAY_X }}>Ce mâncăm săptămâna asta?</T>
      <T color={t.muted}>Spune-mi ce bucătării ai chef săptămâna asta. Fac planul și lista de cumpărături, în bugetul tău.</T>
      <Btn title="Alege bucătăriile" icon="restaurant" onPress={onSwipe} />
    </View>
  );
}

const st = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18 },
  card: { gap: 10, padding: 16, borderRadius: 18, borderWidth: 1 },
});
