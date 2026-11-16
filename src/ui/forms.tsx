import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, Image, Modal, Pressable, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { INGREDIENTS, ING } from '../data/ingredients';
import { RECIPE_PHOTO } from '../data/photos';
import { RECIPE } from '../data/recipes';
import { DAY_NAMES } from '../logic/dates';
import { computeTargets, JOB, TRAIN, weeksToTarget } from '../logic/energy';
import { nf } from '../logic/format';
import { ALLERGEN_LABEL, AVOID_LABEL, EQUIPMENT_LABEL } from '../logic/nutrition';
import { SLOT_LABEL, SLOT_ORDER } from '../logic/planner';
import { STORES, type StoreId } from '../logic/stores';
import type {
  Allergen, AvoidKind, Cuisine, Diet, Equipment, FastPref, Goal, JobActivity, Member, Pregnancy, Settings, Slot, TrainType,
} from '../logic/types';
import type { IlloName } from './illustrations';
import { Btn, Card, Chip, DISPLAY, Field, Icon, type IconName, IngImage, NumberField, Option, Row, Segmented, T, Tile, TileGrid, useTheme } from './kit';
import { StoreBadge } from './shared';
import { CUISINE_LABEL, CUISINE_SAMPLE } from './visual';

const toggle = <X,>(arr: X[], v: X) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
const YEAR = new Date().getFullYear();

export function BodyForm({ m, onChange, showName = true }: { m: Member; onChange: (m: Member) => void; showName?: boolean }) {
  return (
    <View style={{ gap: 16 }}>
      {showName && <Field label="Cum te cheamă?" value={m.name} onChangeText={(name) => onChange({ ...m, name })} placeholder="ex. Andrei" />}
      <View style={{ gap: 6 }}>
        <T v="small" style={{ fontWeight: '600' }}>Sex (pentru formula de calcul)</T>
        <Segmented options={[{ label: 'Bărbat', value: 'm' }, { label: 'Femeie', value: 'f' }]} value={m.sex}
          onChange={(sex) => onChange({ ...m, sex, pregnancy: sex === 'm' ? 'nu' : m.pregnancy })} />
      </View>
      <NumberField label="Vârstă" value={YEAR - m.birthYear} min={1} max={110} suffix="ani" onChange={(a) => onChange({ ...m, birthYear: YEAR - a })} />
      <NumberField label="Înălțime" value={m.heightCm} min={50} max={250} suffix="cm" onChange={(heightCm) => onChange({ ...m, heightCm })} />
      <NumberField label="Greutate acum" value={m.weightKg} min={5} max={350} step={0.5} decimals={1} suffix="kg" onChange={(weightKg) => onChange({ ...m, weightKg })} />
    </View>
  );
}

const JOB_ICON: Record<JobActivity, IconName> = { birou: 'desktop', picioare: 'walk', fizic: 'hammer', foarte_fizic: 'barbell' };

export function ActivityForm({ m, onChange }: { m: Member; onChange: (m: Member) => void }) {
  const job = m.job ?? 'birou';
  return (
    <View style={{ gap: 10 }}>
      {(Object.keys(JOB) as JobActivity[]).map((j) => (
        <Option key={j} icon={JOB_ICON[j]} title={JOB[j].label} desc={JOB[j].desc} selected={job === j} onPress={() => onChange({ ...m, job: j })} />
      ))}
      <Card style={{ gap: 10, marginTop: 4 }}>
        <T v="h3">Știi câți pași faci pe zi? (opțional)</T>
        <T v="small">Din telefon sau ceas. Dacă nu știi, lasă 0.</T>
        <NumberField value={m.steps ?? 0} onChange={(steps) => onChange({ ...m, steps })} step={1000} min={0} max={60000} suffix="pași" />
      </Card>
    </View>
  );
}

const TRAIN_ICON: Record<TrainType, IconName> = { forta: 'barbell', cardio: 'bicycle', mixt: 'football' };

export function SportForm({ m, onChange }: { m: Member; onChange: (m: Member) => void }) {
  const days = m.trainDays ?? 0;
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 8 }}>
        <T v="small" style={{ fontWeight: '600' }}>Câte zile pe săptămână faci sport?</T>
        <Row style={{ justifyContent: 'space-between' }}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => <Chip key={d} label={String(d)} selected={days === d} onPress={() => onChange({ ...m, trainDays: d })} />)}
        </Row>
      </View>
      {days > 0 && (
        <>
          <View style={{ gap: 8 }}>
            <T v="small" style={{ fontWeight: '600' }}>Ce fel de sport?</T>
            <TileGrid>
              {(Object.keys(TRAIN) as TrainType[]).map((k) => (
                <Tile key={k} icon={TRAIN_ICON[k]} label={TRAIN[k].label.split(' (')[0]} sub={TRAIN[k].label.split(' (')[1]?.replace(')', '')}
                  selected={(m.trainType ?? 'mixt') === k} onPress={() => onChange({ ...m, trainType: k })} />
              ))}
            </TileGrid>
          </View>
          <NumberField label="Cât durează un antrenament?" value={m.trainMin ?? 45} onChange={(trainMin) => onChange({ ...m, trainMin })} step={5} min={5} max={300} suffix="min" />
        </>
      )}
      <T v="small">Sportul se adaugă separat la necesar, după tipul și durata lui, ca să nu fie numărat de două ori.</T>
    </View>
  );
}

const GOAL_ICON: Record<Goal, IconName> = { slabire: 'trending-down', mentinere: 'swap-horizontal', masa: 'trending-up' };
const GOAL_SHORT: Record<Goal, [string, string]> = {
  slabire: ['Să slăbesc', 'deficit caloric'], mentinere: ['Să mă mențin', 'și să mănânc mai bine'], masa: ['Să iau în greutate', 'masă musculară'],
};

export function GoalForm({ m, onChange }: { m: Member; onChange: (m: Member) => void }) {
  const t = useTheme();
  const age = YEAR - m.birthYear;
  if (age < 18) {
    return <Card tone="accent"><T v="small" color={t.text}>Pentru copii și adolescenți calculăm necesarul pentru creștere normală. Nu se aplică deficit sau surplus.</T></Card>;
  }
  const rates = m.goal === 'slabire' ? [0.25, 0.5, 0.75, 1] : [0.25, 0.5];
  const eta = weeksToTarget(m);
  return (
    <View style={{ gap: 12 }}>
      {(Object.keys(GOAL_SHORT) as Goal[]).map((g) => (
        <Option key={g} icon={GOAL_ICON[g]} title={GOAL_SHORT[g][0]} desc={GOAL_SHORT[g][1]} selected={m.goal === g}
          onPress={() => onChange({ ...m, goal: g, rateKg: g === 'masa' ? Math.min(m.rateKg, 0.5) : m.rateKg })} />
      ))}
      {m.goal !== 'mentinere' && (
        <Card style={{ gap: 12 }}>
          <NumberField label="Greutatea la care vrei să ajungi (opțional)" value={m.targetKg ?? m.weightKg} min={20} max={350} step={0.5} decimals={1} suffix="kg"
            onChange={(targetKg) => onChange({ ...m, targetKg })} />
          <View style={{ gap: 6 }}>
            <T v="small" style={{ fontWeight: '600' }}>Cât de repede?</T>
            <Segmented options={rates.map((r) => ({ label: `${String(r).replace('.', ',')} kg`, value: r }))} value={m.rateKg}
              onChange={(rateKg) => onChange({ ...m, rateKg })} />
            <T v="small">{m.goal === 'slabire' ? 'Pe săptămână. Recomandat 0,25–0,5 kg: slăbești din grăsime, nu din mușchi, și e mai ușor de ținut.' : 'Pe săptămână. 0,25 kg pune mai mult mușchi decât grăsime.'}</T>
          </View>
          {eta ? <T v="h3" color={t.accent}>Ajungi la {nf(m.targetKg!)} kg în ~{eta} săptămâni</T> : null}
        </Card>
      )}
    </View>
  );
}

export function HealthForm({ m, onChange }: { m: Member; onChange: (m: Member) => void }) {
  const age = YEAR - m.birthYear;
  return (
    <View style={{ gap: 14 }}>
      {m.sex === 'f' && age >= 14 && (
        <View style={{ gap: 8 }}>
          <T v="small" style={{ fontWeight: '600' }}>Sarcină sau alăptare</T>
          <Row wrap>
            {([['nu', 'Nu'], ['t1', 'Sarcină T1'], ['t2', 'Sarcină T2'], ['t3', 'Sarcină T3'], ['alaptare', 'Alăptez']] as [Pregnancy, string][]).map(([v, l]) => (
              <Chip key={v} label={l} selected={m.pregnancy === v} onPress={() => onChange({ ...m, pregnancy: v })} />
            ))}
          </Row>
        </View>
      )}
      <Card style={{ gap: 10 }}>
        <T v="h3">Știi procentul de grăsime? (opțional)</T>
        <T v="small">De la un cântar cu bioimpedanță sau de la sală. Dacă îl știi, calculul e mai exact (formula Katch-McArdle). Lasă 0 dacă nu știi.</T>
        <NumberField value={m.bodyFat ?? 0} onChange={(bodyFat) => onChange({ ...m, bodyFat: bodyFat || undefined })} step={1} min={0} max={60} suffix="%" />
      </Card>
      <ToggleRow title="Vreau mai multe proteine" desc="Pentru sală sau ca să păstrezi mușchii când slăbești (+0,4 g/kg)." value={!!m.highProtein}
        onChange={(highProtein) => onChange({ ...m, highProtein })} />
      <ToggleRow title="Am o afecțiune care cere dietă medicală" desc="Diabet, boală renală, hepatică etc. Îți arăt un avertisment să verifici cu medicul." value={m.medical}
        onChange={(medical) => onChange({ ...m, medical })} />
    </View>
  );
}

const DIET_OPT: [Diet, IconName, string, string][] = [
  ['omnivor', 'restaurant', 'Mănânc de toate', 'carne, pește, lactate, ouă'],
  ['pescetarian', 'fish', 'Pescetarian', 'fără carne, cu pește'],
  ['vegetarian', 'egg', 'Vegetarian', 'fără carne și pește, cu lactate și ouă'],
  ['vegan', 'leaf', 'Vegan', 'doar din plante'],
];

export function DietStyleForm({ m, s, onMember, onSettings }: { m: Member; s: Settings; onMember: (m: Member) => void; onSettings: (p: Partial<Settings>) => void }) {
  return (
    <View style={{ gap: 10 }}>
      {DIET_OPT.map(([d, icon, title, desc]) => <Option key={d} icon={icon} title={title} desc={desc} selected={m.diet === d} onPress={() => onMember({ ...m, diet: d })} />)}
      {m.diet === 'omnivor' && (
        <View style={{ gap: 8, marginTop: 6 }}>
          <T v="h3">Cât de des carne la prânz și cină?</T>
          <Segmented options={[{ label: 'Aproape mereu', value: 'des' }, { label: 'Majoritatea', value: 'echilibrat' }, { label: 'Mai rar', value: 'rar' }]}
            value={s.meatStyle ?? 'echilibrat'} onChange={(meatStyle) => onSettings({ meatStyle })} />
          <T v="small">{(s.meatStyle ?? 'echilibrat') === 'des'
            ? 'Carne la aproape fiecare masă principală, rar altceva.'
            : (s.meatStyle ?? 'echilibrat') === 'echilibrat'
              ? 'Carne la cam 2 din 3 mese principale; restul pește, ouă, brânză sau fasole.'
              : 'Carne de 2–3 ori pe săptămână, mai multe mese cu legume și leguminoase.'}</T>
        </View>
      )}
    </View>
  );
}

export function DietForm({ m, onChange }: { m: Member; onChange: (m: Member) => void }) {
  return (
    <View style={{ gap: 10 }}>
      {DIET_OPT.map(([d, icon, title, desc]) => <Option key={d} icon={icon} title={title} desc={desc} selected={m.diet === d} onPress={() => onChange({ ...m, diet: d })} />)}
    </View>
  );
}

/** pozele pentru „ce nu mănânci” (ingrediente fără ambalaje) */

export function AvoidForm({ m, onChange }: { m: Member; onChange: (m: Member) => void }) {
  const [picker, setPicker] = useState(false);
  const avoid = m.avoid ?? [];
  const kinds = (Object.keys(AVOID_LABEL) as AvoidKind[]).filter((k) => {
    if (m.diet === 'vegan') return ['ciuperci', 'leguminoase', 'picant'].includes(k);
    if (m.diet === 'vegetarian') return ['oua', 'lactate', 'ciuperci', 'leguminoase', 'picant'].includes(k);
    if (m.diet === 'pescetarian') return !['pui', 'curcan', 'porc', 'vita', 'miel', 'organe'].includes(k);
    return true;
  });
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <T v="small">Atinge ce nu mănânci. Nu trebuie să fie alergie: dacă nu-ți place, nu apare niciodată.</T>
        <Row wrap>
          {kinds.map((k) => (
            <Chip key={k} label={AVOID_LABEL[k]} selected={avoid.includes(k)} color="#C8361F" icon={avoid.includes(k) ? 'close' : undefined}
              onPress={() => onChange({ ...m, avoid: toggle(avoid, k) })} />
          ))}
        </Row>
      </View>
      <View style={{ gap: 8 }}>
        <T v="h3">Alte ingrediente</T>
        <Row wrap>
          {m.dislikes.map((id) => (
            <Chip key={id} label={ING[id]?.name ?? id} icon="close" tone="danger" onPress={() => onChange({ ...m, dislikes: m.dislikes.filter((x) => x !== id) })} />
          ))}
          <Chip label="Adaugă (ex. coriandru, vinete)" icon="add" onPress={() => setPicker(true)} />
        </Row>
      </View>
      <View style={{ gap: 8 }}>
        <T v="h3">Alergii și intoleranțe</T>
        <T v="small">Separat de gusturi: rețetele cu acești alergeni nu apar deloc.</T>
        <Row wrap>
          {(Object.keys(ALLERGEN_LABEL) as Allergen[]).map((a) => (
            <Chip key={a} label={ALLERGEN_LABEL[a]} selected={m.allergies.includes(a)} color="#C8361F" icon={m.allergies.includes(a) ? 'alert-circle' : undefined}
              onPress={() => onChange({ ...m, allergies: toggle(m.allergies, a) })} />
          ))}
        </Row>
      </View>
      <IngredientPicker visible={picker} onClose={() => setPicker(false)} exclude={m.dislikes} includeStaples={false}
        onPick={(id) => { onChange({ ...m, dislikes: [...m.dislikes, id] }); setPicker(false); }} />
    </View>
  );
}

/** bucătării: atinge o dată = îmi place, a doua oară = nu-mi place, a treia = neutru */
export function CuisineForm({ s, onChange }: { s: Settings; onChange: (p: Partial<Settings>) => void }) {
  const t = useTheme();
  const cur = s.cuisines ?? {};
  const cycle = (c: Cuisine) => {
    const v = cur[c];
    const next = { ...cur };
    if (v === undefined) next[c] = 1; else if (v === 1) next[c] = -1; else delete next[c];
    onChange({ cuisines: next });
  };
  return (
    <View style={{ gap: 10 }}>
      <T v="small">O atingere: îmi place (apare mai des). Două: nu-mi place (apare rar). Trei: neutru.</T>
      <TileGrid>
        {(Object.keys(CUISINE_LABEL) as Cuisine[]).map((c) => {
          const v = cur[c];
          return (
            <Pressable key={c} onPress={() => cycle(c)} style={({ pressed }) => ({ width: '31%', borderRadius: 20, overflow: 'hidden', backgroundColor: t.card, borderWidth: 2.5,
              borderColor: v === 1 ? t.accent : v === -1 ? t.danger : 'transparent', transform: [{ scale: pressed ? 0.96 : 1 }] })}>
              <View>
                <Image2 src={RECIPE_PHOTO[CUISINE_SAMPLE[c]]} dim={v === -1} />
                {v !== undefined && (
                  <View style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: v === 1 ? t.accent : t.danger, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={v === 1 ? 'heart' : 'close'} size={15} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 13, textAlign: 'center', paddingVertical: 8 }}>{CUISINE_LABEL[c]}</Text>
            </Pressable>
          );
        })}
      </TileGrid>
    </View>
  );
}

function Image2({ src, dim }: { src?: number; dim?: boolean }) {
  return (
    <View style={{ width: '100%', aspectRatio: 1.2, overflow: 'hidden' }}>
      {src ? <Image source={src} resizeMode="cover" style={{ width: '100%', height: '100%', opacity: dim ? 0.35 : 1 }} /> : null}
    </View>
  );
}

/** câteva feluri cu poză: îți place / nu-ți place, ca planul să știe de la început */
export const TASTE_SAMPLE = [
  'sarmale', 'shaorma_pui', 'spaghete_bolognese', 'ciorba_fasole_alba', 'pui_kung_pao', 'musaca_vinete', 'salata_greceasca_pui',
  'chili_con_carne', 'somon_teriyaki', 'ratatouille', 'pui_tandoori', 'snitel_porc', 'pad_thai', 'tocana_porc_varza_murata', 'pita_falafel', 'clatite_branza',
];

export function TasteForm({ value, onChange }: { value: Record<string, 1 | -1>; onChange: (v: Record<string, 1 | -1>) => void }) {
  const t = useTheme();
  const ids = TASTE_SAMPLE.filter((id) => RECIPE[id]);
  return (
    <View style={{ gap: 10 }}>
      <T v="small">Nu trebuie să le fi gustat. Spune doar ce ți se pare apetisant. Poți sări peste oricare.</T>
      <TileGrid>
        {ids.map((id) => {
          const v = value[id];
          const set = (x: 1 | -1) => { const n = { ...value }; if (n[id] === x) delete n[id]; else n[id] = x; onChange(n); };
          return (
            <View key={id} style={{ width: '48%', borderRadius: 20, overflow: 'hidden', backgroundColor: t.card, borderWidth: 2.5,
              borderColor: v === 1 ? t.accent : v === -1 ? t.danger : 'transparent' }}>
              <Image2 src={RECIPE_PHOTO[id]} dim={v === -1} />
              <View style={{ padding: 8, gap: 8 }}>
                <Text numberOfLines={2} style={{ color: t.text, fontWeight: '700', fontSize: 13, minHeight: 34 }}>{RECIPE[id].name}</Text>
                <Row gap={6}>
                  <Pressable onPress={() => set(-1)} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: v === -1 ? t.danger : t.chip }}>
                    <Ionicons name="thumbs-down" size={18} color={v === -1 ? '#fff' : t.muted} />
                  </Pressable>
                  <Pressable onPress={() => set(1)} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: v === 1 ? t.accent : t.chip }}>
                    <Ionicons name="thumbs-up" size={18} color={v === 1 ? '#fff' : t.muted} />
                  </Pressable>
                </Row>
              </View>
            </View>
          );
        })}
      </TileGrid>
    </View>
  );
}

export function TargetPreview({ m }: { m: Member }) {
  const tg = computeTargets(m);
  const t = useTheme();
  const eta = weeksToTarget(m);
  return (
    <View style={{ gap: 12 }}>
      <Card tone="ink" style={{ gap: 6, padding: 22 }}>
        <T v="label" color={t.muted}>Ținta ta zilnică</T>
        <T v="hero" color={t.bg}>{tg.kcal} <T v="h2" color={t.muted}>kcal</T></T>
        <Row gap={16}>
          <T v="small" color={t.muted}>Proteine <T v="small" color={t.bg} style={{ fontFamily: DISPLAY }}>{tg.protein} g</T></T>
          <T v="small" color={t.muted}>Carbo <T v="small" color={t.bg} style={{ fontFamily: DISPLAY }}>{tg.carbs} g</T></T>
          <T v="small" color={t.muted}>Grăsimi <T v="small" color={t.bg} style={{ fontFamily: DISPLAY }}>{tg.fat} g</T></T>
        </Row>
      </Card>
      <Card style={{ gap: 8 }}>
        <T v="h3">Cum am calculat</T>
        <Line label="Metabolism bazal (în repaus)" value={`${tg.bmr} kcal`} />
        <Line label="Necesar de menținere (cu activitatea și sportul)" value={`${tg.tdee} kcal`} />
        {tg.goal !== 'mentinere' && <Line label={tg.goal === 'slabire' ? 'Deficit pentru slăbit' : 'Surplus pentru masă'} value={`${tg.kcal - tg.tdee > 0 ? '+' : ''}${tg.kcal - tg.tdee} kcal`} />}
        <Line label="Formula" value={tg.method} />
        {eta ? <T v="small" color={t.accent} style={{ fontWeight: '700' }}>Ajungi la {nf(m.targetKg!)} kg în aproximativ {eta} săptămâni.</T> : null}
        <T v="small">Ținta se ajustează singură după cântăriri: dacă slăbești mai repede sau mai încet decât ai vrut, îți propun o corecție.</T>
      </Card>
      {tg.warnings.map((w) => <Card key={w} tone="warn"><T v="small" color={t.text}>{w}</T></Card>)}
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T v="small" style={{ flex: 1 }}>{label}</T>
      <T style={{ fontFamily: DISPLAY }}>{value}</T>
    </Row>
  );
}

const EQUIPMENT_SHORT: Record<Equipment, string> = {
  plita: 'Aragaz / plită', cuptor: 'Cuptor', microunde: 'Microunde', airfryer: 'Air fryer', blender: 'Blender',
  mixer: 'Mixer', robot: 'Robot bucătărie', multicooker: 'Multicooker', grill: 'Grill', toaster: 'Toaster',
};

export function EquipmentForm({ value, onChange }: { value: Equipment[]; onChange: (v: Equipment[]) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <TileGrid>
        {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((e) => (
          <Tile key={e} illo={e as IlloName} label={EQUIPMENT_SHORT[e]} selected={value.includes(e)} onPress={() => onChange(toggle(value, e))} />
        ))}
      </TileGrid>
      <T v="small">Atinge ce ai în bucătărie. Ce e colorat e selectat.</T>
    </View>
  );
}

/** câte mese pe zi, într-o singură alegere */
export const MEAL_SETS: Record<number, Slot[]> = {
  1: ['cina'], 2: ['pranz', 'cina'], 3: ['mic_dejun', 'pranz', 'cina'],
  4: ['mic_dejun', 'pranz', 'gustare2', 'cina'], 5: ['mic_dejun', 'gustare1', 'pranz', 'gustare2', 'cina'],
};
export function MealsPerDay({ value, onChange }: { value: Slot[]; onChange: (v: Slot[]) => void }) {
  const n = value.length;
  return (
    <View style={{ gap: 6 }}>
      <Segmented options={[2, 3, 4, 5].map((k) => ({ label: `${k} mese`, value: k }))} value={Math.min(5, Math.max(2, n))} onChange={(k) => onChange(MEAL_SETS[k])} />
      <T v="small">{value.map((s) => SLOT_LABEL[s].replace(' (dimineața)', '').replace(' (după-amiaza)', '').toLowerCase()).join(', ')}. Caloriile zilei se împart între ele și suma nu trece de ținta ta.</T>
    </View>
  );
}

export function SlotsForm({ value, onChange, desserts, onDesserts }: { value: Slot[]; onChange: (v: Slot[]) => void; desserts?: number; onDesserts?: (n: number) => void }) {
  return (
    <View style={{ gap: 12 }}>
      <TileGrid>
        {SLOT_ORDER.map((s) => (
          <Tile key={s} illo={s as IlloName} label={SLOT_LABEL[s].replace(' (dimineața)', '').replace(' (după-amiaza)', '')}
            sub={s === 'gustare1' ? 'dimineața' : s === 'gustare2' ? 'după-amiaza' : undefined} selected={value.includes(s)}
            onPress={() => { const n = toggle(value, s); if (n.length) onChange(SLOT_ORDER.filter((x) => n.includes(x))); }} />
        ))}
      </TileGrid>
      <T v="small">{value.length} mese pe zi. Caloriile se împart automat (mic dejun ~25%, prânz ~35%, cină ~25%, gustări ~10%).</T>
      {onDesserts && (value.includes('gustare1') || value.includes('gustare2')) && (
        <View style={{ gap: 8 }}>
          <T v="h3">Desert, de câte ori pe săptămână?</T>
          <Segmented options={[{ label: 'Deloc', value: 0 }, { label: '1–2', value: 2 }, { label: '3–4', value: 4 }, { label: 'Zilnic', value: 7 }]}
            value={desserts ?? 2} onChange={onDesserts} />
        </View>
      )}
    </View>
  );
}

export function CookingForm({ s, onChange }: { s: Settings; onChange: (p: Partial<Settings>) => void }) {
  const all = s.cookingDays.length === 7;
  const v = s.variety ?? 'mare';
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <T v="h3">În ce zile gătești?</T>
        <T v="small">În celelalte zile mănânci ce ai gătit. Ce nu ține la frigider se congelează, iar aplicația îți spune ce și când.</T>
        <Row style={{ justifyContent: 'space-between' }}>
          {DAY_NAMES.map((d, i) => (
            <DayDot key={d} label={d.slice(0, 2)} selected={s.cookingDays.includes(i)}
              onPress={() => { const n = toggle(s.cookingDays, i); if (n.length) onChange({ cookingDays: n.sort() }); }} />
          ))}
        </Row>
        <Row><Chip label="În fiecare zi" selected={all} onPress={() => onChange({ cookingDays: all ? [6] : [0, 1, 2, 3, 4, 5, 6] })} /></Row>
      </View>
      <View style={{ gap: 8 }}>
        <T v="h3">Cât de des poți mânca același fel?</T>
        <Option icon="shuffle" title="Cât mai variat" desc="Același fel cel mult de 2 ori (ex. cina și prânzul de a doua zi). Gătești mai multe feluri odată." selected={v === 'mare'} onPress={() => onChange({ variety: 'mare' })} />
        <Option icon="repeat" title="Echilibrat" desc="Același fel de cel mult 3 ori." selected={v === 'echilibrat'} onPress={() => onChange({ variety: 'echilibrat' })} />
        <Option icon="time" title="Gătesc rar, mult odată" desc="Accept același fel 4–5 mese. Mai puțin timp la aragaz." selected={v === 'rar'} onPress={() => onChange({ variety: 'rar' })} />
      </View>
      <NumberField label="Timp maxim de gătit într-o zi lucrătoare" value={s.maxPrepWeekday} step={5} min={5} max={300} suffix="min"
        onChange={(maxPrepWeekday) => onChange({ maxPrepWeekday })} />
      <NumberField label="Timp maxim în weekend" value={s.maxPrepWeekend} step={5} min={5} max={400} suffix="min"
        onChange={(maxPrepWeekend) => onChange({ maxPrepWeekend })} />
    </View>
  );
}

function DayDot({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ alignItems: 'center', gap: 4, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? t.primary : t.chip }}>
        <Ionicons name="flame" size={20} color={selected ? '#fff' : t.border} />
      </View>
      <Text style={{ fontSize: 12, fontWeight: '700', color: selected ? t.text : t.muted }}>{label}</Text>
    </Pressable>
  );
}

export function FastingForm({ s, onChange }: { s: Settings; onChange: (p: Partial<Settings>) => void }) {
  const fasts = s.fasting !== 'niciunul';
  const opts: [FastPref, IconName, string, string][] = [
    ['toate', 'calendar', 'Toate zilele de post', 'Posturile mari, miercuri, vineri și zilele speciale.'],
    ['posturile_mari', 'leaf', 'Doar posturile mari', 'Paște, Sf. Petru, Sf. Maria, Crăciun.'],
    ['miercuri_vineri', 'today', 'Doar miercurea și vinerea', 'Fără săptămânile fără post (harți).'],
  ];
  return (
    <View style={{ gap: 10 }}>
      <Option icon="restaurant" title="Nu țin post" desc="Mănânc orice, oricând." selected={!fasts} onPress={() => onChange({ fasting: 'niciunul' })} />
      <Option icon="leaf" title="Țin post" desc="După calendarul ortodox." selected={fasts} onPress={() => onChange({ fasting: fasts ? s.fasting : 'toate' })} />
      {fasts && (
        <View style={{ gap: 8, marginTop: 6 }}>
          <Segmented options={opts.map(([v, , title]) => ({ label: title.replace('Toate zilele de post', 'Toate').replace('Doar posturile mari', 'Posturile mari').replace('Doar miercurea și vinerea', 'Mie. și vin.'), value: v }))}
            value={s.fasting} onChange={(fasting) => onChange({ fasting })} />
          <T v="small">{opts.find((o) => o[0] === s.fasting)?.[3]}</T>
          {s.fasting !== 'miercuri_vineri' && (
            <ToggleRow title="Pește în zilele cu dezlegare" desc="Ex. sâmbăta și duminica în Postul Crăciunului, Buna Vestire, Florii." value={s.fishOnDispensation}
              onChange={(fishOnDispensation) => onChange({ fishOnDispensation })} />
          )}
        </View>
      )}
    </View>
  );
}

export function StoresForm({ s, onChange }: { s: Settings; onChange: (p: Partial<Settings>) => void }) {
  const t = useTheme();
  const stores = s.stores ?? [];
  const main = s.mainStore ?? stores[0];
  return (
    <View style={{ gap: 14 }}>
      <T v="small">Alege magazinele în care mergi. Lista săptămânii se face pentru un singur magazin, ca să nu umbli prin două.</T>
      <TileGrid>
        {STORES.map((st) => {
          const on = stores.includes(st.id);
          return (
            <Pressable key={st.id} onPress={() => {
              const n = toggle(stores, st.id);
              onChange({ stores: n, mainStore: n.includes(main as StoreId) ? main : n[0] });
            }} style={({ pressed }) => ({ width: '48%', padding: 14, borderRadius: 20, backgroundColor: on ? t.card : t.chip, borderWidth: 2.5,
              borderColor: on ? st.color : 'transparent', gap: 8, alignItems: 'flex-start', opacity: on ? 1 : 0.7, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              <StoreBadge id={st.id} small />
              <Row gap={4}>
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={on ? st.color : t.muted} />
                <T v="small">{on ? (main === st.id ? 'principal' : 'merg aici') : 'nu merg'}</T>
              </Row>
            </Pressable>
          );
        })}
      </TileGrid>
      {stores.length > 1 && (
        <View style={{ gap: 8 }}>
          <T v="h3">Unde mergi cel mai des?</T>
          <Row wrap>{stores.map((id) => <Chip key={id} label={STORES.find((x) => x.id === id)!.name} selected={main === id} onPress={() => onChange({ mainStore: id })} />)}</Row>
        </View>
      )}
      <View style={{ gap: 8 }}>
        <T v="h3">În ce zi faci de obicei cumpărăturile?</T>
        <Row style={{ justifyContent: 'space-between' }}>
          {DAY_NAMES.map((d, i) => <Chip key={d} label={d.slice(0, 2)} selected={(s.shopDay ?? 5) === i} onPress={() => onChange({ shopDay: i })} />)}
        </Row>
      </View>
    </View>
  );
}

export function ToggleRow({ title, desc, value, onChange }: { title: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="h3" style={{ fontSize: 15 }}>{title}</T>
        {desc ? <T v="small">{desc}</T> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.primary }} />
    </Card>
  );
}

export function IngredientPicker({ visible, onClose, onPick, exclude = [], includeStaples = true }: {
  visible: boolean; onClose: () => void; onPick: (id: string) => void; exclude?: string[]; includeStaples?: boolean;
}) {
  const t = useTheme();
  const [q, setQ] = useState('');
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const list = useMemo(() => INGREDIENTS
    .filter((i) => (includeStaples || !i.staple) && !exclude.includes(i.id) && norm(i.name).includes(norm(q)))
    .sort((a, b) => a.name.localeCompare(b.name, 'ro')), [q, exclude, includeStaples]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={{ padding: 16, gap: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="h2">Alege ingredient</T>
            <Btn title="Închide" variant="ghost" small onPress={onClose} />
          </Row>
          <Field value={q} onChangeText={setQ} placeholder="Caută (ex. roșii)" icon="search" />
        </View>
        <FlatList
          data={list}
          keyExtractor={(i) => i.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => { onPick(item.id); setQ(''); }}
              style={({ pressed }) => ({ paddingVertical: 10, borderBottomWidth: 0.5, borderColor: t.border, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.6 : 1 })}>
              <IngImage id={item.id} size={40} />
              <T style={{ flex: 1 }}>{item.name}</T>
              <Icon name="add-circle" color={t.primary} />
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
