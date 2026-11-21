import type { Recipe } from '../logic/types';
import { CARNE } from './retete/carne';
import { DIMINEATA_DESERT } from './retete/dimineata_desert';
import { IMPORTATE } from './retete/importate';
import { LEGUME } from './retete/legume';
import { PESTE_PASTE } from './retete/peste_paste';
import { PUI } from './retete/pui';
import { ROMANESTI } from './retete/romanesti';
import { CUISINE_DEFAULT, LESS_COMMON_INGREDIENTS, NOT_FAMILIAR, PLAIN_NAME, SIDE_DISH, SPRING_ONLY } from './curation';
import { SIMPLE } from './retete/simple';
import { EXTRA_CREDIT } from './photos_extra_credit';

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

const RAW: Recipe[] = [...CARNE, ...PUI, ...PESTE_PASTE, ...LEGUME, ...DIMINEATA_DESERT, ...SIMPLE, ...IMPORTATE, ...ROMANESTI, ...SIDES];
// numele pe înțeles și cât de cunoscut e felul (vezi curation.ts)
const BUILT_IN: Recipe[] = RAW.map((r) => {
  let familiar = r.familiar;
  let rare = false;
  const now = r.familiar ?? CUISINE_DEFAULT[r.cuisine ?? 'eu'] ?? 0.7;
  if (NOT_FAMILIAR.has(r.id)) familiar = Math.min(now, 0.4);
  else {
    const main = r.ing.filter(([id]) => LESS_COMMON_INGREDIENTS.has(id)).reduce((a, [, g]) => a + g, 0);
    const total = r.ing.reduce((a, [, g]) => a + g, 0) || 1;
    if (main / total > 0.12) { rare = true; if (r.meal.includes('principal')) familiar = Math.min(now, 0.6); }
  }
  const name = PLAIN_NAME[r.id] ?? r.name;
  const side = r.meal.length === 1 && r.meal[0] === 'gustare' && SIDE_DISH.test(name) && !r.tags?.includes('side');
  const spring = SPRING_ONLY.test(name) && !r.tags?.includes('primavara');
  // „mai_rar”: linte, năut, bulgur, quinoa… (cine mănâncă de toate le vede rar)
  const tags = side || spring || rare ? [...(r.tags ?? []), ...(side ? ['side'] : []), ...(spring ? ['primavara'] : []), ...(rare ? ['mai_rar'] : [])] : r.tags;
  // poză Openverse găsită mai târziu pentru o rețetă clasică (cu autorul și licența)
  const photo = !r.img && EXTRA_CREDIT[r.id];
  if (photo) return { ...r, name, familiar, tags, img: photo.img, credit: photo.credit };
  return familiar === r.familiar && name === r.name && tags === r.tags ? r : { ...r, name, familiar, tags };
});

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
