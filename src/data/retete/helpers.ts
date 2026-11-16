import type { Cuisine, Equipment, Recipe, RecipeMeal } from '../../logic/types';
import { M } from '../mealdb_ids';

/*
 * Rețetele sunt scrise după poză: fiecare rețetă cu poză descrie exact felul din imagine.
 * Cantitățile sunt în grame crude pentru numărul de porții indicat. Ingredientele se scriu
 * compact: 'id:grame id:grame …'.
 */

export type E = Equipment;
export const P: E[][] = [['plita']];
export const C: E[][] = [['cuptor']];
export const CA: E[][] = [['cuptor', 'airfryer']];
export const PC: E[][] = [['plita'], ['cuptor']];
export const PCA: E[][] = [['plita'], ['cuptor', 'airfryer']];
export const GR: E[][] = [['grill', 'plita', 'cuptor', 'airfryer']];
export const PF: E[][] = [['plita', 'airfryer']];
export const B: E[][] = [['blender']];
export const PB: E[][] = [['plita'], ['blender']];
export const N: E[][] = [];
export const PM: E[][] = [['plita', 'microunde']];
export const T: E[][] = [['toaster', 'cuptor', 'plita']];

export const MD: RecipeMeal[] = ['mic_dejun'];
export const G: RecipeMeal[] = ['gustare'];
export const PR: RecipeMeal[] = ['principal'];
export const MP: RecipeMeal[] = ['mic_dejun', 'principal'];
export const MG: RecipeMeal[] = ['mic_dejun', 'gustare'];
export const PG: RecipeMeal[] = ['principal', 'gustare'];

export function parseIng(s: string): [string, number][] {
  return s.trim().split(/\s+/).map((t) => {
    const [id, g] = t.split(':');
    return [id, Number(g)] as [string, number];
  });
}

/** rețetă cu poză: ph = indexul pozei în M */
export function R(
  ph: number | null, id: string, name: string, en: string, meal: RecipeMeal[], cuisine: Cuisine,
  servings: number, prep: number, equipment: E[][], keepsDays: number, ing: string, steps: string[],
  x: { fz?: boolean; t?: string[] } = {},
): Recipe {
  return {
    id, name, en, meal, cuisine, servings, prep, equipment, keepsDays, ing: parseIng(ing), steps,
    freezable: x.fz, tags: x.t, img: ph == null ? undefined : M[ph],
  };
}
