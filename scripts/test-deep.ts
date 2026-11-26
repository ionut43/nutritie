/// <reference types="node" />
/*
 * Teste adânci: sute de profiluri aleatoare (sex, vârstă, greutate, obiectiv, dietă, alergii, mese pe zi, zile de gătit,
 * buget, post, familie) și verific tot ce trebuie să fie adevărat în orice plan, plus fluxurile din aplicație (store).
 *   npx tsx scripts/test-deep.ts [N=300]
 */
import assert from 'node:assert/strict';
import { ING } from '../src/data/ingredients';
import { RECIPE, RECIPES } from '../src/data/recipes';
import { computeTargets } from '../src/logic/energy';
import { fastAllows, hasEquipment, mergeRestrictions, perServing, proteinKind, recipeAllergens, recipeFits } from '../src/logic/nutrition';
import {
  alternativesFor, BUDGET_SLACK, familiarity, generatePlan, isSoup, mealKey, mealMacros, mealParts, replaceSessionRecipe,
  replaceSingleMeal, sessionMeals, trimPlanSlots, type PlanInput,
} from '../src/logic/planner';
import type { Member, Settings, Slot, WeekPlan } from '../src/logic/types';

const N = Number(process.argv[2] ?? 300);
let seedA = 987654;
const rnd = () => { seedA |= 0; seedA = (seedA + 0x6d2b79f5) | 0; let t = Math.imul(seedA ^ (seedA >>> 15), 1 | seedA); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const SLOTSETS: Slot[][] = [['pranz', 'cina'], ['mic_dejun', 'pranz', 'cina'], ['mic_dejun', 'pranz', 'gustare2', 'cina'], ['mic_dejun', 'gustare1', 'pranz', 'gustare2', 'cina'], ['pranz'], ['mic_dejun', 'cina']];
const EQUIP = [['plita', 'cuptor', 'microunde', 'blender'], ['plita', 'cuptor'], ['plita'], ['plita', 'cuptor', 'microunde', 'blender', 'airfryer']] as const;

function member(id: string, isMain: boolean, child = false): Member {
  const goal = child ? 'mentinere' : pick(['slabire', 'mentinere', 'masa'] as const);
  return {
    id, name: id, isMain, sex: pick(['m', 'f'] as const), birthYear: child ? 2012 + Math.floor(rnd() * 10) : 1950 + Math.floor(rnd() * 55),
    heightCm: child ? 110 + Math.floor(rnd() * 50) : 150 + Math.floor(rnd() * 45), weightKg: child ? 20 + Math.floor(rnd() * 30) : 45 + Math.floor(rnd() * 80),
    activity: pick(['sedentar', 'usor', 'moderat', 'activ', 'foarte_activ'] as const), goal, rateKg: pick([0.25, 0.5, 0.75, 1]),
    pregnancy: 'nu', medical: false, diet: pick(['omnivor', 'omnivor', 'omnivor', 'vegetarian', 'pescetarian', 'vegan'] as const),
    allergies: rnd() < 0.2 ? [pick(['nuci', 'gluten', 'lactoza', 'oua', 'arahide', 'peste'] as const)] : [],
    dislikes: [], kcalAdjust: 0, avoid: rnd() < 0.25 ? [pick(['peste', 'porc', 'miel', 'fructe_mare'] as const)] : undefined,
  } as unknown as Member;
}

const fails: string[] = [];
const check = (cond: boolean, msg: string) => { if (!cond && fails.length < 60) fails.push(msg); };
const UNDER: Record<string, number> = {};
const stats = { plans: 0, days: 0, dayOk: 0, weekP: 0, weekPOk: 0, overBudget: 0, warnedBudget: 0, exotic: 0, meals: 0, sides: 0, sweetsOver: 0 };

function verifyPlan(name: string, input: PlanInput, p: WeekPlan) {
  const people = input.members.filter((m) => input.household.memberIds.includes(m.id));
  const rs = mergeRestrictions(people);
  const slots = input.settings.slots;
  check(p.meals.length === slots.length * 7 || p.warnings.some((w) => w.includes('nicio rețetă')), `${name}: ${p.meals.length}/${slots.length * 7} mese`);
  const keys = new Set<string>();
  for (const m of p.meals) {
    const k = mealKey(m.day, m.slot);
    check(!keys.has(k), `${name}: masă dublă ${k}`); keys.add(k);
    for (const part of mealParts(m)) {
      const r = RECIPE[part.recipeId];
      check(!!r, `${name}: rețetă lipsă ${part.recipeId}`);
      if (!r) continue;
      check(recipeFits(r, rs) || !!r.tags?.includes('garnitura') && recipeFits(r, rs), `${name}: ${r.id} nu respectă dieta/alergiile`);
      for (const a of rs.allergies ?? []) check(!recipeAllergens(r).includes(a), `${name}: ${r.id} conține ${a}`);
      check(fastAllows(p.fastDays[m.day], r), `${name}: ${r.id} încalcă postul în ziua ${m.day}`);
      check(r.equipment.length === 0 || hasEquipment(r, input.settings.equipment), `${name}: ${r.id} cere echipament lipsă`);
      check(p.sessions.some((s) => s.id === part.sessionId), `${name}: sesiune lipsă pentru ${r.id}`);
      for (const sh of part.shares) check(Number.isFinite(sh.factor) && sh.factor >= 0.25 && sh.factor <= 2.5, `${name}: porție ${sh.factor} la ${r.id}`);
    }
    const main = RECIPE[m.recipeId];
    const s = p.sessions.find((x) => x.id === m.sessionId)!;
    check(m.day >= s.day, `${name}: mâncat înainte de gătit`);
    check(m.day - s.day <= main.keepsDays || !!m.frozen, `${name}: ${main.id} ținut ${m.day - s.day} zile`);
    for (const sd of m.sides ?? []) {
      const sr = RECIPE[sd.recipeId];
      check(sd.recipeId !== m.recipeId, `${name}: garnitura e chiar felul principal`);
      if (isSoup(sr)) check(proteinKind(sr) !== proteinKind(main), `${name}: ${sr.name} lângă ${main.name} (aceeași proteină)`);
      const ss = p.sessions.find((x) => x.id === sd.sessionId)!;
      check(m.day >= ss.day && m.day - ss.day <= sr.keepsDays, `${name}: garnitura ${sr.id} ținută ${m.day - ss.day} zile`);
      stats.sides++;
    }
    stats.meals++;
    if (familiarity(main) < 0.55 && !input.weekCuisines?.length) stats.exotic++;
  }
  for (const s of p.sessions) {
    check(Number.isInteger(s.portions) && s.portions >= 1, `${name}: porții ${s.portions}`);
    check(sessionMeals(p, s.id).length > 0, `${name}: sesiune fără mese ${s.recipeId}`);
  }
  for (const it of p.shopping) {
    check(it.packages * ING[it.ingId].pkg >= it.buyG - 0.5, `${name}: ambalaj insuficient ${it.ingId}`);
    check(Number.isFinite(it.cost) && it.cost >= 0, `${name}: cost NaN ${it.ingId}`);
  }
  check(Number.isFinite(p.cost), `${name}: cost NaN`);
  if (p.cost > input.settings.budgetRon + BUDGET_SLACK) {
    stats.overBudget++;
    if (!name.includes(' ')) check(p.warnings.some((w) => w.includes('nu ies')), `${name}: peste buget fără avertisment`);
  }
  // caloriile: fiecare zi, pentru fiecare persoană, cel mult +5% și de obicei peste -10%
  for (const per of people) {
    const tg = computeTargets(per, new Date(input.startISO));
    let wp = 0;
    for (let d = 0; d < 7; d++) {
      const day = p.meals.filter((m) => m.day === d);
      const k = day.reduce((a, m) => a + mealMacros(m, per.id).kcal, 0);
      wp += day.reduce((a, m) => a + mealMacros(m, per.id).p, 0);
      check(k <= tg.kcal * 1.06 + 5, `${name}: ${per.id} ziua ${d} ${Math.round(k)} > ${tg.kcal}`);
      if (process.argv.includes("--over") && k > tg.kcal * 1.06 + 5) console.log(`OVER ${name} ${input.settings.slots.join(",")} ${JSON.stringify(input.settings.mealStyle)} ${day.map((m) => `${m.slot}:${RECIPE[m.recipeId].name}×${m.shares.find((x) => x.memberId === per.id)?.factor}[${Math.round(mealMacros(m, per.id).kcal)}] ${(m.sides ?? []).map((x) => RECIPE[x.recipeId].name + "×" + x.shares.find((y) => y.memberId === per.id)?.factor).join(",")}`).join(" | ")}`);
      check(Number.isFinite(k), `${name}: kcal NaN`);
      if (input.settings.slots.length > 1) {
        stats.days++;
        if (k >= tg.kcal * 0.88) stats.dayOk++;
        else if (process.argv.includes('--under')) for (const m of day) UNDER[RECIPE[m.recipeId].id] = (UNDER[RECIPE[m.recipeId].id] ?? 0) + 1;
      }
      else if (process.argv.includes('--low') && d === 0) console.log(`LOW ${name} ${per.id} ${Math.round(k)}/${tg.kcal} sloturi ${input.settings.slots.join(',')} dietă ${per.diet} ${day.map((m) => `${RECIPE[m.recipeId].name}×${m.shares.find((x) => x.memberId === per.id)?.factor}`).join(' | ')}`);
    }
    if (per.isMain) { stats.weekP++; if (wp / 7 >= tg.protein * 0.75) stats.weekPOk++; }
  }
  const sweets = p.meals.filter((m) => RECIPE[m.recipeId].tags?.includes('desert')).map((m) => m.sessionId);
  if (sweets.length > (input.settings.dessertsPerWeek ?? 2) + 2) { stats.sweetsOver++; if (process.argv.includes('--sweet')) console.log(`SWEET ${name} ${input.settings.slots.join(',')} ${[...new Set(p.meals.filter((m) => RECIPE[m.recipeId].tags?.includes('desert')).map((m) => RECIPE[m.recipeId].name))].join('; ')}`); }
}

const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const me = member('me', true);
  const others = rnd() < 0.3 ? [member('p', false)] : [];
  if (rnd() < 0.15) others.push(member('k', false, true));
  const settings = {
    equipment: [...pick(EQUIP)], slots: pick(SLOTSETS), slotsAsked: true, cookingDays: pick([[6], [6, 2], [6, 2, 4], [0, 1, 2, 3, 4, 5, 6], [5]]),
    maxPrepWeekday: pick([20, 30, 45, 60]), maxPrepWeekend: pick([60, 120]), recipesPerSession: 3,
    budgetRon: pick([150, 200, 270, 350, 450, 700]), fasting: pick(['niciunul', 'niciunul', 'toate', 'miercuri_vineri']),
    fishOnDispensation: true, variety: pick(['mare', 'echilibrat', 'rar']), meatStyle: pick(['des', 'echilibrat', 'rar']),
  } as unknown as Settings;
  const input: PlanInput = {
    startISO: pick(['2026-11-16', '2026-12-21', '2027-03-01', '2027-04-26', '2027-07-12']), members: [me, ...others],
    household: { memberIds: ['me', ...others.map((o) => o.id)], guests: rnd() < 0.1 ? 2 : 0, applyFasting: rnd() < 0.5 },
    settings, pantry: [], prices: {}, liked: [], disliked: [], previousRecipeIds: [], seed: Math.floor(rnd() * 1e9),
    weekCuisines: rnd() < 0.15 ? [pick(['as', 'in', 'mx', 'or', 'it'] as const)] : undefined,
  };
  const name = `#${i}`;
  let p: WeekPlan;
  try { p = generatePlan(input); } catch (e) { check(false, `${name}: generatePlan a căzut: ${(e as Error).message}`); continue; }
  stats.plans++;
  verifyPlan(name, input, p);
  // schimbări: o masă, o gătire întreagă, mai puține mese pe zi
  try {
    const m = pick(p.meals);
    const alts = alternativesFor(p, { key: mealKey(m.day, m.slot) }, input, 5);
    if (alts.length) verifyPlan(`${name} schimbă masa`, input, replaceSingleMeal(p, mealKey(m.day, m.slot), alts[0].id, input));
    const sa = alternativesFor(p, { sessionId: m.sessionId }, input, 5);
    if (sa.length) verifyPlan(`${name} schimbă gătirea`, input, replaceSessionRecipe(p, m.sessionId, sa[0].id, input));
    if (settings.slots.length > 2) {
      const two: Slot[] = ['pranz', 'cina'];
      verifyPlan(`${name} 2 mese`, { ...input, settings: { ...settings, slots: two } }, trimPlanSlots(p, two, { ...input, settings: { ...settings, slots: two } }));
    }
  } catch (e) { check(false, `${name}: schimbare a căzut: ${(e as Error).stack?.split('\n').slice(0, 3).join(' ')}`); }
}

// ── datele: fiecare rețetă are tot ce trebuie ──
for (const r of RECIPES) {
  const ps = perServing(r);
  check(Number.isFinite(ps.kcal) && ps.kcal > 20, `${r.id}: kcal ${ps.kcal}`);
  check(r.servings >= 1 && r.steps.length >= 1, `${r.id}: porții/pași`);
  check(r.ing.every(([id, g]) => ING[id] && g > 0), `${r.id}: ingrediente`);
  if (r.meal.includes('principal')) check(ps.kcal >= 150, `${r.id}: masă principală de ${Math.round(ps.kcal)} kcal`);
}

// ── fluxurile din aplicație, prin store, pe câteva profiluri ──
{
  // magazinul lucrează cu „azi”: îl fixez în săptămâna planului de test, ca testul să nu depindă de ziua în care rulează
  const RealDate = Date;
  const NOW = new RealDate('2026-11-17T12:00:00').getTime();
  class FixedDate extends RealDate {
    constructor(...a: unknown[]) { if (a.length) super(...(a as [string])); else super(NOW); }
    static now() { return NOW; }
  }
  (globalThis as Record<string, unknown>).Date = FixedDate;
  const mem: Record<string, string> = {};
  (globalThis as Record<string, unknown>).window = { localStorage: { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } } };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useStore, eatenKey, exportData } = require('../src/store/useStore');
  for (let i = 0; i < 25; i++) {
    const name = `store #${i}`;
    try {
      const st = useStore.getState();
      st.resetAll?.();
      const me = { ...member('me', true), diet: 'omnivor', allergies: [] } as Member;
      const slots = pick(SLOTSETS.slice(0, 4));
      useStore.setState({ members: [me], onboarded: true, activeMemberId: 'me', settings: { ...useStore.getState().settings, slots, fasting: 'niciunul', budgetRon: 300, cookingDays: [6, 2] } });
      const plan = useStore.getState().generate('2026-11-16', { memberIds: ['me'], guests: 0, applyFasting: false }, 100 + i);
      useStore.setState({ plans: { [plan.id]: { ...useStore.getState().plans[plan.id], createdAt: '2026-11-15T20:00:00' } } });
      // mănânc ziua 0 cu toate mesele: jurnalul are exact caloriile mesei (cu garnituri)
      for (const m of plan.meals.filter((x: { day: number }) => x.day === 0)) {
        useStore.getState().toggleEaten(plan.id, 0, m.slot);
        const key = eatenKey('me', 0, m.slot);
        const e = useStore.getState().foodLog.find((f: { mealKey?: string }) => f.mealKey === key);
        check(!!e && Math.abs(e.kcal - mealMacros(m, 'me').kcal) < 1, `${name}: jurnal ${e?.kcal} vs ${mealMacros(m, 'me').kcal}`);
        if (m.sides?.length) check(e.label.includes('cu '), `${name}: eticheta nu spune garniturile`);
      }
      // dezbif și bif din nou: nu se dublează
      const m0 = plan.meals.find((x: { day: number }) => x.day === 0);
      useStore.getState().toggleEaten(plan.id, 0, m0.slot);
      useStore.getState().toggleEaten(plan.id, 0, m0.slot, true);
      check(useStore.getState().foodLog.filter((f: { mealKey?: string }) => f.mealKey === eatenKey('me', 0, m0.slot)).length === 1, `${name}: masă dublată în jurnal`);
      useStore.getState().confirmDay('2026-11-17', 'first');
      useStore.getState().confirmDay('2026-11-18', 'none');
      // cumpărături, gătit, cămară
      const p1 = useStore.getState().plans[plan.id];
      useStore.getState().buyItems(plan.id, p1.shopping.slice(0, 3).map((x: { ingId: string }) => x.ingId), 50);
      for (const s of p1.sessions.slice(0, 2)) useStore.getState().cookSession(plan.id, s.id);
      // schimb o masă și o gătire, apoi lacăt și plan nou: masa fixată rămâne
      const p2 = useStore.getState().plans[plan.id];
      const target = p2.meals[p2.meals.length - 1];
      const alt = alternativesFor(p2, { key: mealKey(target.day, target.slot) }, useStore.getState().planInput(p2.startISO, p2.household, p2.seed), 3)[0];
      if (alt) useStore.getState().replaceMeal(plan.id, mealKey(target.day, target.slot), alt.id);
      const p3 = useStore.getState().plans[plan.id];
      const lk = p3.meals.find((x: { day: number }) => x.day === 3);
      useStore.getState().toggleLock(plan.id, lk.day, lk.slot);
      const locked = (useStore.getState().plans[plan.id].locked ?? []).map((k: string) => { const [d, sl] = k.split('|'); const mm = p3.meals.find((x: { day: number; slot: string }) => x.day === Number(d) && x.slot === sl); return { day: mm.day, slot: mm.slot, recipeId: mm.recipeId }; });
      const np = useStore.getState().generate(p3.startISO, p3.household, 999 + i, p3.store, { locked });
      check(np.meals.some((x: { day: number; slot: string; recipeId: string }) => x.day === lk.day && x.slot === lk.slot && x.recipeId === lk.recipeId), `${name}: lacătul nu a ținut`);
      check(Object.keys(useStore.getState().plans).length === 1, `${name}: plan vechi rămas lângă cel nou`);
      // mai puține mese pe zi
      if (slots.length > 2) {
        useStore.getState().setMealSlots(['pranz', 'cina']);
        const p4 = Object.values(useStore.getState().plans)[0] as WeekPlan;
        check(p4.meals.every((x) => x.slot === "pranz" || x.slot === "cina"), `${name}: au rămas mese vechi ${JSON.stringify(slots)} ${[...new Set(p4.meals.map((x) => x.slot))]} planuri ${Object.keys(useStore.getState().plans).length}`);
      }
      // backup și restaurare
      const data = JSON.parse(JSON.stringify(exportData()));
      useStore.getState().resetAll?.();
      check(useStore.getState().importData(data) === true, `${name}: backup-ul nu se citește`);
      check(Object.keys(useStore.getState().plans).length >= 1, `${name}: planul s-a pierdut la restaurare`);
    } catch (e) {
      check(false, `${name}: a căzut: ${(e as Error).stack?.split('\n').slice(0, 4).join(' ')}`);
    }
  }
  (globalThis as Record<string, unknown>).Date = RealDate;
  console.log('fluxuri din aplicație: 25 de profiluri');
}

const pct = (a: number, b: number) => `${Math.round((100 * a) / Math.max(1, b))}%`;
console.log(`${stats.plans} planuri (+ schimbări), ${stats.meals} mese, ${stats.sides} garnituri, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (process.argv.includes('--under')) console.log(Object.entries(UNDER).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${RECIPE[k].name} (${k}) ${v}`).join('\n'));
console.log(`zile cu cel puțin 88% din calorii: ${pct(stats.dayOk, stats.days)}; săptămâni cu proteine ≥75% din țintă: ${pct(stats.weekPOk, stats.weekP)}`);
console.log(`planuri peste buget+${BUDGET_SLACK} (toate cu avertisment): ${stats.overBudget}; mese exotice nealese: ${pct(stats.exotic, stats.meals)}; planuri cu prea multe dulciuri: ${stats.sweetsOver}`);
if (fails.length) {
  console.log(`\n${fails.length} probleme:`);
  for (const f of fails) console.log(' ✗', f);
  process.exit(1);
}
assert.ok(stats.dayOk / stats.days > 0.85, 'prea multe zile sub țintă');
console.log('✓ toate invariantele țin');
