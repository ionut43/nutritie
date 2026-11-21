import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, View } from 'react-native';
import { addDays, fmtDate, fromISO, todayISO, toISO, weekdayMon } from '../logic/dates';
import { fmtRon } from '../logic/format';
import { foodSpent } from '../logic/types';
import { STORES, type StoreId } from '../logic/stores';
import { useStore } from '../store/useStore';
import { Btn, Card, Chip, DISPLAY, Divider, Icon, IconBtn, NumberField, Row, Screen, Section, T, useTheme } from '../ui/kit';
import { StoreBadge } from '../ui/shared';

/** Cât cheltui pe săptămână, pe magazine */
export default function Spending() {
  const t = useTheme();
  const { spend, settings, addSpend, removeSpend } = useStore();
  const [adding, setAdding] = useState(false);
  const monday = addDays(fromISO(todayISO()), -weekdayMon(new Date()));
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const s = toISO(addDays(monday, -7 * i));
    const e = toISO(addDays(monday, -7 * i + 6));
    const items = spend.filter((x) => x.dateISO >= s && x.dateISO <= e).sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    return { s, e, items, sum: items.reduce((a, x) => a + foodSpent(x), 0) };
  });
  const withData = weeks.filter((w) => w.items.length);
  const avg = withData.length ? withData.reduce((a, w) => a + w.sum, 0) / withData.length : 0;
  const maxW = Math.max(settings.budgetRon, ...weeks.map((w) => w.sum)) || 1;
  const byStore: Partial<Record<StoreId, number>> = {};
  for (const w of weeks.slice(0, 4)) for (const x of w.items) byStore[x.store] = (byStore[x.store] ?? 0) + foodSpent(x);

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Cheltuieli', headerRight: () => <IconBtn icon="add" tone="primary" size={34} onPress={() => setAdding(true)} /> }} />
      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <T v="small">Săptămâna asta</T>
            <T v="big" color={weeks[0].sum > settings.budgetRon ? t.danger : t.text}>{fmtRon(weeks[0].sum)}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T v="small">Media ({withData.length} săpt.)</T>
            <T v="h2">{fmtRon(avg)}</T>
          </View>
        </Row>
        <View style={{ height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          {[...weeks].reverse().map((w, i) => (
            <View key={w.s} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ width: '100%', height: Math.max(4, (w.sum / maxW) * 96), borderRadius: 8,
                backgroundColor: w.sum > settings.budgetRon ? t.danger : i === weeks.length - 1 ? t.primary : t.accent }} />
              <T v="small" style={{ fontSize: 10 }}>{fmtDate(fromISO(w.s)).split(' ')[0]}</T>
            </View>
          ))}
        </View>
        <T v="small">Bugetul tău: {fmtRon(settings.budgetRon)} pe săptămână. Roșu = peste buget.</T>
      </Card>

      {Object.keys(byStore).length > 0 && (
        <Section title="Ultimele 4 săptămâni, pe magazine">
          <Card style={{ gap: 10 }}>
            {(Object.entries(byStore) as [StoreId, number][]).sort((a, b) => b[1] - a[1]).map(([s, v]) => (
              <Row key={s} style={{ justifyContent: 'space-between' }}><StoreBadge id={s} small /><T style={{ fontFamily: DISPLAY }}>{fmtRon(v)}</T></Row>
            ))}
          </Card>
        </Section>
      )}

      {weeks.filter((w) => w.items.length).map((w) => (
        <Section key={w.s} title={`${fmtDate(fromISO(w.s))} – ${fmtDate(fromISO(w.e))}`} right={<T style={{ fontFamily: DISPLAY }}>{fmtRon(w.sum)}</T>}>
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            {w.items.map((x, i) => (
              <View key={x.id}>
                {i > 0 && <Divider />}
                <Row style={{ paddingVertical: 10 }} gap={10}>
                  <StoreBadge id={x.store} small />
                  <View style={{ flex: 1 }}>
                    <T v="small">{fmtDate(fromISO(x.dateISO))} · {x.source === 'bon' ? 'bon scanat' : x.source === 'lista' ? 'din listă' : 'scris de mână'}</T>
                    {!!x.nonFood && <T v="small">Bon de {fmtRon(x.amount)}, din care {fmtRon(x.nonFood)} nu e mâncare (detergent, hârtie…)</T>}
                  </View>
                  <T style={{ fontFamily: DISPLAY }}>{fmtRon(foodSpent(x))}</T>
                  <Pressable hitSlop={8} onPress={() => Alert.alert('Ștergi cheltuiala?', '', [{ text: 'Nu', style: 'cancel' }, { text: 'Șterge', style: 'destructive', onPress: () => removeSpend(x.id) }])}>
                    <Icon name="close" size={18} color={t.muted} />
                  </Pressable>
                </Row>
              </View>
            ))}
          </Card>
        </Section>
      ))}
      {withData.length === 0 && <T v="small">Nicio cheltuială încă. Se adaugă singure când scanezi bonul sau când bifezi lista și confirmi suma. Poți adăuga și de mână cu +.</T>}

      <AddSpend visible={adding} onClose={() => setAdding(false)} defaultStore={settings.mainStore ?? 'lidl'} stores={settings.stores ?? []}
        onAdd={(store, amount) => { addSpend({ dateISO: todayISO(), store, amount, source: 'manual' }); setAdding(false); }} />
    </Screen>
  );
}

function AddSpend({ visible, onClose, onAdd, defaultStore, stores }: { visible: boolean; onClose: () => void; onAdd: (s: StoreId, a: number) => void; defaultStore: StoreId; stores: StoreId[] }) {
  const t = useTheme();
  const [store, setStore] = useState<StoreId>(defaultStore);
  const [amount, setAmount] = useState(100);
  const opts = STORES.filter((s) => stores.includes(s.id) || s.id === 'altul');
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable style={{ backgroundColor: t.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 14, paddingBottom: 34 }}>
          <T v="h2">Adaugă o cumpărătură</T>
          <Row wrap>{opts.map((s) => <Chip key={s.id} label={s.name} selected={store === s.id} color={s.color} onPress={() => setStore(s.id)} />)}</Row>
          <NumberField value={amount} onChange={setAmount} step={5} min={0} max={100000} decimals={2} suffix="lei" />
          <Btn title="Salvează" icon="checkmark" onPress={() => onAdd(store, amount)} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
