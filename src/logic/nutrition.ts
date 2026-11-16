import { ING } from '../data/ingredients';
import type { Allergen, AvoidKind, Diet, FastLevel, Ingredient, Member, Recipe, Equipment } from './types';

export interface Macros { kcal: number; p: number; c: number; f: number; fib: number; sug: number; salt: number }

export const ZERO: Macros = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, sug: 0, salt: 0 };

export function addMacros(a: Macros, b: Macros, k = 1): Macros {
  return {
    kcal: a.kcal + b.kcal * k, p: a.p + b.p * k, c: a.c + b.c * k, f: a.f + b.f * k,
    fib: a.fib + b.fib * k, sug: a.sug + b.sug * k, salt: a.salt + b.salt * k,
  };
}

const cache = new Map<string, Macros>();
export const clearNutritionCache = () => cache.clear();

/** Valori pe o porție de bază */
export function perServing(r: Recipe): Macros {
  const hit = cache.get(r.id);
  if (hit) return hit;
  let m = { ...ZERO };
  for (const [id, g] of r.ing) {
    const i = ING[id];
    if (!i) continue;
    m = addMacros(m, i, g / 100);
  }
  const k = 1 / r.servings;
  const res: Macros = { kcal: m.kcal * k, p: m.p * k, c: m.c * k, f: m.f * k, fib: m.fib * k, sug: m.sug * k, salt: m.salt * k };
  cache.set(r.id, res);
  return res;
}

export function recipeAllergens(r: Recipe): Allergen[] {
  const s = new Set<Allergen>();
  for (const [id] of r.ing) ING[id]?.allergens.forEach((a) => s.add(a));
  return [...s];
}

export function recipeDiet(r: Recipe): Diet {
  const kinds = new Set(r.ing.map(([id]) => ING[id]?.animal).filter(Boolean));
  if (kinds.has('carne')) return 'omnivor';
  if (kinds.has('peste')) return 'pescetarian';
  if (kinds.has('lactate') || kinds.has('oua') || kinds.has('miere')) return 'vegetarian';
  return 'vegan';
}

const DIET_RANK: Record<Diet, number> = { omnivor: 0, pescetarian: 1, vegetarian: 2, vegan: 3 };

export function dietAllows(person: Diet, recipe: Diet): boolean {
  if (person === 'pescetarian') return recipe !== 'omnivor';
  if (person === 'vegetarian') return recipe === 'vegetarian' || recipe === 'vegan';
  if (person === 'vegan') return recipe === 'vegan';
  return true;
}

export function strictestDiet(diets: Diet[]): Diet {
  return diets.reduce<Diet>((a, b) => (DIET_RANK[b] > DIET_RANK[a] ? b : a), 'omnivor');
}

export function fastAllows(level: FastLevel, r: Recipe): boolean {
  if (level === 'none') return true;
  const kinds = new Set(r.ing.map(([id]) => ING[id]?.animal).filter(Boolean));
  if (level === 'no_meat') return !kinds.has('carne');
  if (level === 'fish_ok') return !kinds.has('carne') && !kinds.has('lactate') && !kinds.has('oua');
  // strict: mierea e permisă în post
  return !kinds.has('carne') && !kinds.has('lactate') && !kinds.has('oua') && !kinds.has('peste');
}

export function hasEquipment(r: Recipe, eq: Equipment[]): boolean {
  return r.equipment.every((group) => group.some((e) => eq.includes(e)));
}

export interface Restrictions { diet: Diet; allergies: Allergen[]; dislikes: string[]; avoid: AvoidKind[] }

const LEGUMINOASE = new Set(['fasole_conserva', 'fasole_rosie', 'fasole_neagra', 'naut', 'linte', 'linte_verde', 'mazare_uscata', 'tofu', 'lapte_soia']);
const PICANT = new Set(['ardei_iute', 'chili', 'boia_iute', 'pasta_curry', 'sos_chili']);

/** ingredientul intră într-una din categoriile pe care nu le mănânci? */
export function avoidedBy(i: Ingredient | undefined, avoid: AvoidKind[]): boolean {
  if (!i || !avoid.length) return false;
  if (i.meat && avoid.includes(i.meat)) return true;
  if (i.animal === 'oua' && avoid.includes('oua')) return true;
  if (i.animal === 'lactate' && avoid.includes('lactate')) return true;
  if (i.id === 'ciuperci' && avoid.includes('ciuperci')) return true;
  if (LEGUMINOASE.has(i.id) && avoid.includes('leguminoase')) return true;
  if (PICANT.has(i.id) && avoid.includes('picant')) return true;
  return false;
}

export function mergeRestrictions(members: Member[]): Restrictions {
  const allergies = new Set<Allergen>();
  const dislikes = new Set<string>();
  const avoid = new Set<AvoidKind>();
  members.forEach((m) => {
    m.allergies.forEach((a) => allergies.add(a));
    m.dislikes.forEach((d) => dislikes.add(d));
    (m.avoid ?? []).forEach((a) => avoid.add(a));
  });
  return { diet: strictestDiet(members.map((m) => m.diet)), allergies: [...allergies], dislikes: [...dislikes], avoid: [...avoid] };
}

export function recipeFits(r: Recipe, rs: Restrictions): boolean {
  if (!dietAllows(rs.diet, recipeDiet(r))) return false;
  const al = recipeAllergens(r);
  if (al.some((a) => rs.allergies.includes(a))) return false;
  if (r.ing.some(([id]) => rs.dislikes.includes(id))) return false;
  if (rs.avoid?.length && r.ing.some(([id]) => avoidedBy(ING[id], rs.avoid))) return false;
  return true;
}

export const AVOID_LABEL: Record<AvoidKind, string> = {
  peste: 'Pește', fructe_mare: 'Fructe de mare', porc: 'Porc', vita: 'Vită', miel: 'Miel', pui: 'Pui', curcan: 'Curcan',
  organe: 'Organe (ficat)', oua: 'Ouă', lactate: 'Lactate', ciuperci: 'Ciuperci', leguminoase: 'Fasole, năut, linte', picant: 'Mâncare picantă',
};

/** felul principal de proteină al rețetei (pentru varietate) */
export type ProteinKind = 'pui' | 'curcan' | 'porc' | 'vita' | 'miel' | 'organe' | 'peste' | 'fructe_mare' | 'leguminoase' | 'oua_lactate' | 'legume';

export function proteinKind(r: Recipe): ProteinKind {
  const byMeat: Record<string, number> = {};
  let legum = 0, ol = 0;
  for (const [id, g] of r.ing) {
    const i = ING[id];
    if (!i) continue;
    if (i.meat) byMeat[i.meat] = (byMeat[i.meat] ?? 0) + g;
    else if (LEGUMINOASE.has(id)) legum += g;
    else if (i.animal === 'oua' || i.animal === 'lactate') ol += g * (i.p / 15);
  }
  const top = Object.entries(byMeat).sort((a, b) => b[1] - a[1])[0];
  if (top) return top[0] as ProteinKind;
  if (legum > 0) return 'leguminoase';
  if (ol > 30) return 'oua_lactate';
  return 'legume';
}

export const ALLERGEN_LABEL: Record<Allergen, string> = {
  gluten: 'Gluten', crustacee: 'Crustacee', oua: 'Ouă', peste: 'Pește', arahide: 'Arahide', soia: 'Soia',
  lapte: 'Lapte / lactoză', nuci: 'Nuci și fructe cu coajă', telina: 'Țelină', mustar: 'Muștar', susan: 'Susan',
  sulfiti: 'Sulfiți', lupin: 'Lupin', moluste: 'Moluște',
};

export const DIET_LABEL: Record<Diet, string> = {
  omnivor: 'Mănânc de toate', pescetarian: 'Pescetarian (fără carne, cu pește)',
  vegetarian: 'Vegetarian (cu lactate și ouă)', vegan: 'Vegan',
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  plita: 'Aragaz / plită', cuptor: 'Cuptor', microunde: 'Cuptor cu microunde', airfryer: 'Air fryer',
  blender: 'Blender', mixer: 'Mixer', robot: 'Robot de bucătărie', multicooker: 'Multicooker',
  grill: 'Grill electric / tigaie grill', toaster: 'Toaster',
};
