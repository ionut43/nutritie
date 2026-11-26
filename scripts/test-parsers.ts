/*
 * Fuzz pe tot ce citește text de la om sau de la cameră: bonuri (OCR cu greșeli), etichete nutriționale,
 * „ce am mâncat” scris liber, căutare de alimente, linkuri de rețete, cantități de pe produse, magazinul de pe bon.
 * Nimic nu are voie să cadă, să înghețe sau să dea numere imposibile (NaN, negative, uriașe).
 *
 *   npx tsx scripts/test-parsers.ts [n]
 */
import { searchFoods } from '../src/logic/foods';
import { parseMealText } from '../src/logic/freeText';
import { parseNutritionLabel } from '../src/logic/labelParser';
import { parseQuantity } from '../src/logic/products';
import { parseReceipt, receiptTotal, splitReceipt } from '../src/logic/receiptParser';
import { parseShared, shareLink } from '../src/logic/recipeShare';
import { detectStore } from '../src/logic/stores';
import { RECIPES } from '../src/data/recipes';

const N = Number(process.argv[2] ?? 3000);
let seed = 99;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const found = new Map<string, { n: number; ex: string }>();
const fail = (k: string, ex: string) => { const f = found.get(k) ?? { n: 0, ex }; f.n++; found.set(k, f); };
const bad = (x: unknown) => typeof x === 'number' && (!Number.isFinite(x) || x < 0 || x > 1e7);

const WORDS = ['LAPTE', 'PAINE', 'OUA', 'PUI', 'PIEPT', 'DETERGENT', 'ARIEL', 'CIOCOLATA', 'ROSII', 'CARTOFI', 'TOTAL', 'SUBTOTAL', 'TVA', 'BUC', 'KG', 'x', 'X', 'RON', 'LEI', 'CARD', 'REST', 'NUMERAR', 'BON FISCAL', 'LIDL', 'KAUFLAND', 'MEGA IMAGE', 'PROFI', 'SGR', 'BERE', 'APA', 'HARTIE', '0,5', '1.5%', '500G', '1L', '2x', '0,850', '29,99', '3,49', '-1,00', 'DISCOUNT', 'Ţ', 'ș', 'Ş', 'ÎÂ', '€', '%', '#', '\t', '', '        ', '9999999,99', '0,00', 'O,OO', 'l,5O'];
const noisy = () => Array.from({ length: Math.floor(rnd() * 30) }, () => Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => pick(WORDS)).join(pick([' ', '  ', '', '.', ','])));

const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const rows = noisy();
  try {
    const t = Date.now();
    const items = parseReceipt(rows);
    if (Date.now() - t > 500) fail('bon: prea lent', rows.join('|').slice(0, 120));
    for (const it of items) {
      if ([it.total, it.qty, it.unitPrice, it.grams].some(bad)) fail('bon: număr imposibil', `${it.raw} → ${JSON.stringify(it)}`.slice(0, 200));
      if (!['aliment', 'altele', 'nealimentar'].includes(it.kind)) fail('bon: fel necunoscut', it.raw);
    }
    const sp = splitReceipt(items, rnd() < 0.5 ? Math.round(rnd() * 500) : undefined);
    if (Object.values(sp).some(bad)) fail('bon: împărțire greșită', JSON.stringify(sp));
    const tot = receiptTotal(rows);
    if (tot !== undefined && bad(tot)) fail('bon: total imposibil', String(tot));
    detectStore(rows.join('\n'));
  } catch (e) { fail('bon: a căzut', `${(e as Error).message} | ${rows.join('|').slice(0, 150)}`); }

  try {
    const lab = parseNutritionLabel(noisy().map((r) => r + pick(['', ' kcal', ' g', ' kJ', ' / 100 g', ' Energie', ' Grăsimi', ' Proteine'])));
    if (Object.values(lab ?? {}).some(bad)) fail('etichetă: număr imposibil', JSON.stringify(lab));
  } catch (e) { fail('etichetă: a căzut', (e as Error).message); }

  const txt = pick(['', ' ', '2 covrigi', 'un covrig si o cafea', '500 g de pui', '1000000 oua', '-3 mere', 'jumatate de pizza', 'ciorba de burta', '🍕🍕', 'a'.repeat(2000), 'lapte, paine, oua, 3 mere, 200g branza', '0.5 l bere', 'nimic', 'x'.repeat(50) + ' 1e9 g', '½ portie sarmale']);
  try {
    const t = Date.now();
    const r = parseMealText(txt);
    if (Date.now() - t > 500) fail('text liber: prea lent', txt.slice(0, 60));
    for (const f of r) if (Object.values(f).some(bad)) fail('text liber: număr imposibil', `${txt.slice(0, 40)} → ${JSON.stringify(f).slice(0, 160)}`);
  } catch (e) { fail('text liber: a căzut', `${txt.slice(0, 40)}: ${(e as Error).message}`); }

  try { searchFoods(pick(['', 'a', 'ț', '%', '.*', '(', '[', 'lapte', 'ciorbă', 'z'.repeat(300)])); } catch (e) { fail('căutare: a căzut', (e as Error).message); }
  try { const q = parseQuantity(pick([undefined, '', '1 kg', '500g', '2 x 250 ml', '0', 'abc', '1,5 l', '6 x 1.5L', '-1 kg', '1e99 g'])); if (q !== undefined && bad(q)) fail('cantitate: imposibilă', String(q)); } catch (e) { fail('cantitate: a căzut', (e as Error).message); }

  const link = pick([
    '', 'https://ionut43.github.io/nutritie/import?r=', 'https://ionut43.github.io/nutritie/import?r=abc', '?r=' + 'A'.repeat(500),
    shareLink(pick(RECIPES), []).slice(0, Math.floor(rnd() * 400)), shareLink(pick(RECIPES), []) + '%%', 'r=eyJ2IjoxfQ', '?r=eyJ2IjoxLCJuIjoxLCJpIjpudWxsLCJzdCI6W119',
  ]);
  try {
    const r = parseShared(link);
    if (r && (!(r.recipe.servings > 0) || r.recipe.ing.some(([, g]) => bad(g)))) fail('link rețetă: rețetă stricată acceptată', link.slice(0, 80));
  } catch (e) { fail('link rețetă: a căzut', `${link.slice(0, 60)}: ${(e as Error).message}`); }
}
// un link bun trebuie să meargă înapoi întreg
for (const r of RECIPES.slice(0, 300)) {
  const back = parseShared(shareLink(r, []));
  if (!back || back.recipe.name !== r.name || back.recipe.ing.length !== r.ing.length) fail('link rețetă: nu se citește înapoi', r.name);
}
// cazuri reale găsite de fuzz (reparate): bon cu coloanele pe rânduri separate, produse cu „CASA”/„FLORA” în nume, grame în text
{
  const it = parseReceipt(['LIDL', 'LAPTE ZUZU 1.5% 1L', '2 x 6,49', '12,98', 'PIEPT PUI', '0,850 KG x 29,99', '25,49', 'BRANZA DE CASA 400G 12,99 B', 'FLORA MARGARINA 4,99 B', 'CASA 3 BON 0045', 'TOTAL 56,45']);
  const names = it.map((x) => `${x.ingId}:${x.total}`).join(' ');
  for (const want of ['lapte:12.98', 'pui_piept:25.49', 'branza_vaci:12.99', 'unt:4.99']) if (!names.includes(want)) fail('bon real: produs pierdut', `${want} în ${names}`);
  if (it.length !== 4) fail('bon real: număr greșit de produse', names);
  const g = parseMealText('500 g de pui')[0];
  if (!g || g.amount !== 500) fail('text liber: gramele ignorate', JSON.stringify(g?.amount));
  const l = parseMealText('0,5 l lapte')[0];
  if (!l || l.amount !== 500) fail('text liber: litrii ignorați', JSON.stringify(l?.amount));
}
console.log(`${N} runde în ${Math.round((Date.now() - t0) / 1000)} s`);
if (!found.size) console.log('✓ nimic stricat');
for (const [k, v] of found) console.log(`✗ ${k} (${v.n}×): ${v.ex}`);
process.exit(found.size ? 1 : 0);
