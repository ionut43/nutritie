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
/*
 * Garniturile de la o masă mare: planul le pune lângă felul principal (nu apar singure în listă sau în plan).
 */
export const SIDES: Recipe[] = [
  { id: 'garnitura_paine', name: 'Pâine', en: 'Bread', meal: [], cuisine: 'ro', servings: 1, prep: 0, equipment: [], keepsDays: 4,
    ing: [['paine', 100]], steps: ['Două felii groase de pâine, cam 100 g.'], tags: ['garnitura'], familiar: 1 },
  { id: 'garnitura_salata', name: 'Salată de varză cu morcov', en: 'Cabbage and carrot salad', meal: [], cuisine: 'ro', servings: 1, prep: 5, equipment: [], keepsDays: 1,
    ing: [['varza', 150], ['morcov', 60], ['ulei', 8], ['otet', 5]], steps: ['Taie varza fideluță și freacă-o cu puțină sare.', 'Adaugă morcovul ras, uleiul și oțetul.'], tags: ['garnitura'], familiar: 1 },
];

const BUILT_IN: Recipe[] = [...CARNE, ...PUI, ...PESTE_PASTE, ...LEGUME, ...DIMINEATA_DESERT, ...SIMPLE, ...IMPORTATE, ...SIDES];

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
