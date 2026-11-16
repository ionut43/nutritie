import { macrosFor, searchFoods, type FoodItem } from './foods';

/*
 * „o shaorma mare și un ayran” → [shaorma ×1,4, ayran ×1].
 * Desparte textul la „și”, virgulă, „+”, „plus”, citește cantitatea de la început
 * (un, o, două, 2, jumătate) și mărimea (mare, mică, dublă), apoi caută fiecare bucată.
 * Totul e estimat, de aceea se arată cu „≈”.
 */
export interface ParsedFood { text: string; item: FoodItem; amount: number; kcal: number }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const QTY: Record<string, number> = {
  un: 1, o: 1, unu: 1, una: 1, doi: 2, doua: 2, trei: 3, patru: 4, cinci: 5, sase: 6,
  jumatate: 0.5, juma: 0.5, sfert: 0.25,
};
const SIZE: Record<string, number> = { mare: 1.4, mari: 1.4, dubla: 2, dublu: 2, mic: 0.7, mica: 0.7, mici_: 0.7, micuta: 0.6, mediu: 1, medie: 1 };
const FILLER = new Set(['de', 'din', 'cu', 'la', 'si', 'am', 'mancat', 'baut', 'niste', 'cateva', 'cam', 'portie', 'portii', 'bucata', 'bucati', 'buc', 'felie', 'felii', 'pahar']);

/** câte bucăți are o porție, la alimentele care se numără (3 mici = o porție de 200 g, nu trei) */
const PIECES: Record<string, number> = { 'g:g_mici': 4, 'g:g_nuggets': 6, 'g:g_aripioare': 5, 'g:g_clatite': 2, 'g:g_paine': 2, 'g:g_sushi': 8, 'g:g_mandarine': 2, 'g:g_kiwi': 2, 'g:g_prune': 4 };

/** plural și articulat → forma de bază: covrigi → covrig, sarmalele → sarmal(e) */
const stems = (w: string) => [w, w.replace(/(urile|ului|ele|ile|uri|lor|ii|ul|le|i|e|a)$/, '')].filter((x, i, a) => x.length >= 3 && a.indexOf(x) === i);

function bestMatch(words: string[]): FoodItem | undefined {
  // încerc tot textul, apoi tot mai puține cuvinte de la sfârșit, apoi fiecare cuvânt
  for (let n = words.length; n >= 1; n--) {
    const hit = searchFoods(words.slice(0, n).join(' '), 1)[0];
    if (hit) return hit;
  }
  for (const w of words) {
    for (const x of stems(w)) {
      const hit = searchFoods(x, 1)[0];
      if (hit) return hit;
    }
  }
  return undefined;
}

export function parseMealText(text: string): ParsedFood[] {
  const parts = norm(text).split(/\s*(?:,|\+|;|\bsi\b|\bplus\b|\bapoi\b)\s*/).filter((p) => p.length > 1);
  const out: ParsedFood[] = [];
  for (const part of parts) {
    let q = 1;
    let size = 1;
    const words: string[] = [];
    for (const w of part.split(/\s+/)) {
      const num = Number(w.replace(',', '.'));
      if (!Number.isNaN(num) && num > 0 && num < 50 && !words.length) { q = num; continue; }
      if (QTY[w] !== undefined && !words.length) { q = QTY[w]; continue; }
      // „mici” e și mâncare (mititei): îl citesc ca mărime doar după alt cuvânt
      if (SIZE[w] !== undefined && words.length) { size = SIZE[w]; continue; }
      if (FILLER.has(w)) continue;
      words.push(w);
    }
    if (!words.length) continue;
    const item = bestMatch(words);
    if (!item) continue;
    const per = PIECES[item.ref];
    const amount = item.per === 'portie' ? (per ? q / per : q) * size : (item.piece ? item.piece * q : item.amount * q) * size;
    out.push({ text: part, item, amount, kcal: Math.round(macrosFor(item, amount).kcal) });
  }
  return out;
}
