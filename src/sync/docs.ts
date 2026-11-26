import type { Ingredient, Member, PantryItem, Recipe, Settings, WeekPlan } from '../logic/types';

/*
 * Ce împarte o familie pe mai multe telefoane, ca documente: planurile (cu lista de cumpărături),
 * cămara, membrii (fiecare își publică profilul), setările casei, rețetele și ingredientele adăugate de voi.
 * Jurnalul de mâncare, greutatea și ce îți place rămân doar pe telefonul tău.
 */

export type DocKind = 'plan' | 'pantry' | 'member' | 'settings' | 'recipe' | 'ingredient';
export interface Doc { kind: DocKind; key: string; data: unknown; deleted?: boolean; updated_at?: string }

/** setările casei (aceleași pe toate telefoanele); tema și funcțiile pornite rămân ale fiecăruia */
export const SHARED_SETTINGS = [
  'equipment', 'slots', 'cookingDays', 'maxPrepWeekday', 'maxPrepWeekend', 'recipesPerSession', 'budgetRon',
  'fasting', 'fishOnDispensation', 'variety', 'effort', 'soupDays', 'slotPrefs', 'mealStyle', 'meatStyle', 'cuisines',
  'dessertsPerWeek', 'stores', 'mainStore', 'shopDay', 'priceArea',
] as const satisfies readonly (keyof Settings)[];

export interface SyncSlice {
  members: Member[];
  plans: Record<string, WeekPlan>;
  pantry: PantryItem[];
  settings: Settings;
  customRecipes: Recipe[];
  customIngredients: Ingredient[];
}

export const docId = (kind: DocKind, key: string) => `${kind}:${key}`;

/** amprentă scurtă a unui document (ca să știu ce s-a schimbat de la ultima sincronizare) */
export function hash(s: string): string {
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = (h1 * 33) ^ c;
    h2 = (h2 * 33) ^ c;
  }
  return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16) + s.length.toString(16);
}

const memberDoc = (m: Member) => {
  const { isMain: _main, ...rest } = m;
  return rest;
};

/** toate documentele familiei din starea telefonului: id → conținut (JSON) */
export function docsFromState(s: SyncSlice): Map<string, { kind: DocKind; key: string; json: string }> {
  const out = new Map<string, { kind: DocKind; key: string; json: string }>();
  const put = (kind: DocKind, key: string, data: unknown) => out.set(docId(kind, key), { kind, key, json: JSON.stringify(data) });
  for (const p of Object.values(s.plans)) put('plan', p.id, p);
  put('pantry', 'all', s.pantry);
  for (const m of s.members) put('member', m.id, memberDoc(m));
  put('settings', 'casa', Object.fromEntries(SHARED_SETTINGS.filter((k) => s.settings[k] !== undefined).map((k) => [k, s.settings[k]])));
  for (const r of s.customRecipes) put('recipe', r.id, r);
  for (const i of s.customIngredients) put('ingredient', i.id, i);
  return out;
}

/**
 * Același plan schimbat pe două telefoane deodată: păstrez ce s-a bifat pe amândouă
 * (mese mâncate, gătiri făcute, produse cumpărate). Un plan refăcut („Alt plan”) îl înlocuiește pe cel vechi.
 */
export function mergePlan(local: WeekPlan, remote: WeekPlan): WeekPlan {
  if (local.createdAt !== remote.createdAt) return local.createdAt > remote.createdAt ? local : remote;
  const union = (a?: string[], b?: string[]) => (a || b ? [...new Set([...(b ?? []), ...(a ?? [])])] : undefined);
  const doneL = new Set(local.sessions.filter((x) => x.done).map((x) => x.id));
  const checkedL = new Map(local.shopping.map((x) => [x.ingId, !!x.checked]));
  const atL = local.shopAt ?? {}, atR = remote.shopAt ?? {};
  // fiecare produs: bifa sau debifarea cea mai nouă; fără oră (versiuni vechi), bifat pe oricare = bifat
  const checked = (ingId: string, remoteChecked: boolean) => {
    const l = checkedL.get(ingId);
    if (l === undefined) return remoteChecked;
    if (atL[ingId] !== undefined || atR[ingId] !== undefined) return (atL[ingId] ?? 0) > (atR[ingId] ?? 0) ? l : remoteChecked;
    return l || remoteChecked;
  };
  const shopAt = { ...atR };
  for (const [k, v] of Object.entries(atL)) if (v > (shopAt[k] ?? 0)) shopAt[k] = v;
  return {
    ...remote,
    eaten: union(local.eaten, remote.eaten) ?? [],
    skipped: union(local.skipped, remote.skipped),
    locked: union(local.locked, remote.locked),
    shoppingDone: remote.shoppingDone || local.shoppingDone || undefined,
    sessions: remote.sessions.map((x) => (doneL.has(x.id) && !x.done ? { ...x, done: true } : x)),
    shopping: remote.shopping.map((x) => { const c = checked(x.ingId, !!x.checked); return c === !!x.checked ? x : { ...x, checked: c || undefined }; }),
    shopAt: Object.keys(shopAt).length ? shopAt : undefined,
  };
}

/**
 * Documentele venite de pe server, aplicate peste starea telefonului.
 * `pending`: documentele schimbate aici și netrimise încă: ale tale câștigă (pleacă imediat după),
 * iar la planuri se combină bifele de pe ambele telefoane.
 * `selfId`: membrul care ești tu pe telefonul ăsta (profilul tău îl ții tu).
 */
export function applyDocs(s: SyncSlice, docs: Doc[], selfId: string, pending: Set<string>): { patch: Partial<SyncSlice>; added: string[]; removed: string[] } {
  const patch: Partial<SyncSlice> = {};
  const added: string[] = [];
  const removed: string[] = [];
  let plans = s.plans, members = s.members, recipes = s.customRecipes, ings = s.customIngredients;
  for (const d of docs) {
    const id = docId(d.kind, d.key);
    const mine = pending.has(id);
    if (d.kind === 'plan') {
      const local = plans[d.key];
      if (d.deleted || !d.data) { if (local && !mine) { plans = { ...plans }; delete plans[d.key]; } continue; }
      const remote = d.data as WeekPlan;
      plans = { ...plans, [d.key]: local && mine ? mergePlan(local, remote) : remote };
    } else if (d.kind === 'pantry') {
      if (!mine && !d.deleted && Array.isArray(d.data)) patch.pantry = d.data as PantryItem[];
    } else if (d.kind === 'settings') {
      if (!mine && !d.deleted && d.data && typeof d.data === 'object') patch.settings = { ...s.settings, ...(d.data as Partial<Settings>) };
    } else if (d.kind === 'member') {
      if (d.key === selfId) continue; // profilul tău e cel de pe telefonul tău
      const has = members.some((m) => m.id === d.key);
      if (d.deleted || !d.data) {
        if (has) { members = members.filter((m) => m.id !== d.key); removed.push(d.key); }
        continue;
      }
      const m = { ...(d.data as Member), id: d.key, isMain: false };
      if (has) { if (!mine) members = members.map((x) => (x.id === d.key ? m : x)); }
      else { members = [...members, m]; added.push(d.key); }
    } else if (d.kind === 'recipe') {
      if (d.deleted || !d.data) { if (!mine) recipes = recipes.filter((r) => r.id !== d.key); continue; }
      if (mine && recipes.some((r) => r.id === d.key)) continue;
      recipes = [...recipes.filter((r) => r.id !== d.key), { ...(d.data as Recipe), id: d.key }];
    } else if (d.kind === 'ingredient') {
      if (d.deleted || !d.data) { if (!mine) ings = ings.filter((r) => r.id !== d.key); continue; }
      if (mine && ings.some((r) => r.id === d.key)) continue;
      ings = [...ings.filter((r) => r.id !== d.key), { ...(d.data as Ingredient), id: d.key }];
    }
  }
  if (plans !== s.plans) patch.plans = plans;
  if (members !== s.members) patch.members = members;
  if (recipes !== s.customRecipes) patch.customRecipes = recipes;
  if (ings !== s.customIngredients) patch.customIngredients = ings;
  return { patch, added, removed };
}

/**
 * Pe fiecare telefon profilul tău are id-ul „me”. Într-o familie fiecare are nevoie de id-ul lui,
 * așa că la intrare „me” devine id-ul contului tău peste tot (membri, planuri, jurnal, greutate).
 */
export function renameMemberId<T extends object>(state: T, from: string, to: string): T {
  if (from === to) return state;
  const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const json = JSON.stringify(state)
    .replace(new RegExp(`"${esc}"`, 'g'), JSON.stringify(to))
    .replace(new RegExp(`"${esc}\\|`, 'g'), `"${to}|`)
    .replace(new RegExp(`\\|${esc}\\|`, 'g'), `|${to}|`);
  return JSON.parse(json) as T;
}
