import { ING } from '../data/ingredients';
import { RECIPES, RECIPE } from '../data/recipes';
import { addDays, DAY_NAMES, fromISO, toISO, weekdayMon } from './dates';
import { computeTargets } from './energy';
import { fastLevel } from './fasting';
import { fastAllows, hasEquipment, mergeRestrictions, perServing, proteinKind, recipeFits, type ProteinKind, type Restrictions } from './nutrition';
import { priceAt, type StoreId, type StorePrices } from './stores';
import { pantryTotals } from './pantry';
import { tasteBonus, type TasteProfile } from './taste';
import type {
  Cuisine,
  CookSession, FastLevel, Member, PantryItem, PlannedMeal, PortionShare, Recipe, RecipeMeal,
  Settings, ShoppingItem, Slot, WeekHousehold, WeekPlan,
} from './types';

export const SLOT_ORDER: Slot[] = ['mic_dejun', 'gustare1', 'pranz', 'gustare2', 'cina'];
export const SLOT_LABEL: Record<Slot, string> = {
  mic_dejun: 'Mic dejun', gustare1: 'Gustare (dimineața)', pranz: 'Prânz', gustare2: 'Gustare (după-amiaza)', cina: 'Cină',
};
const SLOT_WEIGHT: Record<Slot, number> = { mic_dejun: 25, gustare1: 10, pranz: 35, gustare2: 10, cina: 25 };
export const MAIN_SLOTS: Slot[] = ['pranz', 'cina'];
export const GUEST_KCAL = 2200;

export const mealKey = (day: number, slot: Slot) => `${day}|${slot}`;

export interface PlanInput {
  startISO: string;
  members: Member[];
  household: WeekHousehold;
  settings: Settings;
  pantry: PantryItem[];
  prices: Record<string, number>;
  liked: string[];
  disliked: string[];
  previousRecipeIds: string[];
  seed: number;
  recipes?: Recipe[];
  /** profilul de gust învățat din 👍/👎 */
  taste?: TasteProfile;
  /** magazinul ales și prețurile învățate din bonuri */
  store?: StoreId;
  storePrices?: StorePrices;
  /** rețete din săptămânile trecute: id → acum câte săptămâni (1 = săptămâna trecută) */
  history?: Record<string, number>;
  /** alese prin swipe pentru săptămâna asta (dreapta) și respinse (stânga) */
  wanted?: string[];
  skipped?: string[];
  /** bucătăriile alese pentru săptămâna asta (italiană, românească…) */
  weekCuisines?: Cuisine[];
  /** toate swipe-urile de până acum: un semnal slab de gust */
  swipes?: Record<string, 1 | -1>;
  /** mese fixate cu lacătul: rămân exact acolo când refaci planul */
  locked?: { day: number; slot: Slot; recipeId: string }[];
}

interface Person { id: string; kcal: number; isMain: boolean; isChild: boolean }

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function presentMembers(members: Member[], hh: WeekHousehold): Member[] {
  const present = members.filter((m) => hh.memberIds.includes(m.id));
  if (present.length) return present;
  const main = members.find((m) => m.isMain);
  return main ? [main] : members.slice(0, 1);
}

export function presentPeople(members: Member[], hh: WeekHousehold, at: Date): Person[] {
  const people: Person[] = presentMembers(members, hh).map((m) => {
    const t = computeTargets(m, at);
    return { id: m.id, kcal: t.kcal, isMain: m.isMain, isChild: t.isChild };
  });
  for (let g = 0; g < hh.guests; g++) people.push({ id: `guest_${g}`, kcal: GUEST_KCAL, isMain: false, isChild: false });
  return people;
}

export function slotShares(slots: Slot[]): Record<Slot, number> {
  const total = slots.reduce((s, x) => s + SLOT_WEIGHT[x], 0) || 1;
  const r = {} as Record<Slot, number>;
  SLOT_ORDER.forEach((s) => { r[s] = slots.includes(s) ? SLOT_WEIGHT[s] / total : 0; });
  return r;
}

export const priceOf = (ingId: string, prices: Record<string, number>, store?: StoreId, storePrices?: StorePrices) =>
  priceAt(ingId, store, prices, storePrices);

const pkgsFor = (ingId: string, g: number) => {
  if (g <= 0.5) return 0;
  return Math.ceil(g / ING[ingId].pkg - 1e-9);
};

/** cost proporțional pe porție (fără rotunjire la ambalaj) */
export function costPerPortion(r: Recipe, prices: Record<string, number>, store?: StoreId, storePrices?: StorePrices): number {
  let c = 0;
  for (const [id, g] of r.ing) {
    const i = ING[id];
    if (!i || i.staple) continue;
    c += ((g / r.servings) / i.pkg) * priceOf(id, prices, store, storePrices);
  }
  return c;
}

export function needsFromSessions(sessions: CookSession[]): Record<string, number> {
  const need: Record<string, number> = {};
  for (const s of sessions) {
    const r = RECIPE[s.recipeId];
    if (!r) continue;
    for (const [id, g] of r.ing) need[id] = (need[id] ?? 0) + (g * s.portions) / r.servings;
  }
  return need;
}

export function shoppingFromSessions(
  sessions: CookSession[], pantry: PantryItem[], prices: Record<string, number>, prevChecked: string[] = [],
  store?: StoreId, storePrices?: StorePrices, addBasics: string[] = [],
): { shopping: ShoppingItem[]; staples: { ingId: string; needG: number }[]; basics: { ingId: string; needG: number }[]; cost: number } {
  const need = needsFromSessions(sessions);
  const pan = pantryTotals(pantry);
  const shopping: ShoppingItem[] = [];
  const staples: { ingId: string; needG: number }[] = [];
  const basics: { ingId: string; needG: number }[] = [];
  let cost = 0;
  for (const [id, g] of Object.entries(need)) {
    const i = ING[id];
    if (!i) continue;
    if (i.staple) {
      if ((pan[id] ?? 0) <= 0) staples.push({ ingId: id, needG: g });
      continue;
    }
    if (i.basic && !addBasics.includes(id)) {
      if ((pan[id] ?? 0) < g) basics.push({ ingId: id, needG: g });
      continue;
    }
    const fromPantryG = Math.min(g, pan[id] ?? 0);
    const buyG = Math.max(0, g - fromPantryG);
    const packages = pkgsFor(id, buyG);
    const c = packages * priceOf(id, prices, store, storePrices);
    cost += c;
    shopping.push({
      ingId: id, needG: g, fromPantryG, buyG, packages, cost: c,
      leftoverG: Math.max(0, packages * i.pkg - buyG), checked: prevChecked.includes(id),
    });
  }
  return { shopping, staples, basics, cost };
}

/** ora la care e de obicei masa (pe ecranul Azi) și ora după care o socotesc mâncată, dacă n-ai zis altceva */
/*
 * Fără ore: mesele se numesc după ordinea lor în zi („Prima masă”, „A doua masă”),
 * după câte ai ales să mănânci. Gustările rămân „Gustare”.
 */
let labelSlots: Slot[] = ['pranz', 'cina'];
export function setLabelSlots(slots: Slot[]) { if (slots?.length) labelSlots = slots; }
const ORD = ['Prima', 'A doua', 'A treia', 'A patra', 'A cincea'];
export function mealLabel(slot: Slot, slots: Slot[] = labelSlots): string {
  const isSnack = (x: Slot) => x.startsWith('gustare');
  if (isSnack(slot)) {
    const sn = SLOT_ORDER.filter((x) => slots.includes(x) && isSnack(x));
    return sn.length > 1 ? `${sn.indexOf(slot) === 0 ? 'Prima' : 'A doua'} gustare` : 'Gustare';
  }
  const mains = SLOT_ORDER.filter((x) => slots.includes(x) && !isSnack(x));
  const i = mains.indexOf(slot);
  return i >= 0 ? `${ORD[i]} masă` : SLOT_LABEL[slot];
}

export const SLOT_TIME: Record<Slot, { at: string; done: number }> = {
  mic_dejun: { at: '8:30', done: 10.5 },
  gustare1: { at: '11:00', done: 12.5 },
  pranz: { at: '13:30', done: 15.5 },
  gustare2: { at: '17:00', done: 18.5 },
  cina: { at: '20:00', done: 21.5 },
};

/** câte variante de mic dejun / gustare pe săptămână */
const ROUTINE: Record<'mare' | 'echilibrat' | 'rar', number> = { mare: 3, echilibrat: 2, rar: 2 };

/** sursa principală de proteine (compatibilitate) */
export function proteinCategory(r: Recipe): 'carne' | 'peste' | 'leguminoase' | 'oua_lactate' | 'legume' {
  const k = proteinKind(r);
  if (k === 'peste' || k === 'fructe_mare') return 'peste';
  if (k === 'leguminoase' || k === 'oua_lactate' || k === 'legume') return k;
  return 'carne';
}

/** cât din mesele principale ar trebui să aibă fiecare fel de proteină, după cât de des vrei carne */
const KIND_TARGET: Record<'des' | 'echilibrat' | 'rar', Partial<Record<ProteinKind, number>>> = {
  des: { pui: 0.3, porc: 0.22, vita: 0.16, curcan: 0.04, miel: 0.03, peste: 0.1, fructe_mare: 0.03, leguminoase: 0.05, oua_lactate: 0.04, legume: 0.03 },
  echilibrat: { pui: 0.26, porc: 0.18, vita: 0.13, curcan: 0.05, miel: 0.02, peste: 0.1, fructe_mare: 0.02, leguminoase: 0.1, oua_lactate: 0.08, legume: 0.06 },
  rar: { pui: 0.12, porc: 0.06, vita: 0.06, curcan: 0.03, miel: 0.01, peste: 0.14, fructe_mare: 0.03, leguminoase: 0.25, oua_lactate: 0.17, legume: 0.13 },
};

/** ținta pe feluri de proteină, doar pentru felurile care apar în rețetele permise */
function kindTargets(style: 'des' | 'echilibrat' | 'rar', eligible: Recipe[]): Partial<Record<ProteinKind, number>> {
  const present = new Set(eligible.filter((r) => r.meal.includes('principal')).map(proteinKind));
  const base = KIND_TARGET[style];
  const out: Partial<Record<ProteinKind, number>> = {};
  let sum = 0;
  for (const [k, v] of Object.entries(base) as [ProteinKind, number][]) if (present.has(k)) { out[k] = v; sum += v; }
  for (const k of Object.keys(out) as ProteinKind[]) out[k] = (out[k] ?? 0) / (sum || 1);
  return out;
}

/** câte mese principale poate acoperi aceeași rețetă gătită o dată */
export const MAX_USES: Record<'mare' | 'echilibrat' | 'rar', number> = { mare: 2, echilibrat: 3, rar: 5 };
const CUISINE_DEFAULT: Partial<Record<string, number>> = { ro: 0.4, eu: 0.15, it: 0.15, med: 0.1 };
/** cât de familiară e o bucătărie pentru cineva din România, când rețeta nu spune altfel */
const CUISINE_FAM: Record<string, number> = { ro: 1, it: 0.9, eu: 0.85, med: 0.8, us: 0.65, mx: 0.5, or: 0.55, as: 0.45, in: 0.45 };
export const familiarity = (r: Recipe) => r.familiar ?? CUISINE_FAM[r.cuisine ?? 'eu'] ?? 0.7;
/** dulce: desert declarat sau gustare cu mult zahăr (gogoși, prăjituri) */
const SOUP = /^(Ciorb|Sup[ăa] |Supă-|Borș|Bors|Zeam)/;
export const isSoup = (r: Recipe) => SOUP.test(r.name);
export const isSweet = (r: Recipe) => !!r.tags?.includes('desert') || (r.meal.includes('gustare') && perServing(r).sug >= 18);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

function round05(x: number) { return Math.round(x * 20) / 20; }
const round025 = (x: number) => Math.round(x * 4) / 4;

/**
 * Suma meselor dintr-o zi trebuie să iasă cât ținta fiecăruia (±5%), nu peste.
 * Porțiile se ajustează în pași de ¼, între ½ și maxim, pornind de la masa cea mai mare.
 */
export function fitDailyKcal(meals: PlannedMeal[], people: { id: string; kcal: number }[], maxFactor = 2) {
  const kcalOf = (m: PlannedMeal) => (RECIPE[m.recipeId] ? perServing(RECIPE[m.recipeId]).kcal : 0);
  for (const p of people) {
    for (let d = 0; d < 7; d++) {
      const day = meals.filter((m) => m.day === d);
      if (!day.length) continue;
      const share = (m: PlannedMeal) => m.shares.find((x) => x.memberId === p.id);
      const sideK = (m: PlannedMeal) => (m.sides ?? []).reduce((a, x) => a + (RECIPE[x.recipeId] ? perServing(RECIPE[x.recipeId]).kcal * (x.shares.find((y) => y.memberId === p.id)?.factor ?? 0) : 0), 0);
      const total = () => day.reduce((a, m) => a + kcalOf(m) * (share(m)?.factor ?? 0) + sideK(m), 0);
      // ce se poate ajusta: felul principal (în pași de ¼) și pâinea de lângă el (în pași de ½ = 50 g)
      type Knob = { get: () => number; set: (v: number) => void; k: number; step: number; min: number; max: number; bread: boolean };
      const knobs: Knob[] = [];
      for (const m of day) {
        const sh = share(m);
        if (sh) knobs.push({ get: () => sh.factor, set: (v) => { sh.factor = v; }, k: kcalOf(m), step: 0.25, min: 0.5, max: m.sides?.length ? Math.min(m.sides.some((x) => x.recipeId === 'garnitura_paine') ? 1.5 : 2, maxFactor) : maxFactor, bread: false });
        for (const sd of m.sides ?? []) {
          const x = sd.shares.find((y) => y.memberId === p.id);
          if (!x || !RECIPE[sd.recipeId]) continue;
          // pâinea se ajustează întâi (pași de 50 g); ciorba doar în jos, pentru cine mănâncă mai puțin
          if (sd.recipeId === 'garnitura_paine') knobs.push({ get: () => x.factor, set: (v) => { x.factor = v; }, k: perServing(RECIPE[sd.recipeId]).kcal, step: 0.5, min: 0.5, max: 2, bread: true });
          else knobs.push({ get: () => x.factor, set: (v) => { x.factor = v; }, k: perServing(RECIPE[sd.recipeId]).kcal, step: 0.25, min: 0.5, max: x.factor, bread: true });
        }
      }
      for (let guard = 0; guard < 60; guard++) {
        const t = total();
        if (t > p.kcal * 1.05) {
          // cobor întâi pâinea, apoi felul care aduce cele mai multe calorii
          const c = knobs.filter((x) => x.get() - x.step >= x.min).sort((a, b) => Number(b.bread) - Number(a.bread) || b.k * b.get() - a.k * a.get())[0];
          if (!c) break;
          c.set(Math.max(c.min, c.get() - c.step));
        } else if (t < p.kcal * 0.93) {
          // urc întâi felul principal până la porția lui firească, apoi pâinea
          const c = knobs.filter((x) => x.get() + x.step <= x.max && x.k * x.step <= p.kcal * 1.05 - t)
            .sort((a, b) => Number(a.bread) - Number(b.bread) || a.k * a.get() - b.k * b.get())[0];
          if (!c) break;
          c.set(Math.min(c.max, c.get() + c.step));
        } else break;
      }
    }
  }
}
/** se gătește un număr întreg de porții (surplusul rămâne la frigider) */
export const wholePortions = (x: number) => Math.max(1, Math.ceil(x - 0.2));

export function buildOnce(input: PlanInput, costWeight: number): WeekPlan {
  const { settings: st } = input;
  const recipes = input.recipes ?? RECIPES;
  const start = fromISO(input.startISO);
  const people = presentPeople(input.members, input.household, start);
  const mainPerson = people.find((p) => p.isMain) ?? people[0];
  const mainMember = input.members.find((m) => m.id === mainPerson?.id);
  const mainTg = mainMember ? computeTargets(mainMember, start) : undefined;
  const mainGoal = mainTg?.goal ?? 'mentinere';
  // proteinele și fibrele țintă, ca densitate (cât din calorii / la 1000 kcal): rețetele se aleg să le atingă
  const pTarget = mainTg && mainTg.kcal ? (mainTg.protein * 4) / mainTg.kcal : 0.2;
  const fibTarget = mainTg && mainTg.kcal ? (mainTg.fiber * 1000) / mainTg.kcal : 14;
  const fTarget = mainTg && mainTg.kcal ? (mainTg.fat * 9) / mainTg.kcal : 0.3;
  // ce s-a strâns până acum în plan (pentru persoana principală): următoarea rețetă compensează, ca săptămâna să iasă echilibrată
  const acc = { kcal: 0, p: 0, f: 0 };
  const desired = (target: number, got: number) => (acc.kcal > 0 ? clamp(target + (target - got / acc.kcal), target * 0.6, target * 1.5) : target);
  const hasKids = people.some((p) => p.isChild);
  const rs: Restrictions = mergeRestrictions(presentMembers(input.members, input.household));
  const fitting = recipes.filter(
    (r) => recipeFits(r, rs) && hasEquipment(r, st.equipment) && !input.disliked.includes(r.id),
  );
  // rețetele exotice intră doar dacă le-ai cerut: bucătăria aleasă, o rețetă care ți-a plăcut sau pe care ai ales-o
  const optedIn = (r: Recipe) => input.liked.includes(r.id) || !!input.wanted?.includes(r.id) || (input.swipes?.[r.id] ?? 0) > 0
    || !!input.weekCuisines?.includes(r.cuisine ?? 'eu') || st.cuisines?.[r.cuisine ?? 'eu'] === 1;
  const familiarOnly = fitting.filter((r) => familiarity(r) >= 0.55 || optedIn(r));
  const eligible = familiarOnly.filter((r) => r.meal.includes('principal')).length >= 25 ? familiarOnly : fitting;
  const variety = st.variety ?? 'mare';
  const targets = kindTargets(st.meatStyle ?? 'echilibrat', eligible);
  const kindUse: Partial<Record<ProteinKind, number>> = {};
  const mainKinds: ProteinKind[] = [];
  const history = input.history ?? {};
  const dessertCap = st.dessertsPerWeek ?? 2;
  let desserts = 0;
  const fastDays: FastLevel[] = Array.from({ length: 7 }, (_, d) =>
    input.household.applyFasting ? fastLevel(addDays(start, d), st.fasting, st.fishOnDispensation) : 'none');
  const shares = slotShares(st.slots);
  const rand = mulberry32(input.seed);
  const pantryTot = pantryTotals(input.pantry);
  const expiring = new Set(
    input.pantry.filter((p) => fromISO(p.expiresISO).getTime() <= addDays(start, 3).getTime()).map((p) => p.ingId),
  );
  const totalKcalWeek = 7 * people.reduce((s, p) => s + p.kcal, 0) || 1;
  const budgetPerKcal = Math.max(0.001, input.settings.budgetRon / totalKcalWeek);

  const need: Record<string, number> = {};
  const sessions: CookSession[] = [];
  const meals: PlannedMeal[] = [];
  const warnings: string[] = [];
  const newUse: Record<string, number> = {};
  let sid = 0;

  const dateOf = (d: number) => addDays(start, d);
  const isWeekend = (d: number) => weekdayMon(dateOf(d)) >= 5;
  const maxPrep = (d: number) => (isWeekend(d) ? st.maxPrepWeekend : st.maxPrepWeekday);
  const isCookingDay = (d: number) => d === 0 || st.cookingDays.includes(weekdayMon(dateOf(d)));

  const sharesFor = (r: Recipe, slot: Slot): PortionShare[] => {
    const k = perServing(r).kcal || 1;
    return people.map((p) => ({ memberId: p.id, factor: round025(Math.min(2, Math.max(0.5, (p.kcal * shares[slot]) / k))) }));
  };
  const sum = (s: PortionShare[]) => s.reduce((a, b) => a + b.factor, 0);

  const marginalCost = (r: Recipe, portions: number) => {
    let c = 0;
    for (const [id, g] of r.ing) {
      const i = ING[id];
      if (!i || i.staple || i.basic) continue;
      const add = (g * portions) / r.servings;
      const cur = need[id] ?? 0;
      const pan = pantryTot[id] ?? 0;
      const before = Math.max(0, cur - pan);
      const after = Math.max(0, cur + add - pan);
      const price = priceOf(id, input.prices, input.store, input.storePrices);
      // cât plătești în plus la casă: un ingredient nou costă tot ambalajul, iar restul dintr-un ambalaj
      // deja cumpărat e aproape gratis. Așa planul refolosește ingredientele și lista rămâne scurtă.
      const prop = ((after - before) / i.pkg) * price;
      const rounded = (pkgsFor(id, after) - pkgsFor(id, before)) * price;
      c += rounded > 0 ? rounded : 0.25 * prop;
    }
    return c;
  };
  const pantryBonus = (r: Recipe, portions: number) => {
    const real = r.ing.filter(([id]) => !ING[id]?.staple);
    if (!real.length) return 0;
    let b = 0;
    for (const [id, g] of real) {
      const add = (g * portions) / r.servings;
      const left = Math.max(0, (pantryTot[id] ?? 0) - (need[id] ?? 0));
      b += Math.min(1, left / add) * (expiring.has(id) ? 2.5 : 1);
    }
    return (b / real.length) * 3;
  };
  const commit = (r: Recipe, portions: number) => {
    for (const [id, g] of r.ing) need[id] = (need[id] ?? 0) + (g * portions) / r.servings;
  };

  const isWantedOrLiked = (r: Recipe) => input.liked.includes(r.id) || !!input.wanted?.includes(r.id) || (input.swipes?.[r.id] ?? 0) > 0;
  const score = (r: Recipe, slot: Slot, kind: 'main' | 'quick', avoid: (string | undefined)[]) => {
    const sh = sharesFor(r, slot);
    const portions = sum(sh);
    let s = rand() * 1.5;
    if (input.liked.includes(r.id)) s += 2;
    s += tasteBonus(r, input.taste);
    // ce ai ales tu prin swipe intră sigur, chiar dacă e mai scump: depășirea de buget e semnalată
    // (cele care cer mult timp au prioritate în zilele în care ai timp, ca să încapă toate)
    const isWanted = kind === 'main' && !!input.wanted?.includes(r.id) && !newUse[r.id];
    if (isWanted) s += 40 + (r.prep > st.maxPrepWeekday ? 8 : 0);
    if (input.skipped?.includes(r.id)) s -= 6;
    const sw = input.swipes?.[r.id];
    if (sw) s += sw > 0 ? 0.6 : -1.2;
    // varietate de la o săptămână la alta: ce ai mâncat recent coboară, ce n-ai încercat urcă puțin
    const ago = history[r.id] ?? (input.previousRecipeIds.includes(r.id) ? 1 : 0);
    // rețetele tale de bază (cu „îmi place”) revin singure la 2–3 săptămâni, dar nu săptămână de săptămână
    if (input.liked.includes(r.id)) s += ago === 1 ? -3 : ago >= 2 ? 3 : 0;
    else if (ago > 0) s -= 4 / ago;
    else if (!input.taste?.seen?.[r.id]) s += 0.6;
    s -= (newUse[r.id] ?? 0) * (kind === 'main' ? 6 : 0.4);
    const pref = st.cuisines?.[r.cuisine ?? 'eu'];
    // rețete familiare, care îți vin să le gătești: cele exotice apar doar dacă alegi bucătăria lor sau ți-au plăcut
    const fam = familiarity(r);
    const chose = pref === 1 || !!input.weekCuisines?.includes(r.cuisine ?? 'eu');
    if (!isWantedOrLiked(r)) s += chose ? Math.max(0, fam - 0.8) * 4 : (fam - 0.8) * 10;
    s += pref === 1 ? 1 : pref === -1 ? -2.5 : CUISINE_DEFAULT[r.cuisine ?? 'eu'] ?? 0;
    if (kind === 'main' && input.weekCuisines?.length) s += input.weekCuisines.includes(r.cuisine ?? 'eu') ? 4 : -4;
    if (kind === 'main') {
      // echilibru între felurile de proteină (pui, porc, vită, pește, leguminoase…), după cât de des vrei carne
      const n = Object.values(kindUse).reduce((a, b) => a + (b ?? 0), 0);
      const k = proteinKind(r);
      const deficit = (targets[k] ?? 0) * (n + 1) - (kindUse[k] ?? 0);
      // când bugetul strânge, echilibrul contează la fel de mult: carne ieftină (pulpe, tocătură), nu doar fasole
      const kw = 2.5 + (st.meatStyle === 'rar' ? 0 : 0.18 * costWeight);
      s += Math.max(-4 - costWeight * 0.1, Math.min(3 + costWeight * 0.15, deficit * kw));
      // nu aceeași carne la mese consecutive
      if (mainKinds[mainKinds.length - 1] === k) s -= 1.5;
      if (mainKinds[mainKinds.length - 2] === k) s -= 0.6;
    }
    const sweet = isSweet(r);
    if (sweet) s -= desserts >= dessertCap ? 8 : 0.5;
    if (avoid[0] === r.id) s -= 5;
    if (avoid[1] === r.id) s -= 2.5;
    s += pantryBonus(r, portions);
    const ps0 = perServing(r);
    const kcal = ps0.kcal * portions || 1;
    // costul contează puțin cât timp rețeta e în ritmul bugetului și mult când îl depășește.
    // Banii se judecă pe valoare, nu doar pe calorii: o masă cu proteine are voie să coste ceva mai mult decât paste goale.
    const pVal = ps0.kcal ? clamp((ps0.p * 4) / ps0.kcal / pTarget, 0.4, 1.5) : 1;
    const ratio = marginalCost(r, portions) / (kcal * budgetPerKcal * (0.55 + 0.45 * pVal));
    // ce ai ales tu nu e scos din cauza prețului (swipe-ul ți-a arătat deja cât costă); bugetul îl strâng pe restul
    if (!isWanted) s -= 0.3 * ratio + costWeight * Math.max(0, ratio - 1.1);
    const ps = perServing(r);
    if (ps.kcal > 0) {
      // proteine cât ținta ta (nu paste goale la fiecare masă), fibre, puțin zahăr și sare
      const pShare = (ps.p * 4) / ps.kcal;
      const fShare = (ps.f * 9) / ps.kcal;
      s += clamp(2.5 - Math.abs(pShare - desired(pTarget, acc.p * 4)) * (kind === 'main' ? 20 : 12), -4, 2.5);
      s += clamp(1 - Math.abs(fShare - desired(fTarget, acc.f * 9)) * 8, -2, 1);
      // masă principală aproape fără proteine (paste simple, cartofi): rar, nu de bază
      if (kind === 'main' && pShare < 0.14) s -= 2;
      s += clamp(((ps.fib * 1000) / ps.kcal - fibTarget) * 0.1, -1, 1);
      if (!sweet) s -= clamp((ps.sug - (kind === 'main' ? 12 : 20)) * 0.08, 0, 2);
      s -= clamp((ps.salt - 2.2) * 0.8, 0, 2);
    }
    if (hasKids && r.tags?.includes('copii')) s += 0.7;
    if (mainPerson) {
      // o porție normală, nu dublă sau jumătate: rețeta potrivită ca mărime pentru masa asta
      const slotK = mainPerson.kcal * shares[slot];
      // la o masă mare, felul principal vine cu ciorbă și pâine: îl judec pe ce rămâne după ele
      const raw = (kind === 'main' && slotK > 1000 ? Math.max(slotK * 0.55, slotK - 600) : slotK) / (ps.kcal || 1);
      s -= 2.2 * Math.abs(Math.log(Math.max(0.2, raw)));
      // la mese mari, paste/orez simple ar însemna farfurie dublă: rar
      if (kind === 'main' && slotK > 1000 && ps.kcal && (ps.c * 4) / ps.kcal > 0.5) s -= 1.2;
    }
    return s;
  };

  const best = (cands: Recipe[], slot: Slot, kind: 'main' | 'quick', avoid: (string | undefined)[]) => {
    let top: Recipe | undefined;
    let topS = -Infinity;
    const dbg = (globalThis as { __planDebug?: (x: { slot: Slot; kind: string; costWeight: number; list: [string, number][] }) => void }).__planDebug;
    const list: [string, number][] = [];
    for (const r of cands) {
      const s = score(r, slot, kind, avoid);
      if (dbg) list.push([r.id, s]);
      if (s > topS) { topS = s; top = r; }
    }
    if (dbg) dbg({ slot, kind, costWeight, list: list.sort((a, b) => b[1] - a[1]).slice(0, 8) });
    return top;
  };

  const newSession = (r: Recipe, day: number, extra = false): CookSession => {
    const s: CookSession = { id: `s${sid++}`, day, recipeId: r.id, portions: 0, extra };
    sessions.push(s);
    newUse[r.id] = (newUse[r.id] ?? 0) + 1;
    return s;
  };
  const addMeal = (s: CookSession, r: Recipe, day: number, slot: Slot, frozen = false) => {
    const sh = sharesFor(r, slot);
    const p = sum(sh);
    s.portions = round05(s.portions + p);
    commit(r, p);
    if (frozen) s.freeze = true;
    meals.push({ day, slot, recipeId: r.id, sessionId: s.id, shares: sh, frozen: frozen || undefined });
    if (isSweet(r)) desserts++; // dulciurile se numără pe mese, nu pe gătiri
    const mf = sh.find((x) => x.memberId === mainPerson?.id)?.factor ?? 0;
    if (mf) { const ps = perServing(r); acc.kcal += ps.kcal * mf; acc.p += ps.p * mf; acc.f += ps.f * mf; }
    if (MAIN_SLOTS.includes(slot)) {
      const k = proteinKind(r);
      mainKinds.push(k);
      kindUse[k] = (kindUse[k] ?? 0) + 1; // echilibrul se socotește pe mese, nu pe gătiri
    }
  };

  // ── Mesele principale, pe ferestre între zilele de gătit ──
  const mainSlots = SLOT_ORDER.filter((s) => MAIN_SLOTS.includes(s) && st.slots.includes(s));
  if (mainSlots.length) {
    const windows: [number, number][] = [];
    for (let d = 0; d < 7; d++) {
      if (isCookingDay(d)) windows.push([d, d]);
      else windows[windows.length - 1][1] = d;
    }
    let prevMain: string | undefined;
    for (const [ws, we] of windows) {
      const totalSlots = (we - ws + 1) * mainSlots.length;
      // câte rețete gătești în ziua respectivă: destule cât să nu mănânci același fel de prea multe ori.
      // La 2 mese pe zi, o oală ține două zile: gătești mai rar, cu mai puține rețete odată.
      const maxUse = MAX_USES[variety];
      const k = Math.max(1, Math.min(5, totalSlots, Math.ceil(totalSlots / maxUse)));
      const win: { s: CookSession; r: Recipe; uses: number }[] = [];
      for (let d = ws; d <= we; d++) {
        const age = d - ws;
        const level = fastDays[d];
        for (const slot of mainSlots) {
          const keeps = (r: Recipe) => age <= r.keepsDays || !!r.freezable;
          const todayIds = meals.filter((m) => m.day === d && MAIN_SLOTS.includes(m.slot)).map((m) => m.recipeId);
          const reusable = win.filter((x) => fastAllows(level, x.r) && keeps(x.r) && x.r.id !== prevMain && x.uses < maxUse
            && (variety === 'rar' || !todayIds.includes(x.r.id)));
          // ce ai ales tu intră chiar dacă trece de timpul obișnuit de gătit (te anunț)
          const newCands = eligible.filter((r) => r.meal.includes('principal') && fastAllows(level, r)
            && (r.prep <= maxPrep(ws) || (!!input.wanted?.includes(r.id) && !newUse[r.id]))
            && keeps(r) && !win.some((x) => x.r.id === r.id));
          let chosen: { s: CookSession; r: Recipe; frozen: boolean } | undefined;
          // masa fixată cu lacătul rămâne exact aici
          const lk = input.locked?.find((l) => l.day === d && l.slot === slot);
          const lr = lk ? recipes.find((r) => r.id === lk.recipeId) : undefined;
          if (lr) {
            const ex = win.find((x) => x.r.id === lr.id);
            if (ex) chosen = { s: ex.s, r: lr, frozen: age > lr.keepsDays };
            else {
              const s = newSession(lr, age <= lr.keepsDays || lr.freezable ? ws : d);
              win.push({ s, r: lr, uses: 0 });
              chosen = { s, r: lr, frozen: age > lr.keepsDays };
            }
          }
          const pickNew = () => {
            const r = best(newCands, slot, 'main', [prevMain]);
            if (!r) return undefined;
            const s = newSession(r, ws);
            win.push({ s, r, uses: 0 });
            if (r.prep > maxPrep(ws)) warnings.push(`${r.name} durează ${r.prep} min și e ${DAY_NAMES[weekdayMon(dateOf(ws))].toLowerCase()}: ai ales-o tu, așa că am păstrat-o. Dacă atunci nu ai timp, apasă „Schimbă”.`);
            return { s, r, frozen: age > r.keepsDays };
          };
          if (!chosen && win.length < k && newCands.length) chosen = pickNew();
          if (!chosen && reusable.length) {
            // resturile: întâi cel gătit cel mai devreme și folosit cel mai puțin, cu altă proteină decât masa de dinainte
            const last = mainKinds[mainKinds.length - 1];
            const pool = [...reusable].sort((a, b) => a.uses - b.uses
              || Number(proteinKind(a.r) === last) - Number(proteinKind(b.r) === last) || a.s.day - b.s.day);
            const x = pool[0];
            chosen = { s: x.s, r: x.r, frozen: age > x.r.keepsDays };
          }
          if (!chosen && newCands.length) chosen = pickNew();
          if (!chosen) {
            // nimic din ziua de gătit nu ține până azi: gătit rapid în ziua respectivă
            let ex = eligible.filter((r) => r.meal.includes('principal') && fastAllows(level, r) && r.prep <= Math.min(30, maxPrep(d)));
            if (!ex.length) ex = eligible.filter((r) => r.meal.includes('principal') && fastAllows(level, r));
            const r = best(ex, slot, 'main', [prevMain]);
            if (!r) {
              warnings.push(`${DAY_NAMES[weekdayMon(dateOf(d))]} – ${SLOT_LABEL[slot]}: nicio rețetă nu se potrivește restricțiilor și echipamentelor.`);
              continue;
            }
            const s = newSession(r, d, true);
            chosen = { s, r, frozen: false };
          }
          const w = win.find((x) => x.s.id === chosen!.s.id);
          if (w) w.uses++;
          addMeal(chosen.s, chosen.r, d, slot, chosen.frozen);
          prevMain = chosen.r.id;
        }
      }
    }
  }

  // ── Mic dejun și gustări ──
  const quickSlots = SLOT_ORDER.filter((s) => !MAIN_SLOTS.includes(s) && st.slots.includes(s));
  const quickSessions: { s: CookSession; r: Recipe; uses: number; slot: Slot }[] = [];
  const rotation: Partial<Record<Slot, string[]>> = {};
  for (let d = 0; d < 7; d++) {
    const level = fastDays[d];
    for (const slot of quickSlots) {
      const type: RecipeMeal = slot === 'mic_dejun' ? 'mic_dejun' : 'gustare';
      const limit = isCookingDay(d) ? Math.min(45, maxPrep(d)) : isWeekend(d) ? 30 : 20;
      const reusableIds = new Set(quickSessions
        .filter((q) => q.slot === slot && d - q.s.day <= q.r.keepsDays && q.r.keepsDays > 0 && q.uses < (variety === 'rar' ? 4 : 2) && fastAllows(level, q.r))
        .map((q) => q.r.id));
      const all = eligible.filter((r) => r.meal.includes(type) && fastAllows(level, r) && (r.prep <= limit || reusableIds.has(r.id)));
      // mic dejun și gustări: o rutină de 2–3 variante pe săptămână, ca în viața reală.
      // Mai puține ingrediente diferite = listă mai scurtă și bani mai puțini pe ambalaje începute.
      const rot = (rotation[slot] ??= []);
      // după ce s-au strâns dulciurile săptămânii, nu mai intră altele (dacă există altceva)
      const notSweet = (xs: Recipe[]) => { const ns = xs.filter((x) => !isSweet(x)); return desserts >= dessertCap && ns.length ? ns : xs; };
      const inRot = notSweet(all).filter((r) => rot.includes(r.id));
      const cands = rot.length >= ROUTINE[variety] && inRot.length ? inRot : notSweet(all);
      const yesterday = meals.find((m) => m.day === d - 1 && m.slot === slot)?.recipeId;
      const sameDayOther = meals.find((m) => m.day === d && !MAIN_SLOTS.includes(m.slot))?.recipeId;
      const lockedQ = input.locked?.find((l) => l.day === d && l.slot === slot);
      const r = (lockedQ && recipes.find((x) => x.id === lockedQ.recipeId))
        || best(cands.filter((c) => c.id !== yesterday), slot, 'quick', [yesterday, sameDayOther])
        || best(cands, slot, 'quick', [yesterday, sameDayOther]);
      if (r && !rot.includes(r.id)) rot.push(r.id);
      if (!r) {
        warnings.push(`${DAY_NAMES[weekdayMon(dateOf(d))]} – ${SLOT_LABEL[slot]}: nicio rețetă potrivită.`);
        continue;
      }
      let q = reusableIds.has(r.id)
        ? quickSessions.find((x) => x.r.id === r.id && x.slot === slot && d - x.s.day <= r.keepsDays && x.uses < 4)
        : undefined;
      if (!q) {
        q = { s: newSession(r, d), r, uses: 0, slot };
        quickSessions.push(q);
      }
      q.uses++;
      addMeal(q.s, r, d, slot);
    }
  }

  for (const s of sessions) {
    const r = RECIPE[s.recipeId];
    const dn = DAY_NAMES[weekdayMon(dateOf(s.day))];
    if (s.extra) warnings.push(`${dn}: gătești ceva rapid (${r.name}), pentru că mâncarea din ziua de gătit nu ține până atunci.`);
    if (s.freeze) {
      const days = meals.filter((m) => m.sessionId === s.id && m.frozen).map((m) => DAY_NAMES[weekdayMon(dateOf(m.day))]);
      warnings.push(`${r.name}: congelează porțiile pentru ${[...new Set(days)].join(', ')} imediat după gătit.`);
    }
  }

  // ── Masa întreagă, ca acasă ──
  // La o masă mare (de obicei la 2 mese pe zi) felul principal vine cu ciorbă, pâine sau salată,
  // nu cu două porții și jumătate din același fel. Ciorba se face într-o oală pe ziua de gătit și ține câteva zile.
  if (mainPerson) {
    const cookDayFor = (d: number) => { let c = 0; for (let x = 0; x <= d; x++) if (isCookingDay(x)) c = x; return c; };
    const firstMain = mainSlots[0];
    const pots: { s: CookSession; r: Recipe; uses: number }[] = [];
    const breadBy: Record<number, CookSession> = {};
    // garniturile respectă și ele alergiile, dieta și postul (fără pâine la cine n-are voie gluten)
    const okSide = (r: Recipe | undefined) => (r && recipeFits(r, rs) ? r : undefined);
    const bread = okSide(recipes.find((r) => r.id === 'garnitura_paine') ?? RECIPE.garnitura_paine);
    const salad = okSide(recipes.find((r) => r.id === 'garnitura_salata') ?? RECIPE.garnitura_salata);
    const soups = eligible.filter((r) => isSoup(r) && r.meal.includes('principal') && familiarity(r) >= 0.7);
    for (const m of meals.filter((x) => MAIN_SLOTS.includes(x.slot))) {
      const r = RECIPE[m.recipeId] ?? recipes.find((x) => x.id === m.recipeId);
      const ps = r ? perServing(r) : undefined;
      if (!r || !ps?.kcal) continue;
      const want = mainPerson.kcal * shares[m.slot];
      if (want / ps.kcal <= 1.45) continue;
      const cd = cookDayFor(m.day);
      const sides: NonNullable<PlannedMeal['sides']> = [];
      const all = () => people.map((p) => ({ memberId: p.id, factor: 1 }));
      let left = want - 1.25 * ps.kcal; // felul principal rămâne cam o porție și ceva
      // 1) ciorbă, la prima masă principală a zilei, din oala zilei de gătit
      if (!isSoup(r) && m.slot === firstMain && left >= 250 && soups.length) {
        const level = fastDays[m.day];
        const pot = pots.find((x) => x.s.day === cd && m.day - cd <= x.r.keepsDays && fastAllows(level, x.r) && x.r.id !== r.id && proteinKind(x.r) !== proteinKind(r));
        let soup: { s: CookSession; r: Recipe } | undefined = pot;
        if (pot) pot.uses++;
        else {
          // nu fasole lângă fasole: ciorba are alt fel de proteină decât felul principal
          const cands = soups.filter((x) => fastAllows(level, x) && x.id !== r.id && x.prep <= maxPrep(cd) && m.day - cd <= x.keepsDays && proteinKind(x) !== proteinKind(r));
          const pick = best(cands, m.slot, 'quick', [pots[pots.length - 1]?.r.id]);
          if (pick) { soup = { s: newSession(pick, cd), r: pick }; pots.push({ ...soup, uses: 1 }); }
        }
        if (soup) { const sh = all(); sides.push({ recipeId: soup.r.id, sessionId: soup.s.id, shares: sh }); commit(soup.r, sum(sh)); left -= perServing(soup.r).kcal; }
      }
      // 2) pâine (sau salată, lângă paste și orez), cât să nu mănânci porție dublă din felul principal
      const carbHeavy = (ps.c * 4) / ps.kcal > 0.5 && !isSoup(r);
      if (left >= 120 && !carbHeavy && bread && fastAllows(fastDays[m.day], bread)) {
        // pâinea se cumpără la ziua de gătit și ține 4 zile; după aceea, alta proaspătă
        const bd = m.day - cd <= bread.keepsDays ? cd : m.day;
        const ses = (breadBy[bd] ??= newSession(bread, bd));
        ses.nocook = true;
        const f = clamp(Math.round((left / perServing(bread).kcal) * 2) / 2, 0.5, 1.5);
        const sh = people.map((p) => ({ memberId: p.id, factor: f }));
        sides.push({ recipeId: bread.id, sessionId: ses.id, shares: sh });
        commit(bread, sum(sh));
      } else if (carbHeavy && salad && !sides.length && fastAllows(fastDays[m.day], salad)) {
        const ses = newSession(salad, m.day);
        ses.nocook = true; // o salată se face pe loc, nu e „zi de gătit”
        const sh = all();
        sides.push({ recipeId: salad.id, sessionId: ses.id, shares: sh });
        commit(salad, sum(sh));
      }
      if (sides.length) {
        m.sides = sides;
        // felul principal cât o porție și ceva; restul vine din ciorbă și pâine (fitDailyKcal ajustează pâinea)
        for (const sh of m.shares) {
          const pp = people.find((x) => x.id === sh.memberId);
          if (!pp) continue;
          const sk = sides.reduce((a, x) => a + perServing(RECIPE[x.recipeId] ?? r).kcal * (x.shares.find((y) => y.memberId === sh.memberId)?.factor ?? 0), 0);
          sh.factor = clamp(round025((pp.kcal * shares[m.slot] - sk) / ps.kcal), 0.5, carbHeavy ? 2 : 1.5);
        }
      }
    }
  }

  fitDailyKcal(meals, people, 2.5);
  // porțiile de gătit urmează porțiile ajustate (și garniturile, care au sesiunea lor)
  for (const s of sessions) {
    const own = meals.filter((m) => m.sessionId === s.id).reduce((a, m) => a + sum(m.shares), 0)
      + meals.reduce((a, m) => a + (m.sides ?? []).filter((x) => x.sessionId === s.id).reduce((b, x) => b + sum(x.shares), 0), 0);
    if (own) s.portions = round05(own);
  }
  for (const s of sessions) { s.eat = s.portions; s.portions = wholePortions(s.portions); }
  const { shopping, staples, basics, cost } = shoppingFromSessions(sessions, input.pantry, input.prices, [], input.store, input.storePrices);
  return {
    id: input.startISO, startISO: input.startISO, createdAt: new Date().toISOString(), seed: input.seed, store: input.store,
    household: input.household, fastDays, meals, sessions, shopping, staples, basics, cost, budget: st.budgetRon, warnings, eaten: [],
  };
}

export function generatePlan(input: PlanInput): WeekPlan {
  let bestPlan: WeekPlan | undefined;
  // Bugetul e o limită: încerc întâi planul cel mai pe gustul tău, apoi strâng tot mai tare costul
  // până intră în buget (cu o marjă de cel mult BUDGET_SLACK lei).
  const budget = input.settings.budgetRon;
  // cu alegeri din swipe pornesc de unde a pornit și estimarea din swipe, ca prețul să fie cel pe care l-ai văzut
  const ws = input.wanted?.length ? [3.5, 5, 7, 10, 14, 20, 35] : [0.5, 1, 1.5, 2.5, 3.5, 5, 7, 10, 14, 20, 35];
  for (const w of ws) {
    const p = buildOnce(input, w);
    if (!bestPlan || p.cost < bestPlan.cost) bestPlan = p;
    // primul plan care intră în buget (sau aproape, în marjă) e cel mai pe gustul tău
    if (p.cost <= budget + BUDGET_SLACK * 0.6) { bestPlan = p; break; }
  }
  const plan = bestPlan!;
  if (plan.cost > budget + BUDGET_SLACK) {
    plan.warnings.unshift(`Cu ${budget} lei nu ies toate mesele săptămânii: cel mai ieftin plan costă ${Math.round(plan.cost)} lei. Crește bugetul sau scade numărul de mese pe zi.`);
  } else if (plan.cost > budget) {
    plan.warnings.unshift(`Planul costă ${Math.round(plan.cost)} lei, cu ${Math.round(plan.cost - budget)} lei peste buget (în marja de ${BUDGET_SLACK} lei).`);
  }
  return plan;
}

/** cât poate trece un plan peste buget */
export const BUDGET_SLACK = 50;

/** Recalculează porțiile unei sesiuni după ce i se schimbă rețeta */
function reshare(plan: WeekPlan, input: PlanInput, sessionId: string, r: Recipe): WeekPlan {
  const start = fromISO(plan.startISO);
  const people = presentPeople(input.members, plan.household, start);
  const shares = slotShares(input.settings.slots);
  const session = plan.sessions.find((s) => s.id === sessionId);
  if (!session) return plan;
  const meals = plan.meals.map((m) => {
    if (m.sessionId !== sessionId) return m;
    const k = perServing(r).kcal || 1;
    const sh = people.map((p) => ({ memberId: p.id, factor: round025(Math.min(2, Math.max(0.5, (p.kcal * shares[m.slot]) / k))) }));
    const age = m.day - session.day;
    // ciorba de lângă rămâne doar dacă se potrivește cu felul nou (nu ciorbă lângă ciorbă, nu fasole lângă fasole)
    const sides = m.sides?.filter((x) => !isSoup(RECIPE[x.recipeId]) || (!isSoup(r) && proteinKind(RECIPE[x.recipeId]) !== proteinKind(r)));
    return { ...m, recipeId: r.id, shares: sh, sides: sides?.length ? sides : undefined, frozen: age > r.keepsDays && r.freezable ? true : undefined };
  });
  // copie a porțiilor, apoi ziua se potrivește din nou pe ținta de calorii
  const fitted = meals.map((m) => ({ ...m, shares: m.shares.map((x) => ({ ...x })), sides: m.sides?.map((sd) => ({ ...sd, shares: sd.shares.map((x) => ({ ...x })) })) }));
  fitDailyKcal(fitted, people);
  const sessions = plan.sessions.filter((s) => s.done || fitted.some((m) => m.sessionId === s.id || m.sides?.some((x) => x.sessionId === s.id))).map((s) => {
    const own = fitted.filter((m) => m.sessionId === s.id);
    const asSide = fitted.flatMap((m) => (m.sides ?? []).filter((x) => x.sessionId === s.id));
    if (s.done || (!own.length && !asSide.length)) return s;
    const portions = own.reduce((a, m) => a + m.shares.reduce((x, y) => x + y.factor, 0), 0) + asSide.reduce((a, x) => a + x.shares.reduce((y, z) => y + z.factor, 0), 0);
    return s.id === sessionId
      ? { ...s, recipeId: r.id, eat: round05(portions), portions: wholePortions(portions), freeze: own.some((m) => m.frozen) || undefined }
      : { ...s, eat: round05(portions), portions: wholePortions(portions) };
  });
  return withShopping({ ...plan, meals: fitted, sessions }, input);
}

export function withShopping(plan: WeekPlan, input: Pick<PlanInput, 'pantry' | 'prices' | 'storePrices'>): WeekPlan {
  const checked = plan.shopping.filter((s) => s.checked).map((s) => s.ingId);
  // necesarul sesiunilor negătite minus ce e în cămară; după cumpărături rămâne doar ce mai lipsește
  const { shopping, staples, basics, cost } = shoppingFromSessions(plan.sessions.filter((s) => !s.done), input.pantry, input.prices, checked, plan.store, input.storePrices, plan.addBasics);
  return { ...plan, shopping, staples, basics, cost: plan.shoppingDone ? plan.cost : cost };
}

export function replaceSessionRecipe(plan: WeekPlan, sessionId: string, recipeId: string, input: PlanInput): WeekPlan {
  const r = RECIPE[recipeId];
  return r ? reshare(plan, input, sessionId, r) : plan;
}

/** Schimbă doar o masă: o scoate din sesiunea ei și creează o sesiune nouă în ziua respectivă */
export function replaceSingleMeal(plan: WeekPlan, key: string, recipeId: string, input: PlanInput): WeekPlan {
  const meal = plan.meals.find((m) => mealKey(m.day, m.slot) === key);
  const r = RECIPE[recipeId];
  if (!meal || !r) return plan;
  const old = plan.sessions.find((s) => s.id === meal.sessionId);
  const oldPortions = meal.shares.reduce((a, b) => a + b.factor, 0);
  const newId = `s${Date.now().toString(36)}`;
  let sessions = plan.sessions.map((s) => {
    if (s.id !== old?.id) return s;
    const eat = round05((s.eat ?? s.portions) - oldPortions);
    return { ...s, eat, portions: eat > 0.01 ? wholePortions(eat) : 0 };
  }).filter((s) => s.portions > 0);
  sessions = [...sessions, { id: newId, day: meal.day, recipeId, portions: 0, extra: MAIN_SLOTS.includes(meal.slot) && old?.day !== meal.day }];
  const meals = plan.meals.map((m) => (m === meal ? { ...m, sessionId: newId } : m));
  return reshare({ ...plan, sessions, meals }, input, newId, r);
}

/** Variante pentru o sesiune: aceeași categorie, compatibile cu toate zilele în care se mănâncă */
export function alternativesFor(plan: WeekPlan, mealKeyOrSession: { sessionId?: string; key?: string }, input: PlanInput, limit = 10): Recipe[] {
  const meals = mealKeyOrSession.key
    ? plan.meals.filter((m) => mealKey(m.day, m.slot) === mealKeyOrSession.key)
    : plan.meals.filter((m) => m.sessionId === mealKeyOrSession.sessionId);
  if (!meals.length) return [];
  const current = meals[0].recipeId;
  const slot = meals[0].slot;
  const type: RecipeMeal = MAIN_SLOTS.includes(slot) ? 'principal' : slot === 'mic_dejun' ? 'mic_dejun' : 'gustare';
  const session = plan.sessions.find((s) => s.id === meals[0].sessionId);
  const rs = mergeRestrictions(presentMembers(input.members, plan.household));
  const pan = pantryTotals(input.pantry);
  const ages = meals.map((m) => m.day - (mealKeyOrSession.key ? m.day : session?.day ?? m.day));
  const maxAge = Math.max(0, ...ages);
  return (input.recipes ?? RECIPES)
    .filter((r) => r.id !== current && r.meal.includes(type) && recipeFits(r, rs) && hasEquipment(r, input.settings.equipment)
      && !input.disliked.includes(r.id)
      && meals.every((m) => fastAllows(plan.fastDays[m.day], r))
      && (maxAge <= r.keepsDays || !!r.freezable))
    .map((r) => {
      const real = r.ing.filter(([id]) => !ING[id]?.staple);
      const cov = real.filter(([id]) => (pan[id] ?? 0) > 0).length / (real.length || 1);
      return { r, s: cov * 2 + (input.liked.includes(r.id) ? 1 : 0) + tasteBonus(r, input.taste) - costPerPortion(r, input.prices, plan.store, input.storePrices) / 10 };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.r);
}

export function planDate(plan: WeekPlan, day: number): Date {
  return addDays(fromISO(plan.startISO), day);
}

export function planCoversDate(plan: WeekPlan, iso: string): number {
  const d = Math.round((fromISO(iso).getTime() - fromISO(plan.startISO).getTime()) / 86400000);
  return d >= 0 && d < 7 ? d : -1;
}

export { toISO };

/** Pachetul de rețete pentru „alege prin swipe”: potrivite, variate ca proteină, ordonate după gust */
export function swipeDeck(input: PlanInput, n = 30): Recipe[] {
  const st = input.settings;
  const recipes = input.recipes ?? RECIPES;
  const rs = mergeRestrictions(presentMembers(input.members, input.household));
  const maxPrep = Math.max(st.maxPrepWeekday, st.maxPrepWeekend);
  // în săptămânile cu post, pachetul arată ce se poate mânca în majoritatea zilelor
  const start = fromISO(input.startISO);
  const levels: FastLevel[] = Array.from({ length: 7 }, (_, d) =>
    input.household.applyFasting ? fastLevel(addDays(start, d), st.fasting, st.fishOnDispensation) : 'none');
  const fastCount = levels.filter((l) => l !== 'none').length;
  const fastAt: FastLevel | undefined = fastCount >= 4 ? (levels.filter((l) => l === 'strict').length >= fastCount / 2 ? 'strict' : levels.find((l) => l !== 'none')) : undefined;
  const fitting = recipes.filter((r) => r.meal.includes('principal') && !r.tags?.includes('desert')
    && recipeFits(r, rs) && hasEquipment(r, st.equipment) && !input.disliked.includes(r.id) && r.prep <= maxPrep
    && (!fastAt || fastAllows(fastAt, r)));
  const fam = fitting.filter((r) => familiarity(r) >= 0.55 || st.cuisines?.[r.cuisine ?? 'eu'] === 1);
  const eligible = fam.length >= n ? fam : fitting;
  const rand = mulberry32(input.seed ^ 0x5bd1e995);
  const history = input.history ?? {};
  const sc = (r: Recipe) => {
    let s = rand() * 2.2 + tasteBonus(r, input.taste) + (input.liked.includes(r.id) ? 1.5 : 0);
    const ago = history[r.id] ?? 0;
    if (ago > 0) s -= 4 / ago;
    const sw = input.swipes?.[r.id];
    if (sw) s += sw > 0 ? 0.8 : -2;
    const pref = st.cuisines?.[r.cuisine ?? 'eu'];
    s += pref === 1 ? 1 : pref === -1 ? -2.5 : CUISINE_DEFAULT[r.cuisine ?? 'eu'] ?? 0;
    if (r.img) s += 0.4;
    // în pachet apar mai ales felurile familiare; cele exotice doar dacă îți plac bucătăriile lor
    if (pref !== 1) s += (familiarity(r) - 0.8) * 6;
    return s;
  };
  const buckets: Partial<Record<ProteinKind, Recipe[]>> = {};
  for (const r of eligible) (buckets[proteinKind(r)] ??= []).push(r);
  const scored = new Map(eligible.map((r) => [r.id, sc(r)]));
  for (const b of Object.values(buckets)) b!.sort((a, b2) => scored.get(b2.id)! - scored.get(a.id)!);
  const targets = kindTargets(st.meatStyle ?? 'echilibrat', eligible);
  const used: Partial<Record<ProteinKind, number>> = {};
  const out: Recipe[] = [];
  while (out.length < Math.min(n, eligible.length)) {
    let bestK: ProteinKind | undefined;
    let bestD = -Infinity;
    for (const k of Object.keys(buckets) as ProteinKind[]) {
      if (!buckets[k]!.length) continue;
      const d = (targets[k] ?? 0.02) * (out.length + 1) - (used[k] ?? 0);
      if (d > bestD) { bestD = d; bestK = k; }
    }
    if (!bestK) break;
    out.push(buckets[bestK]!.shift()!);
    used[bestK] = (used[bestK] ?? 0) + 1;
  }
  return out;
}

/** câte feluri principale diferite intră într-o săptămână cu setările astea */
export function mainsNeeded(input: PlanInput): number {
  const p = generatePlan({ ...input, wanted: undefined, skipped: undefined });
  return Math.max(1, new Set(p.meals.filter((m) => MAIN_SLOTS.includes(m.slot)).map((m) => m.recipeId)).size);
}

/**
 * Când alegi mai puține mese pe zi: scot mesele în plus din plan, iar porțiile meselor rămase
 * cresc până ziua ajunge la ținta de calorii. Lista de cumpărături se reface pe ce a rămas.
 */
export function trimPlanSlots(plan: WeekPlan, slots: Slot[], input: PlanInput): WeekPlan {
  const start = fromISO(plan.startISO);
  const people = presentPeople(input.members, plan.household, start);
  const meals = plan.meals.filter((m) => slots.includes(m.slot)).map((m) => ({
    ...m, shares: m.shares.map((x) => ({ ...x })), sides: m.sides?.map((sd) => ({ ...sd, shares: sd.shares.map((x) => ({ ...x })) })),
  }));
  fitDailyKcal(meals, people, 2.5);
  const sessions = plan.sessions.flatMap((s) => {
    const own = meals.filter((m) => m.sessionId === s.id);
    const asSide = meals.flatMap((m) => (m.sides ?? []).filter((x) => x.sessionId === s.id));
    if (!own.length && !asSide.length) return s.done ? [s] : [];
    if (s.done) return [s];
    const portions = own.reduce((a, m) => a + m.shares.reduce((x, y) => x + y.factor, 0), 0) + asSide.reduce((a, x) => a + x.shares.reduce((y, z) => y + z.factor, 0), 0);
    return [{ ...s, eat: round05(portions), portions: wholePortions(portions) }];
  });
  const key = (k: string) => k.split('|').slice(1).join('|');
  const keep = new Set(meals.map((m) => mealKey(m.day, m.slot)));
  return withShopping({
    ...plan, meals, sessions,
    eaten: plan.eaten.filter((k) => keep.has(key(k))),
    skipped: plan.skipped?.filter((k) => keep.has(key(k))),
  }, input);
}

/** felul principal și garniturile unei mese, ca bucăți separate */
export function mealParts(m: PlannedMeal): { recipeId: string; sessionId: string; shares: PortionShare[] }[] {
  return [{ recipeId: m.recipeId, sessionId: m.sessionId, shares: m.shares }, ...(m.sides ?? [])];
}

/** caloriile și macro-urile unei mese pentru o persoană (felul principal × porție + garniturile); scale = cât din ea */
export function mealMacros(m: PlannedMeal, memberId: string, mainFactor?: number) {
  const out = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, sug: 0, salt: 0 };
  const planned = m.shares.find((x) => x.memberId === memberId)?.factor ?? 0;
  const scale = mainFactor != null && planned ? mainFactor / planned : 1;
  mealParts(m).forEach((part, i) => {
    const r = RECIPE[part.recipeId];
    if (!r) return;
    const ps = perServing(r);
    const f = i === 0 && mainFactor != null ? mainFactor : (part.shares.find((x) => x.memberId === memberId)?.factor ?? 0) * scale;
    out.kcal += ps.kcal * f; out.p += ps.p * f; out.c += ps.c * f; out.f += ps.f * f;
    out.fib += ps.fib * f; out.sug += ps.sug * f; out.salt += ps.salt * f;
  });
  return out;
}

/** „cu ciorbă de fasole și pâine” (gol dacă masa n-are garnituri) */
export function sidesLabel(m: PlannedMeal): string {
  const names = (m.sides ?? []).map((x) => RECIPE[x.recipeId]?.name.toLowerCase()).filter(Boolean) as string[];
  if (!names.length) return '';
  return `cu ${names.length > 1 ? `${names.slice(0, -1).join(', ')} și ${names[names.length - 1]}` : names[0]}`;
}

/** mesele care folosesc o gătire (ca fel principal sau ca garnitură, ex. oala de ciorbă) */
export function sessionMeals(plan: WeekPlan, sessionId: string): PlannedMeal[] {
  return plan.meals.filter((m) => m.sessionId === sessionId || m.sides?.some((x) => x.sessionId === sessionId));
}
