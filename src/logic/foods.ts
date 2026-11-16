import { INGREDIENTS, ING } from '../data/ingredients';
import { RECIPES, RECIPE } from '../data/recipes';
import { GENERIC_FOODS } from '../data/generic_foods';
import { perServing, type Macros } from './nutrition';
import type { FoodLogEntry, Recipe, Slot, WeekPlan } from './types';

/*
 * Tot ce poți adăuga în jurnal: rețete (pe porție), alimente uzuale (pe porție) și ingrediente sau produse
 * scanate (pe 100 g). `ref` identifică alimentul ca să apară la „recente” și „favorite”.
 */
export interface FoodItem {
  ref: string;
  name: string;
  kind: 'reteta' | 'aliment' | 'ingredient';
  /** valorile pentru 1 porție (rețete, alimente uzuale) sau pentru 100 g (ingrediente) */
  per: 'portie' | '100g';
  m: Macros;
  /** cantitatea propusă: porții sau grame */
  amount: number;
  /** grame pe bucată, dacă se numără la bucată */
  piece?: number;
  /** grame într-o porție (alimente uzuale) */
  portionG?: number;
  recipeId?: string;
  ingId?: string;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function foodFromRef(ref: string): FoodItem | undefined {
  const [k, id] = [ref.slice(0, 1), ref.slice(2)];
  if (k === 'r') {
    const r = RECIPE[id];
    if (!r) return undefined;
    return { ref, name: r.name, kind: 'reteta', per: 'portie', m: perServing(r), amount: 1, recipeId: id };
  }
  if (k === 'g') {
    const g = GENERIC_FOODS.find((x) => x.id === id);
    if (!g) return undefined;
    const f = g.portion / 100;
    return {
      ref, name: g.name, kind: 'aliment', per: 'portie', amount: 1, portionG: g.portion,
      m: { kcal: g.kcal * f, p: g.p * f, c: g.c * f, f: g.f * f, fib: g.fib * f, sug: g.sug * f, salt: g.salt * f },
    };
  }
  if (k === 'i') {
    const i = ING[id];
    if (!i) return undefined;
    const amount = i.gPerPiece ?? (i.unit === 'ml' ? 200 : 100);
    return {
      ref, name: i.name, kind: 'ingredient', per: '100g', amount, piece: i.gPerPiece, ingId: id,
      m: { kcal: i.kcal, p: i.p, c: i.c, f: i.f, fib: i.fib, sug: i.sug, salt: i.salt },
    };
  }
  return undefined;
}

/** valorile pentru cantitatea aleasă */
export function macrosFor(item: FoodItem, amount: number): Macros {
  const k = item.per === 'portie' ? amount : amount / 100;
  const m = item.m;
  return { kcal: m.kcal * k, p: m.p * k, c: m.c * k, f: m.f * k, fib: m.fib * k, sug: m.sug * k, salt: m.salt * k };
}

export function searchFoods(q: string, limit = 40): FoodItem[] {
  const n = norm(q.trim());
  if (n.length < 2) return [];
  const words = n.split(/\s+/);
  const hit = (s: string) => { const x = norm(s); return words.every((w) => x.includes(w)); };
  const score = (s: string) => (norm(s).startsWith(n) ? 0 : 1);
  const out: { f: FoodItem; s: number }[] = [];
  for (const g of GENERIC_FOODS) if (hit(g.name)) out.push({ f: foodFromRef(`g:${g.id}`)!, s: score(g.name) });
  for (const i of INGREDIENTS) if (!i.staple && hit(i.name)) out.push({ f: foodFromRef(`i:${i.id}`)!, s: score(i.name) + (i.custom ? -0.5 : 0.2) });
  for (const r of RECIPES) if (hit(r.name)) out.push({ f: foodFromRef(`r:${r.id}`)!, s: score(r.name) + 0.4 });
  return out.filter((x) => x.f).sort((a, b) => a.s - b.s || a.f.name.length - b.f.name.length).slice(0, limit).map((x) => x.f);
}

/** ce ai adăugat recent (cel mai nou primul), fără dubluri */
export function recentFoods(log: FoodLogEntry[], limit = 12): { item: FoodItem; amount: number }[] {
  const seen = new Set<string>();
  const out: { item: FoodItem; amount: number }[] = [];
  for (const e of [...log].reverse()) {
    if (!e.ref || seen.has(e.ref)) continue;
    const item = foodFromRef(e.ref);
    if (!item) continue;
    seen.add(e.ref);
    out.push({ item, amount: e.g ?? item.amount });
    if (out.length >= limit) break;
  }
  return out;
}

/** masa potrivită după oră */
export function slotForHour(h: number, slots: Slot[]): Slot {
  const want: Slot = h < 11 ? 'mic_dejun' : h < 12 ? 'gustare1' : h < 16 ? 'pranz' : h < 18 ? 'gustare2' : 'cina';
  if (slots.includes(want)) return want;
  if (want === 'gustare1') return slots.includes('pranz') ? 'pranz' : slots[0];
  if (want === 'gustare2') return slots.includes('cina') ? 'cina' : slots[slots.length - 1];
  return slots.includes(want) ? want : slots[0];
}

/** textul cantității: „1½ porții”, „150 g”, „2 buc. (100 g)” */
export function amountLabel(item: FoodItem, amount: number): string {
  if (item.per === 'portie') {
    const q = Math.round(amount * 4) / 4;
    const s = String(q).replace('.', ',');
    return `${s} ${q === 1 ? 'porție' : 'porții'}`;
  }
  if (item.piece) {
    const pcs = Math.round((amount / item.piece) * 10) / 10;
    return `${String(pcs).replace('.', ',')} buc. (${Math.round(amount)} g)`;
  }
  return `${Math.round(amount)} ${ING[item.ingId ?? '']?.unit === 'ml' ? 'ml' : 'g'}`;
}

/** rețeta unei intrări din jurnal (din plan sau notată de tine), pentru poza de pe arc */
export function recipeOfEntry(f: FoodLogEntry, plans: Record<string, WeekPlan>): Recipe | undefined {
  if (f.ref?.startsWith('r:')) return RECIPE[f.ref.slice(2)];
  if (f.planId && f.mealKey) {
    const [, d, slot] = f.mealKey.split('|');
    const m = plans[f.planId]?.meals.find((x) => x.day === Number(d) && x.slot === slot);
    return m ? RECIPE[m.recipeId] : undefined;
  }
  return undefined;
}
export const slotOfEntry = (f: FoodLogEntry) => (f.slot ?? f.mealKey?.split('|')[2]) as Slot | undefined;
