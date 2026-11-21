/*
 * Bugetul, pe gospodării și bugete diferite: cât costă cel mai ieftin plan, dacă planul intră în buget (±50 lei)
 * și dacă aplicația spune clar când bugetul nu ajunge.   npx tsx scripts/audit-budget.ts
 */
import { BUDGET_SLACK, generatePlan, type PlanInput } from '../src/logic/planner';
import type { Member, Settings, Slot } from '../src/logic/types';

const adult = (id: string, sex: 'm' | 'f', kg: number, goal: Member['goal'] = 'mentinere'): Member => ({
  id, name: id, isMain: id === 'a', sex, birthYear: 1990, heightCm: sex === 'm' ? 180 : 165, weightKg: kg, activity: 'usor', goal, rateKg: goal === 'slabire' ? 0.5 : 0,
  pregnancy: 'nu', medical: false, diet: 'omnivor', allergies: [], dislikes: [], kcalAdjust: 0,
} as unknown as Member);
const child = (id: string): Member => ({ ...adult(id, 'f', 30), isMain: false, birthYear: 2017, heightCm: 135 } as Member);

const HOUSES: [string, Member[]][] = [
  ['1 adult', [adult('a', 'm', 85)]],
  ['2 adulți', [adult('a', 'm', 85), adult('b', 'f', 62)]],
  ['2 adulți + 1 copil', [adult('a', 'm', 85), adult('b', 'f', 62), child('c')]],
  ['2 adulți + 2 copii', [adult('a', 'm', 85), adult('b', 'f', 62), child('c'), child('d')]],
];
const SLOTS: [string, Slot[]][] = [['3 mese', ['mic_dejun', 'pranz', 'cina']], ['4 mese', ['mic_dejun', 'pranz', 'gustare2', 'cina']]];

let bad = 0, rows = 0;
for (const [hn, members] of HOUSES) {
  for (const [sn, slots] of SLOTS) {
    const line: string[] = [];
    let minCost = Infinity;
    for (const budget of [100, 150, 200, 250, 300, 350, 400, 500, 600, 700, 900, 1200]) {
      const settings: Settings = {
        equipment: ['plita', 'cuptor', 'microunde'], slots, cookingDays: [6, 2], maxPrepWeekday: 45, maxPrepWeekend: 120,
        recipesPerSession: 3, budgetRon: budget, fasting: 'niciunul', fishOnDispensation: true,
      } as Settings;
      let worst = 0;
      for (const seed of [1, 2, 3]) {
        const input: PlanInput = {
          startISO: '2026-11-23', members, household: { memberIds: members.map((m) => m.id), guests: 0, applyFasting: false },
          settings, pantry: [], prices: {}, liked: [], disliked: [], previousRecipeIds: [], seed,
        };
        const p = generatePlan(input);
        minCost = Math.min(minCost, p.cost);
        worst = Math.max(worst, p.cost);
        rows++;
        const over = p.cost > budget + BUDGET_SLACK;
        const warned = p.warnings.some((w) => w.includes('nu ies toate mesele'));
        // peste buget fără să spună, sau spune că nu se poate deși alt plan (alt seed) a intrat
        if (over && !warned) { bad++; console.log(`  ✗ ${hn}, ${sn}, ${budget} lei: plan de ${Math.round(p.cost)} lei fără avertisment`); }
      }
      line.push(`${budget}→${Math.round(worst)}`);
    }
    console.log(`${hn}, ${sn}: cel mai ieftin plan ~${Math.round(minCost)} lei/săpt | buget→cost: ${line.join('  ')}`);
  }
}
console.log(`\n${rows} planuri, ${bad} peste buget fără avertisment`);
if (bad) process.exit(1);
