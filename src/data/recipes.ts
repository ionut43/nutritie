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
  // garniturile de lângă carne, ca acasă (piure, cartofi, orez, mămăligă)
  { id: 'garnitura_piure', name: 'Piure de cartofi', en: 'Mashed potatoes', meal: [], cuisine: 'ro', servings: 1, prep: 25, equipment: [['plita']], keepsDays: 2,
    ing: [['cartofi', 250], ['lapte', 60], ['unt', 10]], steps: ['Curăță cartofii, taie-i bucăți și fierbe-i în apă cu sare cam 20 de minute, până se înmoaie.', 'Scurge-i, pasează-i cu untul și adaugă laptele cald puțin câte puțin, până e cremos.'], tags: ['garnitura'], familiar: 1 },
  { id: 'garnitura_cartofi_prajiti', name: 'Cartofi prăjiți', en: 'French fries', meal: [], cuisine: 'ro', servings: 1, prep: 25, equipment: [['plita', 'airfryer']], keepsDays: 0,
    ing: [['cartofi', 220], ['ulei', 15]], steps: ['Taie cartofii bețe, spală-i și usucă-i bine pe un prosop.', 'Prăjește-i în ulei încins (sau 18–20 de minute la air fryer, cu o lingură de ulei), apoi sare.'], tags: ['garnitura'], familiar: 1 },
  { id: 'garnitura_cartofi_cuptor', name: 'Cartofi la cuptor cu usturoi și mărar', en: 'Roasted potatoes', meal: [], cuisine: 'ro', servings: 1, prep: 40, equipment: [['cuptor', 'airfryer']], keepsDays: 1,
    ing: [['cartofi', 250], ['ulei', 10], ['usturoi', 3], ['marar', 3]], steps: ['Taie cartofii felii sau sferturi, amestecă-i cu uleiul, sare și boia.', 'Coace-i 35 de minute la 200°C, întorcându-i o dată; la final, usturoi pisat și mărar.'], tags: ['garnitura'], familiar: 1 },
  { id: 'garnitura_cartofi_natur', name: 'Cartofi natur cu mărar', en: 'Boiled potatoes with dill', meal: [], cuisine: 'ro', servings: 1, prep: 25, equipment: [['plita']], keepsDays: 1,
    ing: [['cartofi', 250], ['ulei', 8], ['marar', 3]], steps: ['Fierbe cartofii curățați în apă cu sare, cam 20 de minute.', 'Scurge-i și stropește-i cu ulei; presară mărar tocat.'], tags: ['garnitura'], familiar: 1 },
  { id: 'garnitura_orez', name: 'Orez cu legume', en: 'Rice with vegetables', meal: [], cuisine: 'ro', servings: 1, prep: 25, equipment: [['plita']], keepsDays: 2,
    ing: [['orez', 65], ['mazare', 40], ['morcov', 40], ['ceapa', 20], ['ulei', 8]], steps: ['Călește ceapa și morcovul tăiate mărunt în ulei, 3–4 minute.', 'Adaugă orezul spălat, mazărea și de două ori cât orezul apă fierbinte, sare; fierbe acoperit la foc mic 15 minute.'], tags: ['garnitura'], familiar: 1 },
  { id: 'garnitura_mamaliga', name: 'Mămăligă', en: 'Polenta', meal: [], cuisine: 'ro', servings: 1, prep: 20, equipment: [['plita']], keepsDays: 1,
    ing: [['malai', 80]], steps: ['Pune la fiert 350 ml apă cu sare; când clocotește, adaugă mălaiul în ploaie, amestecând.', 'Fierbe la foc mic 15 minute, amestecând des, până se desprinde de pe vas.'], tags: ['garnitura'], familiar: 1 },
  { id: 'garnitura_legume', name: 'Legume sotate', en: 'Sautéed vegetables', meal: [], cuisine: 'ro', servings: 1, prep: 15, equipment: [['plita']], keepsDays: 1,
    ing: [['broccoli', 150], ['morcov', 80], ['fasole_verde', 100], ['ulei', 8]], steps: ['Fierbe legumele 4–5 minute în apă cu sare, să rămână crocante.', 'Scurge-le și trage-le 2 minute în tigaie cu uleiul și puțin usturoi.'], tags: ['garnitura'], familiar: 1 },
];

/** feluri cu multă muncă de mână: frunze de rulat, aluat de întins, straturi de montat */
const LABORIOUS = /sarmal|musaca|lasagn|colțunaș|coltunas|cozonac|drob|piftie|\btob[ăa]\b|strudel|baclava|ravioli|tortellini|pelmeni|plăcint[ăe] (cu|de) .*(foi|aluat)|burek|varză a la cluj|gogoș|cornulețe|tort /i;

/** garnitura care e deja în rețetă (mămăliga de la tocăniță, orezul de la pui) apare și în nume, ca să știi ce mănânci */
const IN_DISH: [string, RegExp, string][] = [['malai', /mămălig|mamalig|polent/i, 'mămăligă'], ['orez', /orez|pilaf|risotto/i, 'orez'], ['cartofi', /cartof/i, 'cartofi']];
function withGarnish(r: Recipe, name: string): string {
  if (!r.meal.includes('principal') || /^(Ciorb|Sup|Borș|Bors|Zeam)/.test(name)) return name;
  for (const [id, rx, word] of IN_DISH) {
    const g = r.ing.filter(([i]) => i === id).reduce((a, [, x]) => a + x, 0) / (r.servings || 1);
    if (g >= 40 && !rx.test(name)) return `${name}${/ cu /.test(name) ? ' și' : ' cu'} ${word}`;
  }
  return name;
}

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
  const name = withGarnish(r, PLAIN_NAME[r.id] ?? r.name);
  const side = r.meal.length === 1 && r.meal[0] === 'gustare' && SIDE_DISH.test(name) && !r.tags?.includes('side');
  const spring = SPRING_ONLY.test(name) && !r.tags?.includes('primavara');
  // „mai_rar”: linte, năut, bulgur, quinoa… (cine mănâncă de toate le vede rar)
  // „greu”: sarmale, musaca, lasagna, colțunași… (multă muncă, oricât de puține minute scrie sursa)
  const hard = !r.tags?.includes('greu') && LABORIOUS.test(name) && !/sandvi/i.test(name);
  const tags = side || spring || rare || hard ? [...(r.tags ?? []), ...(side ? ['side'] : []), ...(spring ? ['primavara'] : []), ...(rare ? ['mai_rar'] : []), ...(hard ? ['greu'] : [])] : r.tags;
  // timpul real pentru felurile laborioase (sursele dau adesea doar timpul „la aragaz”)
  const prep = hard ? Math.max(r.prep, /sarmal/i.test(name) ? 150 : 90) : r.prep;
  // poză Openverse găsită mai târziu pentru o rețetă clasică (cu autorul și licența)
  const photo = !r.img && EXTRA_CREDIT[r.id];
  if (photo) return { ...r, name, familiar, tags, prep, img: photo.img, credit: photo.credit };
  return familiar === r.familiar && name === r.name && tags === r.tags && prep === r.prep ? r : { ...r, name, familiar, tags, prep };
});

/** registrul complet: rețetele incluse + cele adăugate de utilizator */
export const RECIPES: Recipe[] = [...BUILT_IN];
export const RECIPE: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const BUILT_IN_COUNT = BUILT_IN.length;
export const BUILT_IN_IDS = new Set(BUILT_IN.map((r) => r.id));

export function setCustomRecipes(custom: Recipe[]) {
  RECIPES.length = 0;
  // rețetele șterse de tine care sunt încă în planuri vechi: se găsesc după id, dar nu mai apar nicăieri
  RECIPES.push(...BUILT_IN, ...custom.filter((r) => !r.hidden));
  for (const k of Object.keys(RECIPE)) delete RECIPE[k];
  for (const r of [...BUILT_IN, ...custom]) RECIPE[r.id] = r;
}
