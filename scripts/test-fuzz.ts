/*
 * Fuzz pe tot magazinul aplicației: case la întâmplare (de la un om singur la familie cu bebeluș și bunic,
 * vegan cu alergii, buget de 50 de lei, doar microunde…) și sute de acțiuni la întâmplare, ca un om care apasă
 * pe tot: plan nou, schimbă mese, bifează, cumpără, gătește, schimbă mesele pe zi, adaugă și scoate membri,
 * bonuri, cămară, rețete proprii, backup… După fiecare acțiune verific că nu s-a stricat nimic.
 *
 *   npx tsx scripts/test-fuzz.ts [case] [acțiuni pe casă]
 */
import assert from 'node:assert/strict';
import { RECIPE } from '../src/data/recipes';
import { fromISO, toISO, addDays } from '../src/logic/dates';
import { alternativesFor, mealParts, refitPlan } from '../src/logic/planner';
import { fastAllows, mergeRestrictions, recipeFits } from '../src/logic/nutrition';
import type { Member, Settings, Slot, WeekPlan } from '../src/logic/types';

const CASES = Number(process.argv[2] ?? 60);
const STEPS = Number(process.argv[3] ?? 120);
let seedA = Number(process.env.SEED ?? 424242);
const rnd = () => { seedA |= 0; seedA = (seedA + 0x6d2b79f5) | 0; let t = Math.imul(seedA ^ (seedA >>> 15), 1 | seedA); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
// și „Alt plan” (care alege la întâmplare) devine repetabil: aceeași sămânță, aceleași rezultate
let seedB = seedA + 17;
Math.random = () => { seedB = (seedB * 1103515245 + 12345) & 0x7fffffff; return seedB / 0x7fffffff; };
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

// „azi” fix, în săptămâna planurilor (ca testul să nu depindă de ziua în care rulează)
const RealDate = Date;
let NOW = new RealDate('2026-11-18T13:00:00').getTime();
class FixedDate extends RealDate {
  constructor(...a: unknown[]) { if (a.length) super(...(a as [string])); else super(NOW); }
  static now() { return NOW; }
}
(globalThis as Record<string, unknown>).Date = FixedDate;
const mem: Record<string, string> = {};
(globalThis as Record<string, unknown>).window = { localStorage: { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } } };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useStore, exportData } = require('../src/store/useStore');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseReceipt } = require('../src/logic/receiptParser');

const SLOTSETS: Slot[][] = [['pranz', 'cina'], ['mic_dejun', 'cina'], ['mic_dejun', 'pranz'], ['mic_dejun', 'pranz', 'cina'], ['mic_dejun', 'pranz', 'gustare2', 'cina'], ['mic_dejun', 'gustare1', 'pranz', 'gustare2', 'cina'], ['pranz'], ['cina']];
const EQUIP = [['plita', 'cuptor', 'microunde', 'blender'], ['plita', 'cuptor'], ['plita'], ['microunde'], ['plita', 'cuptor', 'microunde', 'blender', 'airfryer']];
const DISLIKES = ['carnati', 'ciuperci', 'ceapa', 'usturoi', 'ficat_pui', 'masline', 'ton', 'somon', 'varza', 'fasole_alba', 'linte', 'branza_telemea', 'smantana', 'oua', 'lapte', 'rosii', 'ardei', 'vinete', 'dovlecel', 'pui_piept'];

function person(id: string, isMain: boolean, kind: 'adult' | 'copil' | 'bebe' | 'batran'): Member {
  const y = kind === 'bebe' ? 2025 : kind === 'copil' ? int(2012, 2022) : kind === 'batran' ? int(1935, 1955) : int(1960, 2008);
  return {
    id, name: pick(['Ana', 'Ion', 'Maria', 'Andrei', 'Ioana', 'Mihai', 'Elena', '', '   ', 'Ștefăniță-Mărioara Popescu-Ionescu']) , isMain,
    sex: pick(['m', 'f'] as const), birthYear: y,
    heightCm: kind === 'bebe' ? 75 : kind === 'copil' ? int(100, 165) : int(140, 210),
    weightKg: kind === 'bebe' ? 9 : kind === 'copil' ? int(15, 70) : int(38, 180),
    activity: pick(['sedentar', 'usor', 'moderat', 'activ', 'foarte_activ'] as const),
    goal: kind === 'adult' ? pick(['slabire', 'mentinere', 'masa'] as const) : 'mentinere', rateKg: pick([0.25, 0.5, 0.75, 1]),
    pregnancy: kind === 'adult' && rnd() < 0.1 ? pick(['t2', 'alaptare'] as const) : 'nu', medical: rnd() < 0.05,
    diet: pick(['omnivor', 'omnivor', 'omnivor', 'vegetarian', 'pescetarian', 'vegan'] as const),
    allergies: rnd() < 0.25 ? [pick(['nuci', 'gluten', 'lactoza', 'oua', 'arahide', 'peste', 'soia', 'telina'] as const)] : [],
    dislikes: rnd() < 0.4 ? [pick(DISLIKES), pick(DISLIKES)] : [], kcalAdjust: rnd() < 0.1 ? int(-300, 300) : 0,
    avoid: rnd() < 0.2 ? [pick(['peste', 'porc', 'miel', 'fructe_mare'] as const)] : undefined,
    away: rnd() < 0.15 ? [pick(['pranz', 'cina', 'mic_dejun'] as Slot[])] : undefined,
    highProtein: rnd() < 0.15,
  } as unknown as Member;
}

function settingsFor(): Settings {
  return {
    ...useStore.getState().settings,
    equipment: pick(EQUIP), slots: pick(SLOTSETS), cookingDays: pick([[6], [6, 2], [0, 1, 2, 3, 4, 5, 6], [5], [1, 3, 5]]),
    maxPrepWeekday: pick([10, 20, 45, 90]), maxPrepWeekend: pick([30, 120, 300]), recipesPerSession: pick([1, 2, 3, 5]),
    budgetRon: pick([50, 120, 250, 400, 700, 2000]), fasting: pick(['niciunul', 'miercuri_vineri', 'posturile_mari', 'toate'] as const),
    fishOnDispensation: rnd() < 0.5, variety: pick(['proaspat', 'mare', 'echilibrat', 'rar'] as const), mealStyle: pick(['acasa', 'variat', 'usor'] as const),
    effort: pick(['weekend', 'oricand', 'simplu'] as const), soupDays: pick([1, 2, 3] as const),
    slotPrefs: rnd() < 0.3 ? { pranz: pick(['ciorba', 'fel', 'usor'] as const), cina: pick(['ciorba', 'fel', 'usor'] as const) } : undefined,
    meatStyle: pick(['des', 'echilibrat', 'rar'] as const) as Settings['meatStyle'],
  } as Settings;
}

const found = new Map<string, { n: number; example: string }>();
const fail = (kind: string, detail: string) => {
  const f = found.get(kind) ?? { n: 0, example: detail };
  f.n++;
  found.set(kind, f);
};

const hasNaN = (o: unknown): boolean => JSON.stringify(o, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? '__NaN__' : v)).includes('__NaN__');

function verify(caseName: string, action: string) {
  const s = useStore.getState();
  const known = (id: string) => !!RECIPE[id] || s.customRecipes.some((r: { id: string }) => r.id === id);
  const memberIds = new Set(s.members.map((m: Member) => m.id));
  for (const p of Object.values(s.plans) as WeekPlan[]) {
    const tag = `${caseName} după ${action}`;
    if (hasNaN(p)) fail('NaN în plan', `${tag}: ${p.id}`);
    if (p.fastDays.length !== 7) fail('fastDays greșit', tag);
    const sids = p.sessions.map((x) => x.id);
    if (new Set(sids).size !== sids.length) fail('gătiri cu același id', `${tag}: ${sids.filter((x, i) => sids.indexOf(x) !== i)}`);
    const keys = new Set<string>();
    const todayIdx0 = Math.floor((NOW - fromISO(p.startISO).getTime()) / 864e5);
    const ended = todayIdx0 > 6;
    const openMeal = (m: { day: number; slot: string }) => !ended && m.day >= Math.max(0, todayIdx0) && !p.eaten.some((e: string) => e.endsWith(`|${m.day}|${m.slot}`));
    for (const m of p.meals) {
      const k = `${m.day}|${m.slot}`;
      if (keys.has(k)) fail('masă dublă', `${tag}: ${k}`);
      keys.add(k);
      if (openMeal(m) && !s.settings.slots.includes(m.slot)) fail('masă pe un slot care nu mai există', `${tag}: ${m.slot}`);
      for (const part of mealParts(m)) {
        if (!known(part.recipeId)) fail('rețetă care nu există', `${tag}: ${part.recipeId} (în ${part === mealParts(m)[0] ? 'fel' : 'garnitură'}, gătire în listă: ${p.sessions.some((x) => x.recipeId === part.recipeId)}, plan ${p.id})`);
        const sx = p.sessions.find((x) => x.id === part.sessionId);
        if (!sx) fail('gătire lipsă pentru o masă', `${tag}: ${part.recipeId}`);
        else if (sx.recipeId !== part.recipeId) fail('masa și gătirea au rețete diferite', `${tag}: masa ${part.recipeId}, gătirea ${sx.recipeId} (${p.id} ${m.day} ${m.slot})`);
        for (const sh of part.shares) {
          if (!(sh.factor > 0 && sh.factor <= 3)) fail('porție imposibilă', `${tag}: ${sh.factor}`);
          if (openMeal(m) && !sh.memberId.startsWith('guest') && !memberIds.has(sh.memberId)) fail('porție pentru cineva care nu mai e în casă', `${tag}: ${sh.memberId} în ${part.recipeId}`);
        }
      }
    }
    for (const x of p.shopping) if (!(x.buyG >= 0) || !(x.needG >= 0) || !(x.cost >= 0) || !(x.packages >= 0)) fail('listă cu cantități negative', `${tag}: ${x.ingId} ${x.buyG}`);
    if (!(p.cost >= 0)) fail('cost negativ/NaN', tag);
    // de azi încolo, mesele nemâncate respectă ce nu mănâncă cei din casă (după refacere)
    const todayIdx = Math.floor((NOW - fromISO(p.startISO).getTime()) / 864e5);
    const ppl = s.members.filter((m: Member) => p.household.memberIds.includes(m.id));
    if (ppl.length && todayIdx >= -6 && todayIdx <= 6) {
      const rs = mergeRestrictions(ppl);
      for (const m of p.meals) {
        if (m.day < Math.max(0, todayIdx) || p.eaten.some((e: string) => e.endsWith(`|${m.day}|${m.slot}`))) continue;
        for (const part of mealParts(m)) {
          const r = RECIPE[part.recipeId] ?? s.customRecipes.find((x: { id: string }) => x.id === part.recipeId);
          // ce e deja gătit sau fixat cu lacătul rămâne (n-are rost să arunci mâncarea)
          if (!r || p.locked?.includes(`${m.day}|${m.slot}`) || p.sessions.find((x) => x.id === part.sessionId)?.done) continue;
          // dacă nu există nicio rețetă potrivită pentru toți (dietă foarte strictă), planul trebuie să spună asta
          if (!recipeFits(r, rs) && !p.warnings.some((w: string) => w.startsWith('Nu am găsit altă rețetă potrivită') && w.includes(r.name))) {
            const inp = s.planInput(p.startISO, p.household, p.seed, p.store);
            const alts = alternativesFor(p, { key: `${m.day}|${m.slot}` }, inp, 12);
            const altsR = alternativesFor(p, { key: `${m.day}|${m.slot}` }, inp, 12, true);
            const again = refitPlan(p, inp, Math.max(0, todayIdx));
            const still = again.plan.meals.find((x) => x.day === m.day && x.slot === m.slot);
            if (process.env.DBG) console.log('DBG', r.name, 'relaxat', altsR.length, 'după refit din nou:', still && RECIPE[still.recipeId]?.name, 'eaten', p.eaten.filter((e: string) => e.includes(`|${m.day}|`)), 'session', JSON.stringify(p.sessions.find((x) => x.id === part.sessionId)), 'own', p.meals.filter((x) => x.sessionId === part.sessionId).map((x) => x.day + x.slot));
            const sess = p.sessions.find((x) => x.id === part.sessionId);
            fail('masă viitoare care nu respectă dieta/alergiile/ce nu mănânci', `${tag}: ${r.name} (plan ${p.id}, ziua ${m.day}, azi ${todayIdx}, ${part === mealParts(m)[0] ? 'fel principal' : 'garnitură'}, gătire ${sess?.day} nocook=${sess?.nocook} done=${sess?.done}, alternative ${alts.length}, slot ${m.slot}, oameni ${ppl.map((x: Member) => x.diet + '/' + x.allergies.join('+')).join(',')}, echip ${s.settings.equipment})`);
          }
          if (!fastAllows(p.fastDays[m.day], r) && process.env.DBG) {
            const inp = s.planInput(p.startISO, p.household, p.seed, p.store);
            const sess = p.sessions.find((x) => x.id === part.sessionId);
            console.log('DBGF', r.name, 'zi', m.day, m.slot, 'alt', alternativesFor(p, { key: `${m.day}|${m.slot}` }, inp, 5).length, alternativesFor(p, { key: `${m.day}|${m.slot}` }, inp, 5, true).length, 'sess', JSON.stringify(sess), 'own', p.meals.filter((x) => x.sessionId === part.sessionId).map((x) => `${x.day}${x.slot}`), 'eaten', p.eaten, 'warn', p.warnings.filter((w: string) => w.startsWith('Nu am')), 'fast', s.settings.fasting, p.fastDays.join(','), 'today', todayIdx, 'hh', p.household.applyFasting);
          }
          if (!fastAllows(p.fastDays[m.day], r) && !p.warnings.some((w: string) => w.startsWith('Nu am găsit altă rețetă potrivită') && w.includes(r.name))) fail('masă de dulce în zi de post', `${tag}: ${r.name} ziua ${m.day} (${p.fastDays[m.day]}, ${part === mealParts(m)[0] ? 'fel principal' : 'garnitură lângă ' + RECIPE[m.recipeId]?.name}, gătire ${p.sessions.find((x) => x.id === part.sessionId)?.day}, aplică post ${p.household.applyFasting})`);
        }
      }
    }
  }
  for (const f of s.foodLog) if (!(f.kcal >= 0) || hasNaN(f)) fail('jurnal cu calorii greșite', `${caseName} după ${action}: ${f.label} ${f.kcal}`);
  for (const x of s.pantry) if (!(x.g >= 0) || hasNaN(x)) fail('cămară cu cantitate greșită', `${caseName} după ${action}: ${x.ingId} ${x.g}`);
  if (!s.members.some((m: Member) => m.isMain)) fail('nu mai există profilul principal', `${caseName} după ${action}`);
}

const RECEIPTS = [
  'LIDL\nLAPTE 1.5% 1L 6,49\nPAINE ALBA 3,99\nDETERGENT ARIEL 39,99\nOUA M 10BUC 12,90\nTOTAL 63,37',
  'KAUFLAND\nPIEPT PUI 0,850 KG x 29,99 25,49\nCIOCOLATA MILKA 5,49\nHARTIE IGIENICA 19,99\nSGR 0,50\nTOTAL 51,47',
  '', '%%%%', 'TOTAL 0', 'ROSII 1 KG 9,99\nCASTRAVETI 0.5KG 4,50\nBERE URSUS 6x 29,94\n',
];

type Act = [string, number, () => void];
function actions(): Act[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = () => useStore.getState() as any;
  const plans = () => Object.values(s().plans) as WeekPlan[];
  const aPlan = (): WeekPlan | undefined => pick(plans());
  const monday = () => toISO(addDays(fromISO('2026-11-16'), pick([0, 0, 7, -7, 3])));
  return [
    ['plan nou', 6, () => { s().generate(monday(), { memberIds: s().members.map((m: Member) => m.id), guests: pick([0, 0, 1, 3]), applyFasting: rnd() < 0.5 }); }],
    ['alt plan cu lacăt', 2, () => { const p = aPlan(); if (!p?.meals.length) return; const m = pick(p.meals); s().toggleLock(p.id, m.day, m.slot); const lk = (s().plans[p.id].locked ?? []).map((k: string) => { const [d, sl] = k.split('|'); const mm = p.meals.find((x) => x.day === Number(d) && x.slot === sl); return mm ? { day: mm.day, slot: mm.slot, recipeId: mm.recipeId } : null; }).filter(Boolean); s().generate(p.startISO, p.household, undefined, p.store, { locked: lk }); }],
    // ca în ecranul „Altă rețetă”: doar ce îți propune aplicația
    ['schimbă o masă', 6, () => { const p = aPlan(); if (!p?.meals.length) return; const m = pick(p.meals); const k = `${m.day}|${m.slot}`; const alts = alternativesFor(p, { key: k }, s().planInput(p.startISO, p.household, p.seed, p.store), 12); if (alts.length) { const a = pick(alts); if (!fastAllows(p.fastDays[m.day], a)) fail('„Altă rețetă” propune ceva de dulce în zi de post', `${a.name} ziua ${m.day} ${p.fastDays[m.day]}`); s().replaceMeal(p.id, k, a.id); const after = s().plans[p.id]; const nm = after.meals.find((x: { day: number; slot: string }) => x.day === m.day && x.slot === m.slot); if (process.env.DBG) for (const x of after.meals) { const r0 = RECIPE[x.recipeId]; if (r0 && !fastAllows(after.fastDays[x.day], r0)) { const bx = p.meals.find((y) => y.day === x.day && y.slot === x.slot); console.log('DBG2 schimbat', k, '->', a.name, '| acum', x.day, x.slot, r0.name, after.fastDays[x.day], '| înainte', bx && RECIPE[bx.recipeId]?.name, p.fastDays[x.day], 'aceeași gătire', bx?.sessionId === x.sessionId); } } } }],
    ['schimbă o gătire', 3, () => { const p = aPlan(); if (!p?.sessions.length || !p.meals.length) return; const m = pick(p.meals); const alts = alternativesFor(p, { sessionId: m.sessionId }, s().planInput(p.startISO, p.household, p.seed, p.store), 12); if (alts.length) { const a = pick(alts); s().replaceSession(p.id, m.sessionId, a.id); if (process.env.DBG) { const q = s().plans[p.id] as WeekPlan; for (const x of q.meals) { const sx = q.sessions.find((y) => y.id === x.sessionId); if (sx && sx.recipeId !== x.recipeId) console.log('DBG3 schimbat', m.sessionId, m.recipeId, '->', a.id, '| masa', x.day, x.slot, x.recipeId, 'gătire', x.sessionId, sx.recipeId, 'înainte', JSON.stringify(p.meals.find((y) => y.day === x.day && y.slot === x.slot)?.sessionId), JSON.stringify(p.sessions.find((y) => y.id === x.sessionId))); } } } }],
    ['bifez masa', 8, () => { const p = aPlan(); if (!p?.meals.length) return; const m = pick(p.meals); s().toggleEaten(p.id, m.day, m.slot, rnd() < 0.5, rnd() < 0.2 ? pick([0.5, 1.5, 2]) : undefined); }],
    ['n-am mâncat', 2, () => { const p = aPlan(); if (!p?.meals.length) return; const m = pick(p.meals); s().skipMeal(p.id, m.day, m.slot); }],
    ['confirm ziua', 2, () => { s().confirmDay(pick(['2026-11-16', '2026-11-17', '2026-11-18']), pick(['all', 'first', 'none'] as const)); }],
    ['bifez pe listă', 6, () => { const p = aPlan(); if (!p?.shopping.length) return; s().toggleShopItem(p.id, pick(p.shopping).ingId); }],
    ['am cumpărat', 3, () => { const p = aPlan(); if (!p?.shopping.length) return; s().buyItems(p.id, p.shopping.filter(() => rnd() < 0.5).map((x) => x.ingId), rnd() < 0.5 ? int(0, 500) : undefined); }],
    ['am gătit', 4, () => { const p = aPlan(); if (!p?.sessions.length) return; s().cookSession(p.id, pick(p.sessions).id); }],
    ['ingredient de bază', 2, () => { const p = aPlan(); if (!p) return; s().toggleBasic(p.id, pick(['sare', 'ulei', 'faina', 'zahar', 'piper'])); }],
    ['magazinul planului', 1, () => { const p = aPlan(); if (!p) return; s().setPlanStore(p.id, pick(['lidl', 'kaufland', 'carrefour', 'mega', 'profi', 'penny'])); }],
    ['mese pe zi', 4, () => { s().setMealSlots(pick(SLOTSETS)); }],
    ['setări', 4, () => { const n = settingsFor(); const keys = (Object.keys(n) as (keyof Settings)[]).filter((k) => k !== 'slots'); const k = pick(keys); s().updateSettings({ [k]: n[k] } as Partial<Settings>); }],
    ['post', 2, () => { s().setFeature('post', rnd() < 0.5); }],
    ['nu-mi place', 4, () => { s().toggleDislike(pick(Object.keys(RECIPE))); }],
    ['îmi place', 3, () => { s().toggleLike(pick(Object.keys(RECIPE))); }],
    ['membru nou', 3, () => { if (s().members.length < 7) s().upsertMember(person(`m_${int(1, 99999)}`, false, pick(['adult', 'copil', 'bebe', 'batran'] as const))); }],
    ['schimb un membru', 4, () => { const m = pick(s().members as Member[]); const n = person(m.id, m.isMain, 'adult'); s().upsertMember({ ...m, diet: n.diet, allergies: n.allergies, dislikes: n.dislikes, away: n.away, weightKg: n.weightKg, goal: n.goal }); }],
    ['scot un membru', 2, () => { const o = (s().members as Member[]).filter((m) => !m.isMain); if (o.length) s().removeMember(pick(o).id); }],
    ['bon', 3, () => { const items = parseReceipt(pick(RECEIPTS).split('\n')); const food = items.filter((x: { ingId?: string }) => x.ingId); s().applyReceipt(food.map((x: { ingId: string; grams?: number; total?: number }) => ({ ingId: x.ingId, g: x.grams ?? 100, price: x.total })), 'lidl', int(0, 300), int(0, 50)); }],
    ['cămară', 4, () => { const ids = ['oua', 'lapte', 'cartofi', 'pui_piept', 'orez', 'rosii', 'ceapa']; const r = rnd(); if (r < 0.5) s().addPantry(pick(ids), pick([0, 1, 50, 500, 5000]), pick([undefined, 1, 30])); else if (s().pantry.length) { const x = pick(s().pantry as { id: string }[]); if (r < 0.8) s().setPantryQty(x.id, pick([0, -5, 10, 1e6])); else s().removePantry(x.id); } }],
    ['jurnal', 3, () => { if (rnd() < 0.7) s().addFood({ dateISO: '2026-11-18', label: 'covrig', kcal: pick([0, 250, 3000]), p: 5, c: 40, f: 3, slot: pick(['mic_dejun', 'pranz']) }); else if (s().foodLog.length) s().removeFood(pick(s().foodLog as { id: string }[]).id); }],
    ['rețetă proprie', 2, () => { const id = `c_${int(1, 9999)}`; s().saveRecipe({ id, name: pick(['Ciorba mamei', 'X', '']), en: '', meal: [pick(['principal', 'mic_dejun', 'gustare'] as const)], cuisine: 'ro', servings: pick([1, 4, 12]), prep: pick([5, 60, 600]), equipment: [], keepsDays: pick([0, 3]), ing: [['cartofi', pick([1, 500, 3000])], ['ceapa', 50]], steps: ['Fierbi.'], custom: true } as never); }],
    ['șterg rețetă proprie (folosită în plan)', 1, () => {
      const c = s().customRecipes as { id: string }[]; if (!c.length) return;
      const id = pick(c).id;
      const inMeals = plans().some((p) => p.meals.some((m) => mealParts(m).some((x) => x.recipeId === id)));
      const inSess = plans().some((p) => p.sessions.some((x) => x.recipeId === id));
      if (inMeals && !inSess) fail('rețetă în mese, dar fără gătire', id);
      s().deleteRecipe(id);
    }],
    ['șterg un plan', 1, () => { const p = aPlan(); if (p) s().deletePlan(p.id); }],
    ['evaluez masa', 2, () => { const p = aPlan(); if (!p?.meals.length) return; const m = pick(p.meals); s().rateMeal(p.id, `${m.day}|${m.slot}`, m.recipeId, pick([1, -1] as const)); }],
    ['swipe', 1, () => { s().recordSwipes({ [pick(Object.keys(RECIPE))]: pick([1, -1] as const) }); }],
    ['backup și restaurare', 1, () => {
      const d = JSON.parse(JSON.stringify(exportData()));
      const refs = new Set((Object.values(d.state.plans) as WeekPlan[]).flatMap((p) => p.sessions.map((x) => x.recipeId)));
      const missing = [...refs].filter((id) => !RECIPE[id] && !d.state.customRecipes.some((r: { id: string }) => r.id === id));
      if (missing.length) fail('backup-ul are planuri cu rețete lipsă', `${missing} custom=${d.state.customRecipes.map((r: { id: string }) => r.id)}`);
      const ok = s().importData(d);
      if (!ok) fail('backup-ul propriu nu se poate restaura', 'importData a dat false');
    }],
    ['restaurare stricată', 1, () => { for (const bad of [null, {}, { app: 'nutritie' }, { app: 'nutritie', version: 1, state: { members: 'x' } }, 'text', 42]) s().importData(bad); }],
    ['trece o zi', 2, () => { NOW += 864e5; }],
  ];
}

const t0 = RealDate.now();
const slow = new Map<string, number>();
let total = 0;
for (let c = 0; c < CASES; c++) {
  const caseName = `casa #${c}`;
  const st = useStore.getState();
  st.resetAll?.();
  NOW = new RealDate('2026-11-18T13:00:00').getTime();
  const kinds = pick([['adult'], ['adult', 'adult'], ['adult', 'adult', 'copil'], ['adult', 'adult', 'copil', 'bebe'], ['batran'], ['adult', 'batran', 'copil', 'copil', 'adult']] as const);
  const members = kinds.map((k, i) => person(i === 0 ? 'me' : `m_${i}`, i === 0, i === 0 && k === 'bebe' ? 'adult' : k));
  try {
    st.completeOnboarding(members, settingsFor());
    useStore.getState().generate('2026-11-16', { memberIds: members.map((m) => m.id), guests: 0, applyFasting: rnd() < 0.5 });
    verify(caseName, 'primul plan');
  } catch (e) {
    fail(`a căzut la: primul plan`, `${caseName}: ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}`);
    continue;
  }
  const acts = actions();
  const weights = acts.reduce((a, x) => a + x[1], 0);
  for (let i = 0; i < STEPS; i++) {
    let r = rnd() * weights;
    const act = acts.find((x) => (r -= x[1]) < 0) ?? acts[0];
    try {
      const ta = RealDate.now();
      act[2]();
      const dt = RealDate.now() - ta;
      if (dt > (slow.get(act[0]) ?? 0)) slow.set(act[0], dt);
      total++;
      verify(caseName, act[0]);
    } catch (e) {
      fail(`a căzut la: ${act[0]}`, `${caseName}: ${(e as Error).stack?.split('\n').slice(0, 4).join(' | ')}`);
    }
  }
}
(globalThis as Record<string, unknown>).Date = RealDate;
console.log(`${CASES} case, ${total} acțiuni în ${Math.round((RealDate.now() - t0) / 1000)} s`);
console.log('cele mai lente: ' + [...slow].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v} ms`).join(', '));
for (const [k, v] of slow) if (v > 3000) fail('prea lent', `${k}: ${v} ms`);
if (!found.size) console.log('✓ nimic stricat');
for (const [k, v] of [...found].sort((a, b) => b[1].n - a[1].n)) console.log(`✗ ${k} (${v.n}×): ${v.example.slice(0, 400)}`);
assert.ok(true);
process.exit(found.size ? 1 : 0);
