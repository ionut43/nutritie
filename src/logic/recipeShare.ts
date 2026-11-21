import { ING } from '../data/ingredients';
import type { Ingredient, Recipe } from './types';

/*
 * Rețetele tale ca link de trimis (WhatsApp, mesaj): toată rețeta e în link, fără server și fără cont.
 * Poza făcută de tine nu încape în link; ingredientele adăugate de tine merg cu rețeta.
 */
export const SHARE_BASE = 'https://ionut43.github.io/nutritie/import';

/** momentele zilei pentru care e rețeta (cum le alegi în editor) */
export type Moment = 'mic_dejun' | 'pranz' | 'cina' | 'gustare' | 'desert';
export const MOMENT_LABEL: Record<Moment, string> = { mic_dejun: 'Mic dejun', pranz: 'Prânz', cina: 'Cină', gustare: 'Gustare', desert: 'Desert' };

interface Payload {
  v: 1;
  n: string; a?: string; m: Moment[]; s: number; p: number; k: number; f?: 1;
  e: string[][]; i: [string, number][]; st: string[];
  /** ingredientele tale (nu există la celălalt) */
  ci?: Ingredient[];
}

const b64url = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export function momentsOf(r: Recipe): Moment[] {
  if (r.moments?.length) return r.moments;
  const m: Moment[] = [];
  if (r.meal.includes('mic_dejun')) m.push('mic_dejun');
  if (r.meal.includes('principal')) m.push('pranz', 'cina');
  if (r.meal.includes('gustare')) m.push(r.tags?.includes('desert') ? 'desert' : 'gustare');
  return m;
}

/** din momentele alese: felul de masă pentru plan și eticheta de desert */
export function mealsFromMoments(ms: Moment[]): { meal: Recipe['meal']; dessert: boolean } {
  const meal: Recipe['meal'] = [];
  if (ms.includes('mic_dejun')) meal.push('mic_dejun');
  if (ms.includes('pranz') || ms.includes('cina')) meal.push('principal');
  if (ms.includes('gustare') || ms.includes('desert')) meal.push('gustare');
  return { meal: meal.length ? meal : ['principal'], dessert: ms.includes('desert') };
}

export function shareLink(r: Recipe, customIngredients: Ingredient[]): string {
  const own = new Set(customIngredients.map((x) => x.id));
  const p: Payload = {
    v: 1, n: r.name, a: r.author, m: momentsOf(r), s: r.servings, p: r.prep, k: r.keepsDays, f: r.freezable ? 1 : undefined,
    e: r.equipment, i: r.ing, st: r.steps,
    ci: customIngredients.filter((x) => own.has(x.id) && r.ing.some(([id]) => id === x.id)),
  };
  if (!p.ci?.length) delete p.ci;
  return `${SHARE_BASE}?r=${b64url(JSON.stringify(p))}`;
}

export function shareText(r: Recipe, link: string): string {
  const who = r.author ? `, făcută de ${r.author}` : '';
  const when = momentsOf(r).map((m) => MOMENT_LABEL[m].toLowerCase()).join(', ');
  return `${r.name}${who} (${when}). Deschide linkul ca s-o pui în aplicația Nutriție:\n${link}`;
}

/** citește o rețetă dintr-un link sau din codul lipit; întoarce null dacă nu e o rețetă validă */
export function parseShared(text: string): { recipe: Recipe; ingredients: Ingredient[] } | null {
  const m = /[?&]r=([A-Za-z0-9_-]+)/.exec(text) ?? /^([A-Za-z0-9_-]{40,})$/.exec(text.trim());
  if (!m) return null;
  let p: Payload;
  try { p = JSON.parse(unb64url(m[1])); } catch { return null; }
  if (p?.v !== 1 || typeof p.n !== 'string' || !Array.isArray(p.i) || !Array.isArray(p.st)) return null;
  const ingredients = (p.ci ?? []).filter((x) => x && typeof x.id === 'string' && !ING[x.id]);
  const known = new Set([...Object.keys(ING), ...ingredients.map((x) => x.id)]);
  const ing = p.i.filter(([id, g]) => known.has(id) && typeof g === 'number' && g > 0);
  if (!ing.length) return null;
  const { meal, dessert } = mealsFromMoments(p.m ?? []);
  const recipe: Recipe = {
    id: `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: p.n.slice(0, 80), author: p.a?.slice(0, 40), moments: p.m, meal, servings: Math.max(1, Math.min(30, p.s || 4)),
    prep: Math.max(1, Math.min(600, p.p || 30)), keepsDays: Math.max(0, Math.min(14, p.k ?? 2)), freezable: !!p.f,
    equipment: Array.isArray(p.e) && p.e.length ? (p.e as Recipe['equipment']) : [['plita']], ing,
    steps: p.st.map((x) => String(x).slice(0, 400)).slice(0, 40), custom: true,
    tags: ['rețeta mea', ...(dessert ? ['desert'] : []), 'primită'],
  };
  return { recipe, ingredients };
}
