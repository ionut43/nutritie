import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RECIPE } from '../../data/recipes';
import { addDays, DAY_NAMES, fmtDate, fromISO, todayISO, toISO, weekdayMon } from '../../logic/dates';
import { fastInfo } from '../../logic/fasting';
import { fmtRon } from '../../logic/format';
import { BUDGET_SLACK, MAIN_SLOTS, mealLabel, SLOT_ORDER } from '../../logic/planner';
import { STORE } from '../../logic/stores';
import type { PlannedMeal, WeekHousehold, WeekPlan } from '../../logic/types';
import { planForDate, useActiveMember, useStore } from '../../store/useStore';
import { ToggleRow } from '../../ui/forms';
import { Btn, Chip, DISPLAY, FoodImage, Icon, NumberField, Progress, Row, Segmented, T, useTheme } from '../../ui/kit';
import { MealSheet } from '../../ui/MealSheet';

/** Săptămâna: zilele una sub alta, cu pozele meselor. Fără tabele, fără cifre în plus. */
export default function WeekScreen() {
  const t = useTheme();
  const router = useRouter();
  const { plans } = useStore();
  const today = todayISO();
  const current = planForDate(plans, today)?.plan;
  const upcoming = Object.values(plans).filter((p) => p.startISO > today).sort((a, b) => a.startISO.localeCompare(b.startISO));
  const viewable = [current, ...upcoming].filter(Boolean) as WeekPlan[];
  const [viewId, setViewId] = useState<string | undefined>();
  const plan = viewable.find((p) => p.id === viewId) ?? viewable[0];
  const [newWeek, setNewWeek] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 20 }} showsVerticalScrollIndicator={false}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <T v="h1">Săptămâna</T>
            {plan && !newWeek ? <T v="small">{fmtDate(fromISO(plan.startISO))} – {fmtDate(addDays(fromISO(plan.startISO), 6))}</T> : null}
          </View>
        </Row>

        {viewable.length > 1 && !newWeek && (
          <Segmented options={viewable.slice(0, 2).map((p, i) => ({ label: i === 0 && p === current ? 'Săptămâna asta' : `De la ${fmtDate(fromISO(p.startISO))}`, value: p.id }))}
            value={plan!.id} onChange={setViewId} />
        )}

        {(!plan || newWeek) && <NewWeek defaultStart={plan ? toISO(addDays(fromISO(plan.startISO), 7)) : today} onCancel={plan ? () => setNewWeek(false) : undefined} />}
        {plan && !newWeek && <WeekView plan={plan} onNew={() => setNewWeek(true)} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function NewWeek({ defaultStart, onCancel }: { defaultStart: string; onCancel?: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const { members, settings, plans, generate } = useStore();
  const today = todayISO();
  const [start, setStart] = useState(defaultStart < today ? today : defaultStart);
  const lastHh = Object.values(plans).sort((a, b) => b.startISO.localeCompare(a.startISO))[0]?.household;
  const [ids, setIds] = useState<string[]>(lastHh?.memberIds.filter((id) => members.some((m) => m.id === id)) ?? members.map((m) => m.id));
  const [guests, setGuests] = useState(0);
  const [applyFasting, setApplyFasting] = useState(true);
  const [more, setMore] = useState(false);
  const startOpts = Array.from({ length: 10 }, (_, i) => toISO(addDays(fromISO(today), i)));
  const fastDays = useMemo(() => Array.from({ length: 7 }, (_, d) => fastInfo(addDays(fromISO(start), d), settings.fasting, settings.fishOnDispensation)).filter((f) => f.level !== 'none').length, [start, settings]);
  const hh: WeekHousehold = { memberIds: ids.length ? ids : members.map((m) => m.id), guests, applyFasting };

  return (
    <View style={{ gap: 16 }}>
      <T color={t.muted}>Alegi ce bucătării ai chef, iar eu pun mâncarea pe zile, în bugetul de {fmtRon(settings.budgetRon)}, și fac lista pentru {STORE[settings.mainStore ?? 'lidl'].name}.</T>
      <Btn title="Alege bucătăriile" icon="restaurant" onPress={() => router.push({
        pathname: '/bucatarii', params: { start, ids: hh.memberIds.join(','), guests: String(guests), fast: applyFasting ? '1' : '0' },
      })} />
      <Btn title="Fă-l tu, fără întrebări" variant="secondary" onPress={() => { generate(start, hh, undefined, undefined, settings.lastWeekCuisines ? { cuisines: settings.lastWeekCuisines } : undefined); onCancel?.(); }} />
      <Pressable onPress={() => setMore(!more)} hitSlop={8}>
        <Row gap={6}>
          <Icon name={more ? 'chevron-up' : 'chevron-down'} color={t.muted} size={16} />
          <T v="small">Începe {start === today ? 'de azi' : `de ${DAY_NAMES[weekdayMon(fromISO(start))].toLowerCase()}`}{members.length > 1 ? `, pentru ${hh.memberIds.length} persoane` : ''}{guests ? ` și ${guests} musafiri` : ''}</T>
        </Row>
      </Pressable>
      {more && (
        <View style={{ gap: 14 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {startOpts.map((iso) => {
              const d = fromISO(iso);
              return <Chip key={iso} label={iso === today ? 'Azi' : `${DAY_NAMES[weekdayMon(d)].slice(0, 3)} ${d.getDate()}`} selected={iso === start} onPress={() => setStart(iso)} />;
            })}
          </ScrollView>
          {members.length > 1 && (
            <Row wrap>
              {members.map((m) => (
                <Chip key={m.id} label={m.name} selected={ids.includes(m.id)}
                  onPress={() => setIds((x) => (x.includes(m.id) ? (m.isMain && x.length === 1 ? x : x.filter((y) => y !== m.id)) : [...x, m.id]))} />
              ))}
            </Row>
          )}
          <NumberField label="Musafiri toată săptămâna" value={guests} onChange={setGuests} min={0} max={20} suffix="pers." />
          {settings.fasting !== 'niciunul' && (
            <ToggleRow title="Respectă postul" desc={fastDays ? `${fastDays} zile de post în perioada asta.` : 'Nicio zi de post în perioada asta.'} value={applyFasting} onChange={setApplyFasting} />
          )}
          <Pressable onPress={() => router.push('/setari')}><T v="small" color={t.primary} style={{ fontWeight: '700' }}>Zilele de gătit, mesele pe zi și bugetul se schimbă din Setări</T></Pressable>
        </View>
      )}
      {onCancel && <Btn title="Înapoi la săptămâna curentă" variant="ghost" small onPress={onCancel} />}
    </View>
  );
}

function WeekView({ plan, onNew }: { plan: WeekPlan; onNew: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const { generate, deletePlan, settings } = useStore();
  const main = useActiveMember();
  const [open, setOpen] = useState<PlannedMeal | null>(null);
  const [showWarn, setShowWarn] = useState(false);
  const store = plan.store ?? settings.mainStore ?? 'lidl';
  const start = fromISO(plan.startISO);
  const over = plan.cost > plan.budget + BUDGET_SLACK;
  const cookDays = new Set(plan.sessions.filter((x) => plan.meals.some((m) => m.sessionId === x.id && MAIN_SLOTS.includes(m.slot))).map((x) => x.day)).size;
  const lockedList = (plan.locked ?? []).map((k) => {
    const [d, slot] = k.split('|');
    const m = plan.meals.find((x) => x.day === Number(d) && x.slot === slot);
    return m ? { day: m.day, slot: m.slot, recipeId: m.recipeId } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <View style={{ gap: 22 }}>
      {/* banii, într-o frază, și drumul spre listă */}
      <Pressable onPress={() => router.push({ pathname: '/lista', params: { tab: 'lista' } })} style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <T v="big">{fmtRon(plan.cost)}</T>
            <T v="small" color={plan.cost > plan.budget ? t.warn : undefined}>la {STORE[store].name}, {plan.cost > plan.budget ? `cu ${fmtRon(plan.cost - plan.budget)} peste bugetul de ${fmtRon(plan.budget)}` : `din bugetul de ${fmtRon(plan.budget)}`}</T>
          </View>
          <Row gap={4}><T style={{ fontFamily: DISPLAY, color: t.primary }}>Lista</T><Icon name="chevron-forward" color={t.primary} size={18} /></Row>
        </Row>
        <Progress value={plan.cost} max={plan.budget} height={6} color={plan.cost > plan.budget ? t.warn : t.accent} />
        <T v="small">Gătești de {cookDays} {cookDays === 1 ? 'dată' : 'ori'} săptămâna asta{plan.locked?.length ? `, ${plan.locked.length} ${plan.locked.length === 1 ? 'masă fixată' : 'mese fixate'} cu lacătul` : ''}.</T>
      </Pressable>

      {plan.warnings.length > 0 && (
        <Pressable onPress={() => setShowWarn(!showWarn)} style={{ gap: 6 }}>
          <Row gap={6}>
            <Icon name="information-circle-outline" color={t.muted} size={18} />
            <T v="small" style={{ flex: 1 }}>{plan.warnings.length === 1 ? 'Un lucru de știut despre planul ăsta' : `${plan.warnings.length} lucruri de știut despre planul ăsta`}</T>
            <Icon name={showWarn ? 'chevron-up' : 'chevron-down'} color={t.muted} size={16} />
          </Row>
          {showWarn && plan.warnings.map((w) => <T key={w} v="small" color={t.text}>{w}</T>)}
        </Pressable>
      )}

      {Array.from({ length: 7 }, (_, d) => {
        const date = addDays(start, d);
        const iso = toISO(date);
        const isToday = iso === todayISO();
        const meals = plan.meals.filter((m) => m.day === d).sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
        const mains = meals.filter((m) => MAIN_SLOTS.includes(m.slot));
        const small = meals.filter((m) => !MAIN_SLOTS.includes(m.slot));
        const cooks = plan.sessions.filter((s) => s.day === d && plan.meals.filter((m) => m.sessionId === s.id && MAIN_SLOTS.includes(m.slot)).length > 0 && !s.extra);
        const fast = plan.fastDays[d] !== 'none';
        return (
          <View key={d} style={{ gap: 10 }}>
            <Row style={{ alignItems: 'baseline' }} gap={8}>
              <T v="h2" color={isToday ? t.primary : t.text}>{isToday ? 'Azi' : DAY_NAMES[weekdayMon(date)]}</T>
              <T v="small">{date.getDate()}{cooks.length ? ', gătești' : ''}{fast ? ', zi de post' : ''}</T>
            </Row>
            <Row gap={10} style={{ alignItems: 'flex-start' }}>
              {mains.map((m) => {
                const r = RECIPE[m.recipeId];
                const fresh = cooks.some((c) => c.id === m.sessionId);
                const isLocked = plan.locked?.includes(`${m.day}|${m.slot}`);
                return (
                  <Pressable key={m.slot} onPress={() => setOpen(m)} style={{ flex: 1, gap: 6 }}>
                    <View>
                      <FoodImage recipe={r} width="100%" height={118} radius={16} />
                      {fresh && <View style={{ position: 'absolute', left: 8, top: 8, backgroundColor: t.heat, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                        <T v="small" color="#fff" style={{ fontFamily: DISPLAY, fontSize: 12 }}>se gătește</T>
                      </View>}
                      {isLocked && <View style={{ position: 'absolute', right: 8, top: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: t.ink, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="lock-closed" size={15} color={t.bg} />
                      </View>}
                    </View>
                    <T v="small" color={t.muted} style={{ fontSize: 12 }}>{mealLabel(m.slot)}</T>
                    <T numberOfLines={2} style={{ fontWeight: '600', fontSize: 14, lineHeight: 18, marginTop: -4 }}>{r?.name}</T>
                  </Pressable>
                );
              })}
            </Row>
            {small.length > 0 && (
              <T v="small">
                {small.map((m, i) => (
                  <T key={m.slot} v="small" onPress={() => setOpen(m)}>{i > 0 ? '; ' : ''}{mealLabel(m.slot).toLowerCase()}: <T v="small" color={t.text}>{RECIPE[m.recipeId]?.name.toLowerCase()}</T></T>
                ))}
              </T>
            )}
          </View>
        );
      })}

      <View style={{ gap: 4, marginTop: 6 }}>
        <Btn title="Plan pentru săptămâna următoare" variant="secondary" onPress={onNew} />
        <Row style={{ justifyContent: 'center', gap: 22, marginTop: 6 }}>
          <Pressable hitSlop={8} onPress={() => Alert.alert('Alte mâncăruri?', lockedList.length
            ? `Păstrez bucătăriile și cele ${lockedList.length} mese fixate cu lacătul, restul se schimbă. Lista de cumpărături se reface.`
            : 'Păstrez bucătăriile alese și schimb mâncărurile. Ca să păstrezi o masă, atinge-o și pune lacătul. Lista de cumpărături se reface.', [
            { text: 'Nu', style: 'cancel' },
            { text: 'Da', onPress: () => generate(plan.startISO, plan.household, undefined, plan.store, { wanted: plan.wanted, cuisines: plan.cuisines, locked: lockedList }) },
          ])}><T v="small" color={t.primary} style={{ fontWeight: '700' }}>Alte mâncăruri</T></Pressable>
          <Pressable hitSlop={8} onPress={() => Alert.alert('Ștergi planul?', '', [
            { text: 'Nu', style: 'cancel' }, { text: 'Șterge', style: 'destructive', onPress: () => deletePlan(plan.id) },
          ])}><T v="small" color={t.muted} style={{ fontWeight: '700' }}>Șterge planul</T></Pressable>
        </Row>
      </View>

      {main && <MealSheet open={open ? { plan, meal: open } : null} mainId={main.id} onClose={() => setOpen(null)} />}
    </View>
  );
}
