import { ING } from '../data/ingredients';
import { proteinKind } from './nutrition';
import type { Recipe } from './types';

/** Ce a spus utilizatorul despre o rețetă: 👍, 👎 și de câte ori a schimbat-o din plan */
export interface Rating { up: number; down: number; skip: number }
export type Ratings = Record<string, Rating>;

export interface TasteProfile {
  recipe: Record<string, number>;
  ingredient: Record<string, number>;
  category: Record<string, number>;
  /** bucătării (românească, italiană…) */
  cuisine: Record<string, number>;
  /** rețete pe care le-ai notat (le-ai mâncat) */
  seen: Record<string, true>;
  /** câte semnale avem (cu cât mai multe, cu atât profilul contează mai mult) */
  signals: number;
}

const tanh = Math.tanh;

export function recipeSignal(r: Rating): number {
  return r.up - 1.3 * r.down - 0.35 * r.skip;
}

/** Învață din 👍/👎 ce ingrediente și ce tipuri de mâncare îți plac */
export function buildTaste(ratings: Ratings, lookup: Record<string, Recipe>): TasteProfile {
  const recipe: Record<string, number> = {};
  const ingRaw: Record<string, number> = {};
  const ingW: Record<string, number> = {};
  const catRaw: Record<string, number> = {};
  const cuRaw: Record<string, number> = {};
  const seen: Record<string, true> = {};
  let signals = 0;
  for (const [id, rt] of Object.entries(ratings)) {
    const r = lookup[id];
    if (!r) continue;
    const s = recipeSignal(rt);
    signals += rt.up + rt.down + rt.skip;
    if (rt.up + rt.down > 0) seen[id] = true;
    if (r.cuisine) cuRaw[r.cuisine] = (cuRaw[r.cuisine] ?? 0) + s;
    recipe[id] = tanh(s / 2);
    const real = r.ing.filter(([iid]) => !ING[iid]?.staple);
    const total = real.reduce((a, [iid, g]) => a + (ING[iid]?.kcal ?? 50) * g, 0) || 1;
    for (const [iid, g] of real) {
      const share = ((ING[iid]?.kcal ?? 50) * g) / total;
      ingRaw[iid] = (ingRaw[iid] ?? 0) + s * share;
      ingW[iid] = (ingW[iid] ?? 0) + share;
    }
    const cat = proteinKind(r);
    catRaw[cat] = (catRaw[cat] ?? 0) + s;
  }
  const ingredient: Record<string, number> = {};
  for (const k of Object.keys(ingRaw)) ingredient[k] = tanh(ingRaw[k] / Math.max(0.5, ingW[k]) / 2);
  const category: Record<string, number> = {};
  for (const k of Object.keys(catRaw)) category[k] = tanh(catRaw[k] / 4);
  const cuisine: Record<string, number> = {};
  for (const k of Object.keys(cuRaw)) cuisine[k] = tanh(cuRaw[k] / 5);
  return { recipe, ingredient, category, cuisine, seen, signals };
}

/** Bonus de scor pentru planificator (aprox. -3 … +3) */
export function tasteBonus(r: Recipe, t?: TasteProfile): number {
  if (!t || t.signals === 0) return 0;
  const conf = Math.min(1, t.signals / 15);
  const real = r.ing.filter(([iid]) => !ING[iid]?.staple);
  const total = real.reduce((a, [iid, g]) => a + (ING[iid]?.kcal ?? 50) * g, 0) || 1;
  let ing = 0;
  for (const [iid, g] of real) ing += (t.ingredient[iid] ?? 0) * (((ING[iid]?.kcal ?? 50) * g) / total);
  const direct = t.recipe[r.id] ?? 0;
  const cat = t.category[proteinKind(r)] ?? 0;
  const cu = r.cuisine ? t.cuisine?.[r.cuisine] ?? 0 : 0;
  return 2 * direct + conf * (1.6 * ing + 0.8 * cat + 0.8 * cu);
}

/** Rețete respinse clar (👎 de cel puțin 2 ori, niciun 👍) – nu mai apar în plan */
export function rejected(ratings: Ratings): string[] {
  return Object.entries(ratings).filter(([, r]) => r.down >= 2 && r.up === 0).map(([id]) => id);
}

export function topIngredients(t: TasteProfile, n = 5): { likes: string[]; dislikes: string[] } {
  const e = Object.entries(t.ingredient).filter(([id]) => ING[id]);
  return {
    likes: e.filter(([, v]) => v > 0.2).sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => id),
    dislikes: e.filter(([, v]) => v < -0.2).sort((a, b) => a[1] - b[1]).slice(0, n).map(([id]) => id),
  };
}
