import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { AISLE_LABEL, AISLE_ORDER, INGREDIENTS } from '../data/ingredients';
import { fmtPackage } from '../logic/format';
import { priceAt, STORE, type StoreId } from '../logic/stores';
import { useStore } from '../store/useStore';
import { Card, Chip, DISPLAY, Divider, Field, Icon, IngImage, Row, Screen, Section, T, useTheme } from '../ui/kit';

export default function Prices() {
  const t = useTheme();
  const { prices, setPrice, storePrices, settings } = useStore();
  const [q, setQ] = useState('');
  const [store, setStore] = useState<StoreId>(settings.mainStore ?? settings.stores?.[0] ?? 'lidl');
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const list = INGREDIENTS.filter((i) => !i.staple && norm(i.name).includes(norm(q)));
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Prețuri' }} />
      <T v="small">Verde: preț real de pe bonul tău de la {STORE[store].name}. Portocaliu: corectat de tine. Restul sunt estimate. Bonurile scanate actualizează singure prețurile.</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(settings.stores ?? [store]).map((s) => <Chip key={s} label={STORE[s].name} selected={store === s} color={STORE[s].color} onPress={() => setStore(s)} />)}
      </ScrollView>
      <Field value={q} onChangeText={setQ} placeholder="Caută ingredient" icon="search" />
      {AISLE_ORDER.map((a) => {
        const items = list.filter((i) => i.aisle === a);
        if (!items.length) return null;
        return (
          <Section key={a} title={AISLE_LABEL[a]}>
            <Card style={{ gap: 0, paddingVertical: 4 }}>
              {items.map((i, idx) => {
                const real = storePrices[store]?.[i.id] !== undefined;
                const custom = prices[i.id] !== undefined;
                return (
                  <View key={i.id}>
                    {idx > 0 && <Divider />}
                    <Row style={{ paddingVertical: 8 }} gap={10}>
                      <IngImage id={i.id} size={36} />
                      <View style={{ flex: 1 }}>
                        <T style={{ fontWeight: '600' }}>{i.name}</T>
                        <T v="small">{fmtPackage(i.id, 1)}</T>
                      </View>
                      {real ? <T style={{ fontFamily: DISPLAY, color: t.accent }}>{priceAt(i.id, store, prices, storePrices).toFixed(2)} lei</T> : (
                        <PriceInput value={Math.round(priceAt(i.id, store, prices, storePrices) * 100) / 100} custom={custom}
                          onChange={(v) => setPrice(i.id, v / (STORE[store].index || 1))} />
                      )}
                      {custom && !real ? (
                        <Pressable hitSlop={8} onPress={() => setPrice(i.id, undefined)}><Icon name="refresh" size={18} color={t.muted} /></Pressable>
                      ) : <View style={{ width: 18 }} />}
                    </Row>
                  </View>
                );
              })}
            </Card>
          </Section>
        );
      })}
    </Screen>
  );
}

function PriceInput({ value, custom, onChange }: { value: number; custom: boolean; onChange: (v: number) => void }) {
  const t = useTheme();
  const [txt, setTxt] = useState(String(value));
  React.useEffect(() => setTxt(String(value)), [value]);
  return (
    <Row gap={4}>
      <TextInput
        value={txt} onChangeText={setTxt} keyboardType="decimal-pad" selectTextOnFocus
        onEndEditing={() => { const v = parseFloat(txt.replace(',', '.')); if (Number.isFinite(v) && v >= 0 && v !== value) onChange(v); else setTxt(String(value)); }}
        style={{ width: 64, textAlign: 'right', fontSize: 16, fontWeight: '700', color: custom ? t.warn : t.text, borderBottomWidth: 1, borderColor: t.border, paddingVertical: 4 }}
      />
      <T v="small">lei</T>
    </Row>
  );
}
