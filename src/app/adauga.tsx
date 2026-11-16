import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RECIPE } from '../data/recipes';
import { todayISO } from '../logic/dates';
import { computeTargets } from '../logic/energy';
import { amountLabel, foodFromRef, macrosFor, recentFoods, recipeOfEntry, searchFoods, type FoodItem } from '../logic/foods';
import { parseMealText } from '../logic/freeText';
import { perServing } from '../logic/nutrition';
import { mealLabel, SLOT_ORDER } from '../logic/planner';
import type { Slot } from '../logic/types';
import { eatenKey, ownedBy, planForDate, useActiveMember, useStore } from '../store/useStore';
import { success, tick } from '../ui/haptics';
import { Btn, Card, Chip, DISPLAY, DISPLAY_X, Divider, Field, FoodImage, Icon, IconBtn, IngImage, NumberField, Row, T, useTheme } from '../ui/kit';
import { Count, MealArc } from '../ui/MealArc';

type Mode = 'plan' | 'cauta';
const PORTIONS = [0.5, 1, 1.5, 2];
const fmtP = (p: number) => (p === 0.5 ? '½' : p === 1.5 ? '1½' : String(p).replace('.', ','));

/**
 * Adaugă o masă: din plan (cu porția și arcul care arată, înainte să confirmi, cât îți mai rămâne),
 * din poză, sau scriind normal („o shaorma mare și un ayran”).
 */
export default function AddFood() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ slot?: Slot; date?: string }>();
  const { settings, foodLog, favFoods, toggleFavFood, addFood, members, plans, toggleEaten } = useStore();
  const main = useActiveMember();
  const mainMemberId = members.find((m) => m.isMain)?.id;
  const dateISO = params.date ?? todayISO();
  const isToday = dateISO === todayISO();
  const slots = SLOT_ORDER.filter((s) => settings.slots.includes(s));
  const myLog = useMemo(() => foodLog.filter((f) => ownedBy(main?.id, mainMemberId, f.memberId)), [foodLog, main?.id, mainMemberId]);
  const recents = useMemo(() => recentFoods(myLog, 8), [myLog]);
  const favs = useMemo(() => favFoods.map((r) => foodFromRef(r)).filter(Boolean) as FoodItem[], [favFoods]);
  const [q, setQ] = useState('');
  const parsed = useMemo(() => parseMealText(q), [q]);
  const results = useMemo(() => searchFoods(q, 12), [q]);
  const [picked, setPicked] = useState<{ item: FoodItem; amount: number } | null>(null);
  const [quick, setQuick] = useState(false);

  const found = main ? planForDate(plans, dateISO) : undefined;
  const planMeals = found && main ? found.plan.meals
    .filter((m) => m.day === found.day && !found.plan.eaten.includes(eatenKey(main.id, m.day, m.slot)))
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)) : [];
  const [mode, setMode] = useState<Mode>(planMeals.length && !params.date ? 'plan' : 'cauta');
  const [selSlot, setSelSlot] = useState<Slot | undefined>(planMeals[0]?.slot);
  const sel = planMeals.find((m) => m.slot === selSlot) ?? planMeals[0];
  const planFactor = sel && main ? sel.shares.find((x) => x.memberId === main.id)?.factor ?? 1 : 1;
  const [portion, setPortion] = useState<number | null>(null);
  const por = portion ?? planFactor;
  const [slot, setSlot] = useState<Slot>(params.slot ?? planMeals[0]?.slot ?? slots[slots.length - 1] ?? 'cina');
  if (!main) return null;

  const tg = computeTargets(main);
  const dayLog = myLog.filter((f) => f.dateISO === dateISO);
  const pieces = dayLog.map((f) => ({ kcal: f.kcal, recipe: recipeOfEntry(f, plans), color: f.mealKey ? t.primary : t.arcMid }));
  const eatenK = pieces.reduce((a, p) => a + p.kcal, 0);
  const selKcal = sel ? perServing(RECIPE[sel.recipeId]).kcal * por : 0;
  const parsedKcal = parsed.reduce((a, p) => a + p.kcal, 0);
  const preview = mode === 'plan' ? selKcal : parsedKcal;
  const left = Math.round(tg.kcal - eatenK - preview);
  const portions = [...new Set([...PORTIONS, Math.round(planFactor * 4) / 4])].sort((a, b) => a - b);

  const add = (item: FoodItem, amount: number, approx?: boolean) => {
    const m = macrosFor(item, amount);
    addFood({
      memberId: main.id, dateISO, label: item.per === 'portie' && amount !== 1 ? `${item.name} (${amountLabel(item, amount)})` : item.name,
      kcal: m.kcal, p: m.p, c: m.c, f: m.f, fib: m.fib, sug: m.sug, salt: m.salt, slot, ref: item.ref, g: amount, approx,
    });
  };
  const done = () => { success(); router.back(); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.card }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="h1">{isToday ? 'Adaugă o masă' : 'Ce ai mâncat ieri?'}</T>
            <IconBtn icon="close" onPress={() => router.back()} />
          </Row>

          {/* arcul în mic: bucata transparentă e masa pe care o adaugi acum */}
          <Row gap={14} style={{ backgroundColor: t.bg, borderRadius: 18, padding: 12 }}>
            <MealArc target={tg.kcal} pieces={pieces} preview={preview} size={132} stroke={14} center={false} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="small">{preview > 0 ? 'După masa asta' : isToday ? 'Azi' : 'Ieri'}</T>
              <Count value={Math.abs(left)} size={30} color={left < 0 ? t.warn : t.text} />
              <T v="small">{left < 0 ? 'kcal peste țintă' : preview > 0 ? `kcal îți mai rămân${isToday ? ' azi' : ''}` : 'kcal rămase'}</T>
            </View>
          </Row>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {planMeals.length > 0 && <ModeTile icon="calendar-outline" label="Din plan" on={mode === 'plan'} onPress={() => setMode('plan')} />}
            <ModeTile icon="camera-outline" label="Fă o poză" on={false} onPress={() => router.replace({ pathname: '/scanare', params: { mode: 'farfurie' } })} />
            <ModeTile icon="search" label="Scrie" on={mode === 'cauta'} onPress={() => setMode('cauta')} />
          </View>

          {mode === 'plan' && sel ? (
            <View style={{ gap: 10 }}>
              {planMeals.map((m) => {
                const r = RECIPE[m.recipeId];
                const on = m.slot === sel.slot;
                return (
                  <Pressable key={m.slot} onPress={() => { setSelSlot(m.slot); setPortion(null); tick(); }} accessibilityState={{ selected: on }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: on ? 7 : 8, borderRadius: 16, backgroundColor: t.card,
                      borderWidth: on ? 2 : StyleSheet.hairlineWidth * 2, borderColor: on ? t.primary : t.border }}>
                    <FoodImage recipe={r} size={56} radius={12} />
                    <View style={{ flex: 1 }}>
                      <T v="small">{mealLabel(m.slot)} din plan</T>
                      <T numberOfLines={2} style={{ fontFamily: DISPLAY, fontSize: 16 }}>{r?.name}</T>
                    </View>
                    <T v="small">{Math.round(perServing(r).kcal).toLocaleString('ro-RO')} / porție</T>
                  </Pressable>
                );
              })}
              <T v="h3" style={{ marginTop: 4 }}>Cât ai mâncat</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {portions.map((p) => {
                  const on = Math.abs(p - por) < 0.01;
                  return (
                    <Pressable key={p} onPress={() => { setPortion(p); tick(); }} accessibilityState={{ selected: on }}
                      style={{ flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.ink : t.card,
                        borderWidth: on ? 0 : StyleSheet.hairlineWidth * 2, borderColor: t.border }}>
                      <T style={{ fontFamily: DISPLAY_X, fontSize: 17 }} color={on ? t.bg : t.text}>{fmtP(p)}</T>
                      {Math.abs(p - planFactor) < 0.01 && <T style={{ fontSize: 10 }} color={on ? t.bg : t.muted}>din plan</T>}
                    </Pressable>
                  );
                })}
              </View>
              <Btn title={`Adaugă masa, ${Math.round(selKcal).toLocaleString('ro-RO')} kcal`} icon="add"
                onPress={() => { toggleEaten(found!.plan.id, sel.day, sel.slot, false, por); done(); }} />
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <Field value={q} onChangeText={setQ} placeholder="ex. o shaorma mare și un ayran" icon="create-outline" autoFocus={!planMeals.length} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {slots.map((s) => <Chip key={s} label={mealLabel(s)} selected={slot === s} onPress={() => setSlot(s)} />)}
              </ScrollView>

              {parsed.length > 0 && (
                <Card style={{ gap: 8 }}>
                  <T v="small">Am înțeles așa:</T>
                  {parsed.map((x, i) => (
                    <Row key={i} gap={12}>
                      <FoodThumb item={x.item} size={40} />
                      <View style={{ flex: 1 }}>
                        <T numberOfLines={1} style={{ fontWeight: '700' }}>{x.item.name}</T>
                        <T v="small">{amountLabel(x.item, x.amount)}</T>
                      </View>
                      <T style={{ fontFamily: DISPLAY }}>≈ {x.kcal.toLocaleString('ro-RO')}</T>
                    </Row>
                  ))}
                  <Btn title={`Adaugă, ≈ ${parsedKcal.toLocaleString('ro-RO')} kcal`} icon="add" onPress={() => { parsed.forEach((x) => add(x.item, x.amount, true)); done(); }} />
                </Card>
              )}

              {q.trim().length >= 2 ? (
                results.length > 0 && <List title="Sau alege exact" items={results.map((item) => ({ item, amount: item.amount }))} onPick={setPicked} />
              ) : (
                <>
                  {favs.length > 0 && <List title="Favorite" items={favs.map((item) => ({ item, amount: item.amount }))} onPick={setPicked} onQuickAdd={(x) => { add(x.item, x.amount); done(); }} />}
                  {recents.length > 0 && <List title="Mâncate des" items={recents} onPick={setPicked} onQuickAdd={(x) => { add(x.item, x.amount); done(); }} />}
                </>
              )}

              <Row>
                <Btn title="Cod de bare" icon="barcode" variant="secondary" small style={{ flex: 1 }} onPress={() => router.replace({ pathname: '/scanare', params: { mode: 'cod' } })} />
                <Btn title="Doar calorii" icon="create" variant="secondary" small style={{ flex: 1 }} onPress={() => setQuick(true)} />
              </Row>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <AmountSheet value={picked} onClose={() => setPicked(null)} fav={!!picked && favFoods.includes(picked.item.ref)}
        onFav={() => picked && toggleFavFood(picked.item.ref)}
        onAdd={(amount) => { if (picked) add(picked.item, amount); setPicked(null); done(); }} />
      <QuickKcal visible={quick} onClose={() => setQuick(false)} onAdd={(label, kcal, p) => {
        addFood({ memberId: main.id, dateISO, label, kcal, p, c: 0, f: 0, slot, approx: true });
        setQuick(false); done();
      }} />
    </SafeAreaView>
  );
}

function ModeTile({ icon, label, on, onPress }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }}
      style={({ pressed }) => ({ flex: 1, height: 74, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: on ? t.primarySoft : t.card, borderWidth: on ? 2 : StyleSheet.hairlineWidth * 2, borderColor: on ? t.primary : t.border,
        transform: [{ scale: pressed ? 0.96 : 1 }] })}>
      <Icon name={icon} size={24} color={on ? t.primary : t.text} />
      <T style={{ fontFamily: DISPLAY, fontSize: 14 }} color={on ? t.primary : t.text}>{label}</T>
    </Pressable>
  );
}

function FoodThumb({ item, size = 46 }: { item: FoodItem; size?: number }) {
  const t = useTheme();
  if (item.recipeId) return <FoodImage recipe={RECIPE[item.recipeId]} size={size} radius={14} />;
  if (item.ingId) return <IngImage id={item.ingId} size={size} />;
  return (
    <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: t.warnSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="fast-food" color={t.warn} size={size * 0.45} />
    </View>
  );
}

function List({ title, items, onPick, onQuickAdd }: {
  title: string; items: { item: FoodItem; amount: number }[]; onPick: (x: { item: FoodItem; amount: number }) => void;
  onQuickAdd?: (x: { item: FoodItem; amount: number }) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <T v="label">{title}</T>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {items.map((x, i) => {
          const m = macrosFor(x.item, x.amount);
          return (
            <View key={x.item.ref + i}>
              {i > 0 && <Divider />}
              <Pressable onPress={() => onPick(x)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
                <FoodThumb item={x.item} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '700' }} numberOfLines={1}>{x.item.name}</T>
                  <T v="small">{amountLabel(x.item, x.amount)} · {Math.round(m.kcal)} kcal · {Math.round(m.p)} g prot.</T>
                </View>
                {onQuickAdd
                  ? <IconBtn icon="add" size={34} tone="primary" onPress={() => onQuickAdd(x)} />
                  : <Icon name="chevron-forward" color={t.muted} size={18} />}
              </Pressable>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

function AmountSheet({ value, onClose, onAdd, fav, onFav }: {
  value: { item: FoodItem; amount: number } | null; onClose: () => void; onAdd: (amount: number) => void; fav: boolean; onFav: () => void;
}) {
  const t = useTheme();
  const [amount, setAmount] = useState(1);
  React.useEffect(() => { if (value) setAmount(value.amount); }, [value]);
  if (!value) return null;
  const { item } = value;
  const m = macrosFor(item, amount);
  const portion = item.per === 'portie';
  const presets = portion ? [0.5, 1, 1.5, 2] : item.piece ? [1, 2, 3, 4].map((k) => k * item.piece!) : [50, 100, 150, 200, 300];
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable style={{ backgroundColor: t.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 14, paddingBottom: 34 }}>
          <Row gap={12}>
            <FoodThumb item={item} size={60} />
            <View style={{ flex: 1 }}>
              <T v="h2" numberOfLines={2}>{item.name}</T>
              <T v="small">{portion ? (item.portionG ? `1 porție ≈ ${item.portionG} g` : 'porția din rețetă') : 'valori la 100 g'}</T>
            </View>
            <IconBtn icon={fav ? 'star' : 'star-outline'} color={fav ? t.warn : t.muted} onPress={onFav} />
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            {([['kcal', m.kcal, t.primary], ['proteine', m.p, t.protein], ['carbo', m.c, t.carbs], ['grăsimi', m.f, t.fat]] as const).map(([l, v, c]) => (
              <View key={l} style={{ alignItems: 'center' }}>
                <T v="h2" color={c}>{Math.round(v)}</T>
                <T v="small">{l === 'kcal' ? 'kcal' : `g ${l}`}</T>
              </View>
            ))}
          </Row>
          <NumberField value={amount} onChange={setAmount} step={portion ? 0.25 : item.piece ?? 10} min={portion ? 0.25 : 1} max={portion ? 10 : 5000}
            decimals={portion ? 2 : 0} suffix={portion ? 'porții' : 'g'} />
          <Row wrap gap={8}>
            {presets.map((p) => <Chip key={p} label={portion ? `${String(p).replace('.', ',')}×` : item.piece ? `${p / item.piece!} buc.` : `${p} g`} selected={amount === p} onPress={() => setAmount(p)} />)}
          </Row>
          <Btn title={`Adaugă ${Math.round(m.kcal)} kcal`} icon="add" onPress={() => onAdd(amount)} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function QuickKcal({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (label: string, kcal: number, p: number) => void }) {
  const t = useTheme();
  const [label, setLabel] = useState('');
  const [kcal, setKcal] = useState(300);
  const [p, setP] = useState(0);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable style={{ backgroundColor: t.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 14, paddingBottom: 34 }}>
          <T v="h2">Doar calorii</T>
          <Field value={label} onChangeText={setLabel} placeholder="Ce ai mâncat (ex. covrig)" />
          <NumberField label="Calorii" value={kcal} onChange={setKcal} step={25} min={0} max={5000} suffix="kcal" />
          <NumberField label="Proteine (dacă știi)" value={p} onChange={setP} step={1} min={0} max={300} suffix="g" />
          <Btn title="Adaugă" icon="add" disabled={kcal <= 0} onPress={() => { onAdd(label.trim() || 'Altceva', kcal, p); setLabel(''); }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
