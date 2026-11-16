import { useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { RECIPE } from '../data/recipes';
import { addDays, fmtDate, fromISO, todayISO, toISO, weekdayMon } from '../logic/dates';
import { computeTargets } from '../logic/energy';
import { fmtRon, nf } from '../logic/format';
import { weekRecap } from '../logic/recap';
import { ownedBy, useActiveMember, useStore } from '../store/useStore';
import { Btn, Card, FoodImage, Icon, type IconName, Row, Screen, T, useTheme } from '../ui/kit';
import { StoreBadge } from '../ui/shared';

/** Rezumatul săptămânii trecute: fără vinovăție, doar ce s-a întâmplat */
export default function RecapScreen() {
  const t = useTheme();
  const router = useRouter();
  const { foodLog, plans, spend, weightLog, mealRatings, settings, members, markRecap } = useStore();
  const main = useActiveMember();
  const mainId = members.find((m) => m.isMain)?.id;
  const monday = addDays(fromISO(todayISO()), -weekdayMon(new Date()));
  const start = toISO(addDays(monday, -7));
  const r = useMemo(() => weekRecap(
    start,
    foodLog.filter((f) => ownedBy(main?.id, mainId, f.memberId)),
    Object.values(plans), spend,
    weightLog.filter((w) => ownedBy(main?.id, mainId, w.memberId)),
    mealRatings,
  ), [start, foodLog, plans, spend, weightLog, mealRatings, main?.id, mainId]);
  useEffect(() => { markRecap(toISO(monday)); }, []);
  if (!main) return null;
  const tg = computeTargets(main);
  const kcalOk = r.daysLogged > 0 && Math.abs(r.avgKcal - tg.kcal) <= tg.kcal * 0.1;

  return (
    <Screen edges={['top', 'bottom']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <T v="label">Săptămâna {fmtDate(fromISO(start))} – {fmtDate(addDays(fromISO(start), 6))}</T>
          <T v="h1">Rezumatul tău</T>
        </View>
        <Pressable onPress={() => router.back()}><Icon name="close" size={26} /></Pressable>
      </Row>

      <Card tone="ink" style={{ gap: 6, padding: 22 }}>
        <T v="label" color={t.muted}>Ai notat ce ai mâncat</T>
        <T v="hero" color={t.bg}>{r.daysLogged} <T v="h2" color={t.muted}>din 7 zile</T></T>
        <T v="small" color={t.muted}>{r.daysLogged >= 5 ? 'Foarte bine. Cu cât notezi mai des, cu atât calculul e mai precis.' : r.daysLogged > 0 ? 'Fiecare zi notată ajută. Butonul + de pe ecranul Azi e cel mai rapid.' : 'Săptămâna asta n-ai notat nimic. Nu-i nimic, începe de azi.'}</T>
      </Card>

      <Row gap={12}>
        <Big icon="flame" color={kcalOk ? t.accent : t.primary} label="kcal pe zi în medie" value={r.daysLogged ? `${Math.round(r.avgKcal)}` : '–'} sub={`ținta ${tg.kcal}`} />
        <Big icon="barbell" color={t.protein} label="proteine pe zi" value={r.daysLogged ? `${Math.round(r.avgProtein)} g` : '–'} sub={`ținta ${tg.protein} g`} />
      </Row>
      <Row gap={12}>
        <Big icon="restaurant" color={t.primary} label="mese din plan" value={`${r.mealsFromPlan}`} sub={`${r.cooked} gătiri`} />
        <Big icon="scale" color={t.accent} label="greutate" value={r.weightDelta == null ? '–' : `${r.weightDelta > 0 ? '+' : ''}${nf(r.weightDelta)} kg`} sub="față de săptămâna dinainte" />
      </Row>

      <Card style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="h3">Cheltuieli</T>
          <T v="h2" color={r.spent > settings.budgetRon ? t.danger : t.accent}>{fmtRon(r.spent)}</T>
        </Row>
        <T v="small">{r.spent === 0 ? 'Nicio cumpărătură notată. Scanează bonul sau confirmă suma când bifezi lista.' : r.spent <= settings.budgetRon ? `Cu ${fmtRon(settings.budgetRon - r.spent)} sub buget.` : `Cu ${fmtRon(r.spent - settings.budgetRon)} peste buget.`}</T>
        {r.byStore.length > 0 && (
          <Row wrap gap={8}>
            {r.byStore.map((s) => <Row key={s.store} gap={6}><StoreBadge id={s.store} small /><T v="small" style={{ fontWeight: '700' }}>{fmtRon(s.amount)}</T></Row>)}
          </Row>
        )}
      </Card>

      {r.newRecipes.length > 0 && (
        <Card style={{ gap: 10 }}>
          <T v="h3">{r.newRecipes.length} {r.newRecipes.length === 1 ? 'rețetă nouă încercată' : 'rețete noi încercate'}</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {r.newRecipes.filter((id) => RECIPE[id]).map((id) => (
              <View key={id} style={{ width: 96, gap: 4 }}>
                <FoodImage recipe={RECIPE[id]} size={96} radius={16} />
                <T v="small" numberOfLines={2} style={{ fontSize: 11 }}>{RECIPE[id].name}</T>
              </View>
            ))}
          </ScrollView>
        </Card>
      )}

      {r.topRecipe && RECIPE[r.topRecipe] && (
        <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <FoodImage recipe={RECIPE[r.topRecipe]} size={64} radius={16} />
          <View style={{ flex: 1 }}>
            <T v="label" color={t.accent}>Ți-a plăcut</T>
            <T v="h3">{RECIPE[r.topRecipe].name}</T>
            <T v="small">O să apară mai des în planuri.</T>
          </View>
        </Card>
      )}

      <Btn title="Fă planul săptămânii" icon="sparkles" onPress={() => { router.back(); router.push('/plan'); }} />
    </Screen>
  );
}

function Big({ icon, color, label, value, sub }: { icon: IconName; color: string; label: string; value: string; sub: string }) {
  return (
    <Card style={{ flex: 1, gap: 4 }}>
      <Icon name={icon} color={color} size={22} />
      <T v="h2">{value}</T>
      <T v="small">{label}</T>
      <T v="small" style={{ fontSize: 11 }}>{sub}</T>
    </Card>
  );
}
