import type { Recipe } from '../logic/types';
import { CARNE } from './retete/carne';
import { DIMINEATA_DESERT } from './retete/dimineata_desert';
import { IMPORTATE } from './retete/importate';
import { LEGUME } from './retete/legume';
import { PESTE_PASTE } from './retete/peste_paste';
import { PUI } from './retete/pui';
import { SIMPLE } from './retete/simple';

/*
 * Rețetele incluse. Cele cu poză sunt scrise după felul din imagine (poze TheMealDB),
 * iar cele simple (mic dejun, gustări) au imaginea compusă din ingrediente.
 */
const BUILT_IN: Recipe[] = [...CARNE, ...PUI, ...PESTE_PASTE, ...LEGUME, ...DIMINEATA_DESERT, ...SIMPLE, ...IMPORTATE];

/** registrul complet: rețetele incluse + cele adăugate de utilizator */
export const RECIPES: Recipe[] = [...BUILT_IN];
export const RECIPE: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const BUILT_IN_COUNT = BUILT_IN.length;
export const BUILT_IN_IDS = new Set(BUILT_IN.map((r) => r.id));

export function setCustomRecipes(custom: Recipe[]) {
  RECIPES.length = 0;
  RECIPES.push(...BUILT_IN, ...custom);
  for (const k of Object.keys(RECIPE)) delete RECIPE[k];
  for (const r of RECIPES) RECIPE[r.id] = r;
}
