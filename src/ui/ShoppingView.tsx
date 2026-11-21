import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { AISLE_LABEL, AISLE_ORDER, ING } from '../data/ingredients';
import { addDays, fmtDate, fromISO, todayISO, toISO, weekdayMon } from '../logic/dates';
import { fmtPackage, fmtQty, fmtRon } from '../logic/format';
import { compareStores, learnedCount, priceAt, STORE, type StoreId } from '../logic/stores';
import { foodSpent, type ShoppingItem } from '../logic/types';
import { useFeature, useStore } from '../store/useStore';
import { Btn, Card, Chip, DISPLAY, DISPLAY_X, Empty, Icon, IconBtn, NumberField, Pill, Row, Section, T, useTheme } from './kit';
import { success, tick } from './haptics';
import { LivePricesCard } from './LivePricesCard';
import { StoreBadge } from './shared';

export function ShoppingView() {
  const t = useTheme();
  const router = useRouter();
  const { plans, toggleShopItem, buyItems, addPantry, settings, prices, storePrices, setPlanStore, spend, toggleBasic } = useStore();
  const today = todayISO();
  const active = Object.values(plans)
    .filter((p) => toISO(addDays(fromISO(p.startISO), 6)) >= today)
    .sort((a, b) => a.startISO.localeCompare(b.startISO));
  const [sel, setSel] = useState<string | undefined>();
  const [storePick, setStorePick] = useState(false);
  const [paying, setPaying] = useState<{ ids: string[]; est: number } | null>(null);
  const [done, setDone] = useState<number | null | undefined>(undefined);
  const [shopMode, setShopMode] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const pricesOn = useFeature('preturi');
  const plan = active.find((p) => p.id === sel) ?? active.find((p) => p.shopping.some((s) => s.packages > 0)) ?? active[0];

  const monday = toISO(addDays(fromISO(today), -weekdayMon(new Date())));
  const spentWeek = spend.filter((s) => s.dateISO >= monday).reduce((a, s) => a + foodSpent(s), 0);

  if (!plan) {
    return (
      <Card>
        <Empty icon="basket" title="Nicio listă încă" text="Lista se face automat din planul săptămânii, la magazinul tău."
          action={<Btn title="Fă planul" icon="sparkles" onPress={() => router.push('/plan')} />} />
      </Card>
    );
  }

  const store: StoreId = plan.store ?? settings.mainStore ?? 'lidl';
  const myStores = (settings.stores?.length ? settings.stores : [store]).includes(store) ? (settings.stores ?? [store]) : [...(settings.stores ?? []), store];
  const items = plan.shopping.filter((s) => s.packages > 0);
  const fromPantryOnly = plan.shopping.filter((s) => s.packages === 0 && s.fromPantryG > 0);
  const priceOf = (s: ShoppingItem) => s.packages * priceAt(s.ingId, store, prices, storePrices);
  const checked = items.filter((s) => s.checked);
  const todo = items.filter((s) => !s.checked);
  const total = items.reduce((a, s) => a + priceOf(s), 0);
  const inCart = checked.reduce((a, s) => a + priceOf(s), 0);
  const byAisle = AISLE_ORDER.map((a) => ({ a, list: todo.filter((s) => ING[s.ingId]?.aisle === a) })).filter((x) => x.list.length);
  const cmp = compareStores(items, myStores, prices, storePrices);
  const cheapest = cmp[0];
  const known = learnedCount(store, storePrices);

  const shareList = () => {
    const all = AISLE_ORDER.map((a) => ({ a, list: items.filter((s) => ING[s.ingId]?.aisle === a) })).filter((x) => x.list.length);
    const lines = all.map(({ a, list }) => `${AISLE_LABEL[a]}:\n${list.map((s) => `${s.checked ? '✓' : '☐'} ${ING[s.ingId].name} – ${fmtPackage(s.ingId, s.packages)}`).join('\n')}`);
    Share.share({ message: `Cumpărături la ${STORE[store].name} (${fmtDate(fromISO(plan.startISO))}):\n\n${lines.join('\n\n')}\n\nTotal estimat: ${fmtRon(total)}` });
  };
  const toggle = (id: string) => { tick(); toggleShopItem(plan.id, id); };

  return (
    <View style={{ gap: 16 }}>
      {shopMode && <KeepAwake />}
      {done !== undefined && (
        <Card tone="accent" onPress={() => setDone(undefined)} style={{ gap: 6, padding: 18 }}>
          <Row gap={10}><Icon name="checkmark-done-circle" color={t.accent} size={30} /><T v="h2">Cumpărături gata</T></Row>
          <T color={t.text}>
            {done == null ? 'Ce ai luat a intrat în cămară.'
              : spentWeek <= settings.budgetRon
                ? `Ai plătit ${fmtRon(done)} și totul a intrat în cămară. Săptămâna asta ești cu ${fmtRon(settings.budgetRon - spentWeek)} sub buget.`
                : `Ai plătit ${fmtRon(done)} și totul a intrat în cămară. Săptămâna asta ai trecut de buget cu ${fmtRon(spentWeek - settings.budgetRon)}.`}
          </T>
        </Card>
      )}
      {active.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {active.map((p) => <Chip key={p.id} label={`Săpt. ${fmtDate(fromISO(p.startISO))}`} selected={p.id === plan.id} onPress={() => setSel(p.id)} />)}
        </ScrollView>
      )}

      {/* banda de sus: cât e deja în coș, din cât */}
      <Pressable onPress={() => setStorePick(true)} style={{ backgroundColor: t.ink, borderRadius: 20, padding: 18, gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="small" color={t.bg} style={{ opacity: 0.75 }}>La {STORE[store].name}, săptămâna asta</T>
          <T v="small" color={t.bg} style={{ opacity: 0.75 }}>{checked.length} din {items.length}</T>
        </Row>
        <Row gap={8} style={{ alignItems: 'baseline' }}>
          <T style={{ fontFamily: DISPLAY_X, fontSize: 38, lineHeight: 42, letterSpacing: -1 }} color={t.bg}>{fmtRon(inCart)}</T>
          <T color={t.bg} style={{ opacity: 0.75 }}>din {fmtRon(total)} în coș</T>
        </Row>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
          <View style={{ width: `${items.length ? (checked.length / items.length) * 100 : 0}%`, height: 10, borderRadius: 5, backgroundColor: '#8FD18A' }} />
        </View>
        <T v="small" color={t.bg} style={{ opacity: 0.75 }}>Atinge ca să schimbi magazinul</T>
      </Pressable>

      {cheapest && cheapest.store !== store && cheapest.cost < total - 5 && !shopMode && (
        <Pressable onPress={() => setPlanStore(plan.id, cheapest.store)}>
          <T v="small" color={t.accent} style={{ fontWeight: '600' }}>La {STORE[cheapest.store].name} ar ieși {fmtRon(cheapest.cost)}. Atinge ca să muți lista acolo.</T>
        </Pressable>
      )}

      <Row>
        <Btn title={shopMode ? 'Ies din modul magazin' : 'Mod magazin'} icon="cart" small variant={shopMode ? 'primary' : 'secondary'} onPress={() => setShopMode(!shopMode)} style={{ flex: 1 }} />
        {!shopMode && <IconBtn icon="receipt-outline" onPress={() => router.push({ pathname: '/scanare', params: { mode: 'bon' } })} />}
        <IconBtn icon="share-outline" onPress={shareList} />
      </Row>
      {!shopMode && known > 0 && <T v="small">{known} prețuri sunt de pe bonurile tale de la {STORE[store].name}.</T>}
      {!shopMode && pricesOn && <LivePricesCard compact />}

      {items.length === 0 ? (
        <Card tone="accent">
          <Empty icon="checkmark-done" title="Ai tot ce îți trebuie" text="Toate ingredientele pentru plan sunt în cămară." />
        </Card>
      ) : byAisle.map(({ a, list }) => (
        <View key={a} style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <T v="h3" style={shopMode ? { fontSize: 22 } : undefined}>{AISLE_LABEL[a]}</T>
            <T v="small">{list.length}</T>
          </Row>
          {list.map((s) => (
            <SwipeRow key={s.ingId} s={s} big={shopMode} price={priceOf(s)} real={storePrices[store]?.[s.ingId] !== undefined} onToggle={() => toggle(s.ingId)} />
          ))}
        </View>
      ))}

      {todo.length > 0 && <T v="small">Trage un produs spre dreapta sau atinge-l ca să-l pui în coș.</T>}

      {checked.length > 0 && (
        <View style={{ gap: 6 }}>
          <Pressable onPress={() => setShowCart(!showCart)} style={{ minHeight: 52, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: t.border, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
            <Icon name="checkmark" color={t.accent} size={22} />
            <T style={{ flex: 1, fontFamily: DISPLAY }} color={t.accent}>{checked.length} {checked.length === 1 ? 'produs' : 'produse'} în coș</T>
            <Icon name={showCart ? 'chevron-up' : 'chevron-down'} color={t.muted} size={18} />
          </Pressable>
          {showCart && checked.map((s) => (
            <SwipeRow key={s.ingId} s={s} big={shopMode} price={priceOf(s)} real={storePrices[store]?.[s.ingId] !== undefined} onToggle={() => toggle(s.ingId)} />
          ))}
        </View>
      )}

      {items.length > 0 && (
        <Row>
          <Btn title={checked.length === items.length ? 'Am terminat cumpărăturile' : checked.length ? `Am plătit ce e în coș (${checked.length})` : 'Am luat tot'} icon="checkmark"
            variant={checked.length ? 'primary' : 'secondary'}
            onPress={() => setPaying(checked.length ? { ids: checked.map((s) => s.ingId), est: inCart } : { ids: items.map((s) => s.ingId), est: total })} style={{ flex: 1 }} />
        </Row>
      )}

      {!shopMode && ((plan.basics?.length ?? 0) > 0 || (plan.addBasics?.length ?? 0) > 0) && (
        <Section title="De obicei le ai acasă" sub="Nu sunt pe listă și nici în cost. Atinge ce-ți lipsește și îl adaug.">
          <Row wrap>
            {[...(plan.basics ?? []).map((b) => b.ingId), ...(plan.addBasics ?? [])].map((id) => (
              <Chip key={id} label={ING[id]?.name ?? id} selected={plan.addBasics?.includes(id)} icon={plan.addBasics?.includes(id) ? 'checkmark' : 'add'}
                onPress={() => toggleBasic(plan.id, id)} />
            ))}
          </Row>
        </Section>
      )}

      {!shopMode && plan.staples.length > 0 && (
        <Section title="Condimente" sub="Atinge ce ai deja, ca să nu mai apară.">
          <Row wrap>
            {plan.staples.map((s) => (
              <Chip key={s.ingId} label={ING[s.ingId].name} icon="add" onPress={() => addPantry(s.ingId, ING[s.ingId].pkg, 365)} />
            ))}
          </Row>
        </Section>
      )}

      {!shopMode && fromPantryOnly.length > 0 && (
        <Section title="Folosești din cămară">
          <T v="small" color={t.text}>{fromPantryOnly.map((s) => `${ING[s.ingId].name} (${fmtQty(s.ingId, s.fromPantryG)})`).join(', ')}</T>
        </Section>
      )}

      <StorePicker visible={storePick} onClose={() => setStorePick(false)} options={cmp} current={store}
        onPick={(st) => { setPlanStore(plan.id, st); setStorePick(false); }} onManage={() => { setStorePick(false); router.push('/magazine'); }} />
      <PaidModal value={paying} onClose={() => setPaying(null)} store={store}
        onConfirm={(amount) => {
          if (paying) buyItems(plan.id, paying.ids, amount);
          success();
          setDone(amount ?? null);
          setPaying(null);
        }} />
    </View>
  );
}

function KeepAwake() {
  useKeepAwake();
  return null;
}

/** un produs: îl tragi spre dreapta (sau îl atingi) și intră în coș */
function SwipeRow({ s, price, real, big, onToggle }: { s: ShoppingItem; price: number; real: boolean; big: boolean; onToggle: () => void }) {
  const t = useTheme();
  const i = ING[s.ingId];
  const x = useState(() => new Animated.Value(0))[0];
  const onToggleRef = useRef(onToggle);
  useEffect(() => { onToggleRef.current = onToggle; });
  const pan = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => x.setValue(Math.max(0, g.dx)),
    onPanResponderRelease: (_, g) => {
      if (g.dx > 90) {
        Animated.timing(x, { toValue: 400, duration: 160, useNativeDriver: true }).start(() => { x.setValue(0); onToggleRef.current(); });
      } else Animated.spring(x, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
  }))[0];
  const h = big ? 72 : 60;
  return (
    <View style={{ height: h, borderRadius: 14, backgroundColor: s.checked ? t.chip : t.accent, overflow: 'hidden' }}>
      <Row gap={6} style={{ position: 'absolute', left: 16, top: 0, bottom: 0 }}>
        <Icon name={s.checked ? 'arrow-undo' : 'checkmark'} color={s.checked ? t.text : '#fff'} size={18} />
        <T color={s.checked ? t.text : '#fff'} style={{ fontFamily: DISPLAY }}>{s.checked ? 'scot din coș' : 'în coș'}</T>
      </Row>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }], height: h }}>
        <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: s.checked }}
          style={{ height: h, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, backgroundColor: t.card,
            borderRadius: 14, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.border }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: s.checked ? t.accent : t.border, backgroundColor: s.checked ? t.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {s.checked && <Icon name="checkmark" color="#fff" size={16} />}
          </View>
          <View style={{ flex: 1 }}>
            <T numberOfLines={1} style={{ fontWeight: '600', fontSize: big ? 20 : 16, textDecorationLine: s.checked ? 'line-through' : 'none', color: s.checked ? t.muted : t.text }}>{i.name}</T>
            <T v="small" style={big ? { fontSize: 15 } : undefined}>{fmtPackage(s.ingId, s.packages)}{s.fromPantryG > 0 ? `, ai deja ${fmtQty(s.ingId, s.fromPantryG)}` : ''}</T>
          </View>
          <T color={real ? t.accent : t.text} style={{ fontFamily: DISPLAY, fontSize: big ? 18 : 15, fontVariant: ['tabular-nums'] }}>{fmtRon(price)}</T>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function StorePicker({ visible, onClose, options, current, onPick, onManage }: {
  visible: boolean; onClose: () => void; options: { store: StoreId; cost: number; known: number }[]; current: StoreId;
  onPick: (s: StoreId) => void; onManage: () => void;
}) {
  const t = useTheme();
  const min = Math.min(...options.map((o) => o.cost));
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable style={{ backgroundColor: t.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 12, paddingBottom: 34 }}>
          <T v="h2">Unde cumperi săptămâna asta?</T>
          <T v="small">Aceeași listă, în magazinele tale. Toată lista se cumpără dintr-un singur loc.</T>
          {options.map((o) => (
            <Pressable key={o.store} onPress={() => onPick(o.store)}>
              <Row style={{ backgroundColor: t.card, borderRadius: 18, padding: 14, borderWidth: 2, borderColor: o.store === current ? t.primary : 'transparent' }} gap={12}>
                <StoreBadge id={o.store} small />
                <View style={{ flex: 1 }}>
                  <T v="small">{o.known ? `${o.known} prețuri reale` : 'prețuri estimate'}</T>
                </View>
                <T style={{ fontFamily: DISPLAY }} color={o.cost === min ? t.accent : t.text}>{fmtRon(o.cost)}</T>
              </Row>
            </Pressable>
          ))}
          <Btn title="Alege magazinele tale" variant="ghost" small icon="storefront" onPress={onManage} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PaidModal({ value, onClose, onConfirm, store }: { value: { ids: string[]; est: number } | null; onClose: () => void; onConfirm: (amount?: number) => void; store: StoreId }) {
  const t = useTheme();
  const [amount, setAmount] = useState(0);
  const est = value?.est ?? 0;
  useEffect(() => { setAmount(Math.round(est)); }, [est]);
  return (
    <Modal visible={!!value} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable style={{ backgroundColor: t.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 14, paddingBottom: 34 }}>
          <T v="h2">Cât ai plătit?</T>
          <T v="small">Produsele intră în cămară. Suma intră la cheltuielile săptămânii, la {STORE[store].name}. Estimarea era {fmtRon(est)}.</T>
          <NumberField value={amount} onChange={setAmount} step={5} min={0} max={100000} suffix="lei" decimals={2} />
          <Row>
            <Btn title="Nu știu" variant="secondary" onPress={() => onConfirm(undefined)} style={{ flex: 1 }} />
            <Btn title="Salvează" icon="checkmark" onPress={() => onConfirm(amount)} style={{ flex: 2 }} />
          </Row>
          <Row gap={6}><Pill text="Sfat" icon="bulb" color={t.warn} bg={t.warnSoft} /><T v="small" style={{ flex: 1 }}>Scanează bonul: suma și prețurile se completează singure.</T></Row>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
