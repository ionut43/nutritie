/// <reference types="node" />
/*
 * Audit: generează planuri pentru multe profiluri și măsoară cât de aproape sunt de ținte.
 *   npx tsx scripts/audit-plans.ts [n=60] [--names]
 * Raportează: kcal pe zi vs țintă, proteine/carbo/grăsimi/fibre/zahăr/sare vs ținte, cost vs buget,
 * cât de „familiare” sunt rețetele, repetări, timp.
 */
import { RECIPE } from '../src/data/recipes';
import { computeTargets } from '../src/logic/energy';
import { perServing } from '../src/logic/nutrition';
import { familiarity, generatePlan, isSweet, type PlanInput } from '../src/logic/planner';
import type { Member, Settings, Slot } from '../src/logic/types';

const N = Number(process.argv[2] ?? 60);
const NAMES = process.argv.includes('--names');
const rnd = (() => { let a = 12345; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

const SLOTSETS: Slot[][] = [['pranz', 'cina'], ['mic_dejun', 'pranz', 'cina'], ['mic_dejun', 'pranz', 'gustare2', 'cina'], ['mic_dejun', 'gustare1', 'pranz', 'gustare2', 'cina']];
type Row = { kcal: number; p: number; c: number; f: number; fib: number; sug: number; salt: number; tk: number; tp: number; tc: number; tf: number };
const dev: Record<string, number[]> = { kcal: [], p: [], c: [], f: [], fib: [], sug: [], salt: [] };
const wk: Record<string, number[]> = { p: [], c: [], f: [], fib: [] };
let over = 0, costOver = 0, plans = 0, famSum = 0, famN = 0, lowFam = 0;
const seen: Record<string, number> = {};

for (let i = 0; i < N; i++) {
  const goal = pick(['slabire', 'mentinere', 'masa'] as const);
  const me: Member = {
    id: 'me', name: 'X', isMain: true, sex: pick(['m', 'f'] as const), birthYear: 1960 + Math.floor(rnd() * 45),
    heightCm: 155 + Math.floor(rnd() * 40), weightKg: 50 + Math.floor(rnd() * 60), activity: pick(['sedentar', 'usor', 'moderat', 'activ'] as const),
    goal, rateKg: 0.5, pregnancy: 'nu', medical: false, diet: pick(['omnivor', 'omnivor', 'omnivor', 'vegetarian', 'pescetarian'] as const),
    allergies: [], dislikes: [], kcalAdjust: 0,
  } as Member;
  const slots = pick(SLOTSETS);
  const settings: Settings = {
    equipment: ['plita', 'cuptor', 'microunde', 'blender'], slots, slotsAsked: true,
    cookingDays: pick([[6, 2], [6], [6, 2, 4], [0, 1, 2, 3, 4, 5, 6]]), maxPrepWeekday: 45, maxPrepWeekend: 120, recipesPerSession: 3,
    budgetRon: pick([200, 270, 350, 450]), fasting: 'niciunul', fishOnDispensation: true,
  } as Settings;
  const input: PlanInput = {
    startISO: '2026-11-16', members: [me], household: { memberIds: ['me'], guests: 0, applyFasting: false },
    settings, pantry: [], prices: {}, liked: [], disliked: [], previousRecipeIds: [], seed: Math.floor(rnd() * 1e9),
  };
  const plan = generatePlan(input);
  plans++;
  const tg = computeTargets(me, new Date('2026-11-16'));
  if (plan.cost > settings.budgetRon + 50) { costOver++; if (process.argv.includes('--worst')) console.log(`OVER ${Math.round(plan.cost)}/${settings.budgetRon} ${me.diet} ${tg.kcal}kcal ${slots.length} mese`); }
  const acc = { p: 0, c: 0, f: 0, fib: 0 };
  for (let d = 0; d < 7; d++) {
    const r: Row = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, sug: 0, salt: 0, tk: tg.kcal, tp: tg.protein, tc: tg.carbs, tf: tg.fat };
    for (const m of plan.meals.filter((x) => x.day === d)) {
      const rec = RECIPE[m.recipeId];
      for (const part of [{ recipeId: m.recipeId, shares: m.shares }, ...(m.sides ?? [])]) {
        const ps = perServing(RECIPE[part.recipeId]);
        const fct = part.shares.find((s) => s.memberId === 'me')?.factor ?? 0;
        r.kcal += ps.kcal * fct; r.p += ps.p * fct; r.c += ps.c * fct; r.f += ps.f * fct;
        r.fib += ps.fib * fct; r.sug += ps.sug * fct; r.salt += ps.salt * fct;
      }
      const fam = familiarity(rec);
      famSum += fam; famN++; if (fam < 0.5) lowFam++;
      seen[rec.id] = (seen[rec.id] ?? 0) + 1;
    }
    dev.kcal.push(r.kcal / tg.kcal - 1);
    dev.p.push(r.p / tg.protein - 1);
    dev.c.push(r.c / tg.carbs - 1);
    dev.f.push(r.f / tg.fat - 1);
    dev.fib.push(r.fib / tg.fiber - 1);
    dev.sug.push(r.sug);
    dev.salt.push(r.salt);
    if (r.kcal > tg.kcal * 1.05) over++;
    acc.p += r.p; acc.c += r.c; acc.f += r.f; acc.fib += r.fib;
  }
  if (process.argv.includes('--worst') && acc.p / 7 / tg.protein < 0.7) console.log(`LOW P ${Math.round(acc.p / 7)}/${tg.protein}g  ${me.sex} ${goal} ${me.diet} ${me.weightKg}kg ${tg.kcal}kcal ${slots.length} mese ${settings.budgetRon} lei → ${Math.round(plan.cost)} lei; mese: ${[...new Set(plan.meals.map((m) => RECIPE[m.recipeId].name))].slice(0, 8).join('; ')}`);
  wk.p.push(acc.p / 7 / tg.protein - 1); wk.c.push(acc.c / 7 / tg.carbs - 1); wk.f.push(acc.f / 7 / tg.fat - 1); wk.fib.push(acc.fib / 7 / tg.fiber - 1);
  if (NAMES && i < 6) {
    console.log(`\n# ${me.sex} ${goal} ${tg.kcal} kcal, P${tg.protein} C${tg.carbs} F${tg.fat}, ${slots.join('/')}, ${settings.budgetRon} lei → ${Math.round(plan.cost)} lei`);
    for (let d = 0; d < 3; d++) console.log('  ', plan.meals.filter((m) => m.day === d).map((m) => `${RECIPE[m.recipeId].name} ×${m.shares[0].factor}`).join(' | '));
  }
}
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
const pct = (x: number) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;
console.log(`\n${plans} planuri, ${dev.kcal.length} zile`);
for (const k of ['kcal', 'p', 'c', 'f', 'fib'] as const) {
  console.log(`${k.padEnd(5)} median ${pct(q(dev[k], 0.5))}  p10 ${pct(q(dev[k], 0.1))}  p90 ${pct(q(dev[k], 0.9))}  |abs|>20%: ${Math.round(100 * dev[k].filter((x) => Math.abs(x) > 0.2).length / dev[k].length)}%`);
}
for (const k of ['p', 'c', 'f', 'fib'] as const) console.log(`săpt ${k.padEnd(4)} median ${pct(q(wk[k], 0.5))}  p10 ${pct(q(wk[k], 0.1))}  p90 ${pct(q(wk[k], 0.9))}  |abs|>15%: ${Math.round(100 * wk[k].filter((x) => Math.abs(x) > 0.15).length / wk[k].length)}%`);
console.log(`zahăr g/zi median ${Math.round(q(dev.sug, 0.5))} p90 ${Math.round(q(dev.sug, 0.9))}; sare g/zi median ${q(dev.salt, 0.5).toFixed(1)} p90 ${q(dev.salt, 0.9).toFixed(1)}`);
console.log(`zile peste +5% kcal: ${over}; planuri peste buget+50: ${costOver}; familiaritate medie ${(famSum / famN).toFixed(2)}, mese cu rețete exotice: ${Math.round(100 * lowFam / famN)}%`);
const top = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([id, n]) => `${RECIPE[id].name} (${n})`);
console.log('cele mai dese:', top.join('; '));
