import { addDays, fromISO, toISO } from './dates';
import type { FoodLogEntry, SpendEntry, WeekPlan, WeightEntry } from './types';
import type { StoreId } from './stores';

/** Rezumatul unei săptămâni (luni–duminică) din jurnal, planuri, cheltuieli și greutate */
export interface Recap {
  startISO: string;
  daysLogged: number;
  avgKcal: number;
  avgProtein: number;
  mealsFromPlan: number;
  cooked: number;
  newRecipes: string[];
  spent: number;
  byStore: { store: StoreId; amount: number }[];
  weightDelta: number | null;
  topRecipe?: string;
}

export function weekRecap(
  startISO: string, log: FoodLogEntry[], plans: WeekPlan[], spend: SpendEntry[], weights: WeightEntry[],
  mealRatings: Record<string, 1 | -1>,
): Recap {
  const endISO = toISO(addDays(fromISO(startISO), 6));
  const inWeek = (iso: string) => iso >= startISO && iso <= endISO;
  const entries = log.filter((e) => inWeek(e.dateISO));
  const days = new Set(entries.map((e) => e.dateISO));
  const byDay: Record<string, { k: number; p: number }> = {};
  for (const e of entries) {
    const d = (byDay[e.dateISO] ??= { k: 0, p: 0 });
    d.k += e.kcal; d.p += e.p;
  }
  const n = Math.max(1, days.size);
  const avgKcal = Object.values(byDay).reduce((a, d) => a + d.k, 0) / n;
  const avgProtein = Object.values(byDay).reduce((a, d) => a + d.p, 0) / n;

  // rețete mâncate săptămâna asta care nu apăruseră în planurile de dinainte
  const before = new Set<string>();
  const eatenNow = new Set<string>();
  let mealsFromPlan = 0;
  let cooked = 0;
  for (const p of plans) {
    const pStart = p.startISO;
    for (const m of p.meals) {
      const iso = toISO(addDays(fromISO(pStart), m.day));
      if (iso < startISO) before.add(m.recipeId);
    }
    for (const key of p.eaten) {
      const parts = key.split('|');
      const day = Number(parts.length === 3 ? parts[1] : parts[0]);
      const slot = parts[parts.length - 1];
      const iso = toISO(addDays(fromISO(pStart), day));
      if (!inWeek(iso)) continue;
      mealsFromPlan++;
      const m = p.meals.find((x) => x.day === day && x.slot === slot);
      if (m) eatenNow.add(m.recipeId);
    }
    for (const s of p.sessions) if (s.done && inWeek(toISO(addDays(fromISO(pStart), s.day)))) cooked++;
  }
  const newRecipes = [...eatenNow].filter((id) => !before.has(id));

  const sp = spend.filter((s) => inWeek(s.dateISO));
  const byStoreMap: Partial<Record<StoreId, number>> = {};
  for (const s of sp) byStoreMap[s.store] = (byStoreMap[s.store] ?? 0) + s.amount;
  const byStore = (Object.entries(byStoreMap) as [StoreId, number][]).map(([store, amount]) => ({ store, amount })).sort((a, b) => b.amount - a.amount);

  const ws = weights.filter((w) => inWeek(w.dateISO)).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  const prev = weights.filter((w) => w.dateISO < startISO).sort((a, b) => a.dateISO.localeCompare(b.dateISO)).pop();
  const first = prev ?? ws[0];
  const last = ws[ws.length - 1];
  const weightDelta = first && last && first !== last ? Math.round((last.kg - first.kg) * 10) / 10 : null;

  // masa cu 👍 din săptămâna asta
  let topRecipe: string | undefined;
  for (const p of plans) {
    for (const [k, v] of Object.entries(mealRatings)) {
      if (v !== 1 || !k.startsWith(`${p.id}|`)) continue;
      const [, day, slot] = k.split('|');
      const iso = toISO(addDays(fromISO(p.startISO), Number(day)));
      if (!inWeek(iso)) continue;
      topRecipe = p.meals.find((m) => m.day === Number(day) && m.slot === slot)?.recipeId ?? topRecipe;
    }
  }

  return {
    startISO, daysLogged: days.size, avgKcal, avgProtein, mealsFromPlan, cooked, newRecipes,
    spent: sp.reduce((a, s) => a + s.amount, 0), byStore, weightDelta, topRecipe,
  };
}
