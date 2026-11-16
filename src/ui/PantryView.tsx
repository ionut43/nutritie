import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ING } from '../data/ingredients';
import { RECIPES } from '../data/recipes';
import { todayISO } from '../logic/dates';
import { fmtQty } from '../logic/format';
import { hasEquipment, mergeRestrictions, recipeFits } from '../logic/nutrition';
import { daysLeft, recipesFromPantry } from '../logic/pantry';
import type { PantryItem } from '../logic/types';
import { useStore } from '../store/useStore';
import { IngredientPicker } from './forms';
import { Btn, Card, Chip, DISPLAY, Empty, FoodImage, IngImage, NumberField, Row, Section, T, useTheme } from './kit';

export function PantryView() {
  const t = useTheme();
  const router = useRouter();
  const { pantry, members, settings, disliked, addPantry, setPantryQty, removePantry } = useStore();
  const today = todayISO();
  const [picker, setPicker] = useState(false);
  const [adding, setAdding] = useState<{ ingId: string; g: number; days: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const real = pantry.filter((p) => !ING[p.ingId]?.staple);
  const staples = pantry.filter((p) => ING[p.ingId]?.staple);
  const rs = mergeRestrictions(members);
  const suggestions = useMemo(() => {
    const ok = RECIPES.filter((r) => r.meal.length > 0 && recipeFits(r, rs) && hasEquipment(r, settings.equipment) && !disliked.includes(r.id));
    return recipesFromPantry(real, ok, today).slice(0, 8);
  }, [real, rs, settings.equipment, disliked, today]);

  // trei rafturi: frigider, congelator, cămară (după raion și cât ține)
  const shelfOf = (it: PantryItem): Shelf => {
    const ing = ING[it.ingId];
    if (!ing) return 'camara';
    if (ing.aisle === 'congelate' || (['carne', 'peste'].includes(ing.aisle) && daysLeft(it, today) > 30)) return 'congelator';
    if (['carne', 'peste', 'lactate', 'oua'].includes(ing.aisle)) return 'frigider';
    if (['legume', 'fructe', 'panificatie'].includes(ing.aisle) && ing.shelfDays <= 21) return 'frigider';
    return 'camara';
  };
  const shelves = SHELVES.map((sh) => ({ ...sh, list: real.filter((p) => shelfOf(p) === sh.id).sort((x, y) => x.expiresISO.localeCompare(y.expiresISO)) }))
    .filter((x) => x.list.length);
  const editing = real.find((p) => p.id === open);

  return (
    <View style={{ gap: 18 }}>
      <Row>
        <Btn title="Adaugă" icon="add" small onPress={() => setPicker(true)} style={{ flex: 1 }} />
        <Btn title="Bon" icon="receipt" small variant="secondary" onPress={() => router.push({ pathname: '/scanare', params: { mode: 'bon' } })} />
        <Btn title="Cod" icon="barcode" small variant="secondary" onPress={() => router.push({ pathname: '/scanare', params: { mode: 'cod' } })} />
      </Row>

      {adding && (
        <Card tone="primary" style={{ gap: 12 }}>
          <Row gap={12}><IngImage id={adding.ingId} size={48} /><T v="h3" style={{ flex: 1 }}>{ING[adding.ingId].name}</T></Row>
          <NumberField label="Cantitate" value={adding.g} step={ING[adding.ingId].gPerPiece ?? 50} min={1} max={50000} suffix="g"
            onChange={(g) => setAdding({ ...adding, g })} />
          <NumberField label="Mai ține" value={adding.days} min={1} max={1000} suffix="zile" onChange={(days) => setAdding({ ...adding, days })} />
          <Row>
            <Btn title="Renunță" variant="secondary" small onPress={() => setAdding(null)} style={{ flex: 1 }} />
            <Btn title="Salvează" small onPress={() => { addPantry(adding.ingId, adding.g, adding.days); setAdding(null); }} style={{ flex: 1 }} />
          </Row>
        </Card>
      )}

      {suggestions.length > 0 && (
        <View style={{ gap: 10 }}>
          <T v="h3">Ce gătesc cu ce am</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {suggestions.map((m) => {
              const miss = m.missing.filter((id) => !ING[id]?.staple && !ING[id]?.basic);
              return (
                <Pressable key={m.recipe.id} onPress={() => router.push({ pathname: '/reteta/[id]', params: { id: m.recipe.id } })}
                  style={{ width: 168, borderRadius: 18, overflow: 'hidden', backgroundColor: t.card, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.border }}>
                  <FoodImage recipe={m.recipe} width={168} height={110} radius={0} />
                  <View style={{ padding: 10, gap: 2 }}>
                    <T numberOfLines={2} style={{ fontFamily: DISPLAY, fontSize: 15 }}>{m.recipe.name}</T>
                    <T v="small" color={miss.length ? t.muted : t.accent} numberOfLines={2} style={miss.length ? undefined : { fontWeight: '600' }}>
                      {miss.length === 0 ? 'Ai tot ce trebuie' : miss.length === 1 ? `Îți lipsește ${ING[miss[0]]?.name.toLowerCase()}` : `Îți lipsesc ${miss.length} ingrediente`}
                    </T>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {real.length === 0 && !adding && (
        <Card><Empty icon="file-tray" title="Cămara e goală" text="Adaugă ce ai în casă, scanează bonul sau termină lista de cumpărături: ce cumperi intră aici singur." /></Card>
      )}

      {shelves.map((sh) => {
        const soon = sh.list.filter((p) => daysLeft(p, today) <= 3).length;
        return (
          <View key={sh.id} style={{ gap: 10 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <T v="h3">{sh.label}</T>
              {soon > 0 && <T v="small" color={t.warn} style={{ fontWeight: '600' }}>{soon} {soon === 1 ? 'se termină' : 'se termină'} curând</T>}
            </Row>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {sh.list.map((p) => <Jar key={p.id} p={p} today={today} tint={sh.id} onPress={() => setOpen(p.id)} />)}
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: sh.id === 'congelator' ? '#C9D4EC' : sh.id === 'camara' ? '#E3D5B8' : t.border }} />
          </View>
        );
      })}

      {staples.length > 0 && (
        <Section title="Condimente pe care le ai">
          <Row wrap>{staples.map((p) => <Chip key={p.id} label={ING[p.ingId].name} icon="close" onPress={() => removePantry(p.id)} />)}</Row>
        </Section>
      )}

      <IngredientPicker visible={picker} onClose={() => setPicker(false)}
        onPick={(id) => { setPicker(false); const i = ING[id]; setAdding({ ingId: id, g: i.pkg, days: i.shelfDays }); }} />

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <Pressable onPress={() => setOpen(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          {editing && (
            <Pressable style={{ backgroundColor: t.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 14, paddingBottom: 34 }}>
              <Row gap={12}><IngImage id={editing.ingId} size={52} /><T v="h2" style={{ flex: 1 }}>{ING[editing.ingId]?.name}</T></Row>
              <T v="small">{expiryText(daysLeft(editing, today))}</T>
              <NumberField label="Cât mai ai" value={editing.g} step={ING[editing.ingId]?.gPerPiece ?? 50} min={0} max={50000} suffix="g" onChange={(g) => setPantryQty(editing.id, g)} />
              <Row>
                <Btn title="S-a terminat" icon="trash" variant="secondary" onPress={() => { removePantry(editing.id); setOpen(null); }} style={{ flex: 1 }} />
                <Btn title="Gata" onPress={() => setOpen(null)} style={{ flex: 1 }} />
              </Row>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

type Shelf = 'frigider' | 'congelator' | 'camara';
const SHELVES: { id: Shelf; label: string }[] = [
  { id: 'frigider', label: 'Frigider' }, { id: 'congelator', label: 'Congelator' }, { id: 'camara', label: 'Cămară' },
];

function expiryText(left: number) {
  if (left < 0) return `expirat de ${-left} ${-left === 1 ? 'zi' : 'zile'}`;
  if (left === 0) return 'expiră azi';
  if (left > 400) return `încă ${Math.round(left / 365)} ${Math.round(left / 365) === 1 ? 'an' : 'ani'}`;
  if (left > 60) return `încă ${Math.round(left / 30)} luni`;
  return `încă ${left} ${left === 1 ? 'zi' : 'zile'}`;
}

/** un borcan pe raft: numele, cât e, și o bară care se scurtează până la expirare */
function Jar({ p, today, tint, onPress }: { p: PantryItem; today: string; tint: Shelf; onPress: () => void }) {
  const t = useTheme();
  const i = ING[p.ingId];
  const left = daysLeft(p, today);
  const span = Math.max(1, i?.shelfDays ?? 30);
  const f = Math.max(0.04, Math.min(1, left / span));
  const soon = left <= 3;
  const bg = tint === 'congelator' ? t.primarySoft : tint === 'camara' ? t.warnSoft : t.card;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ width: '31.6%', minHeight: 104, borderRadius: 14, padding: 10, gap: 5, backgroundColor: bg,
      borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.border, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
      <T numberOfLines={2} style={{ fontFamily: DISPLAY, fontSize: 14 }}>{i?.name}</T>
      <T v="small" style={{ fontSize: 12 }}>{fmtQty(p.ingId, p.g)}</T>
      <View style={{ flex: 1 }} />
      <View style={{ height: 6, borderRadius: 3, backgroundColor: t.arcTrack }}>
        <View style={{ width: `${f * 100}%`, height: 6, borderRadius: 3, backgroundColor: soon ? t.warn : t.accent }} />
      </View>
      <T v="small" style={{ fontSize: 12, fontWeight: soon ? '600' : '400' }} color={soon ? t.warn : t.muted}>{expiryText(left)}</T>
    </Pressable>
  );
}
