import { ING } from '../data/ingredients';
import { addDays, daysBetween, toISO } from './dates';
import { perServing } from './nutrition';
import type { PantryItem, Recipe } from './types';

let counter = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export function pantryTotals(pantry: PantryItem[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const p of pantry) t[p.ingId] = (t[p.ingId] ?? 0) + p.g;
  return t;
}

export function addToPantry(pantry: PantryItem[], ingId: string, g: number, from = new Date(), shelfDays?: number): PantryItem[] {
  if (g <= 0) return pantry;
  const ing = ING[ingId];
  const days = shelfDays ?? ing?.shelfDays ?? 7;
  return [...pantry, { id: uid('p'), ingId, g: Math.round(g), expiresISO: toISO(addDays(from, days)) }];
}

/** Scade din cămară, întâi ce expiră mai repede (FIFO) */
export function consumeFromPantry(pantry: PantryItem[], ingId: string, g: number): PantryItem[] {
  let rest = g;
  const sorted = [...pantry].sort((a, b) => a.expiresISO.localeCompare(b.expiresISO));
  const out: PantryItem[] = [];
  for (const p of sorted) {
    if (p.ingId !== ingId || rest <= 0) { out.push(p); continue; }
    const take = Math.min(p.g, rest);
    rest -= take;
    if (p.g - take > 0.5) out.push({ ...p, g: Math.round(p.g - take) });
  }
  return out;
}

export function consumeRecipe(pantry: PantryItem[], r: Recipe, portions: number): PantryItem[] {
  let p = pantry;
  for (const [id, g] of r.ing) {
    if (ING[id]?.staple) continue;
    p = consumeFromPantry(p, id, (g * portions) / r.servings);
  }
  return p;
}

export function daysLeft(item: PantryItem, todayISO: string): number {
  return daysBetween(todayISO, item.expiresISO);
}

export interface PantryMatch { recipe: Recipe; coverage: number; expiringUsed: string[]; missing: string[] }

/** „Ce gătesc din ce am” – rețete ordonate după cât acoperă cămara, cu prioritate pentru ce expiră */
export function recipesFromPantry(pantry: PantryItem[], recipes: Recipe[], todayISO: string): PantryMatch[] {
  const totals = pantryTotals(pantry);
  const expiring = new Set(pantry.filter((p) => daysLeft(p, todayISO) <= 3).map((p) => p.ingId));
  const res: PantryMatch[] = [];
  for (const r of recipes) {
    const real = r.ing.filter(([id]) => !ING[id]?.staple);
    if (!real.length) continue;
    let have = 0, total = 0;
    const missing: string[] = [];
    const expiringUsed: string[] = [];
    for (const [id, g] of real) {
      const need = g / r.servings; // o porție
      const kcalW = Math.max(1, (ING[id]?.kcal ?? 50) * need / 100); // ponderat după aport
      total += kcalW;
      const ratio = Math.min(1, (totals[id] ?? 0) / need);
      have += kcalW * ratio;
      if (ratio < 1) missing.push(id);
      if (expiring.has(id)) expiringUsed.push(id);
    }
    const coverage = have / total;
    if (coverage > 0.15 || expiringUsed.length) res.push({ recipe: r, coverage, expiringUsed, missing });
  }
  return res.sort((a, b) => (b.expiringUsed.length * 0.25 + b.coverage) - (a.expiringUsed.length * 0.25 + a.coverage)
    || perServing(a.recipe).kcal - perServing(b.recipe).kcal);
}
