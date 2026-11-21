/// <reference types="node" />
/* Teste rapide pentru logica aplicației: npm test */
import assert from 'node:assert/strict';
import { INGREDIENTS, ING } from '../src/data/ingredients';
import { RECIPES, RECIPE } from '../src/data/recipes';
import fs from 'node:fs';
import { toISO } from '../src/logic/dates';
import { computeTargets } from '../src/logic/energy';
import { fastInfo, orthodoxEaster } from '../src/logic/fasting';
import { fastAllows, perServing, recipeAllergens, recipeDiet } from '../src/logic/nutrition';
import { addToPantry, consumeFromPantry, recipesFromPantry } from '../src/logic/pantry';
import { generatePlan, replaceSessionRecipe, alternativesFor, replaceSingleMeal, refitPlan, type PlanInput } from '../src/logic/planner';
import type { Member, Settings } from '../src/logic/types';

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log('✓', name); };

t('integritate date', () => {
  for (const r of RECIPES) for (const [id] of r.ing) assert.ok(ING[id], `${r.id}: ingredient lipsă ${id}`);
  const ids = new Set(RECIPES.map((r) => r.id));
  assert.equal(ids.size, RECIPES.length, 'id-uri duplicate');
  assert.equal(new Set(INGREDIENTS.map((i) => i.id)).size, INGREDIENTS.length);
  for (const r of RECIPES) {
    const k = perServing(r).kcal;
    assert.ok(k > 60 && k < 1100, `${r.id}: ${k} kcal/porție`);
  }
});

t('poze reale doar unde există, fără imagini generate', () => {
  const photos = fs.readFileSync('src/data/photos.ts', 'utf8') + fs.readFileSync('src/data/photos_import.ts', 'utf8') + fs.readFileSync('src/data/photos_ro.ts', 'utf8') + fs.readFileSync('src/data/photos_extra.ts', 'utf8');
  for (const r of RECIPES) {
    const has = fs.existsSync(`assets/food/r/${r.id}.jpg`) || fs.existsSync(`assets/food/r/${r.id}.webp`);
    // o rețetă are poză doar dacă e o fotografie reală a felului
    assert.equal(has, !!r.img, `${r.id}: ${has ? 'are o imagine generată' : 'îi lipsește poza reală'}`);
    if (has) assert.ok(photos.includes(`"${r.id}": require('../../assets/food/r/${r.id}.`), `poză neînregistrată: ${r.id}`);
    assert.ok(r.en && r.cuisine, `${r.id}: lipsește numele în engleză sau bucătăria`);
  }
  assert.ok(!fs.existsSync('assets/food/i'), 'decupajele de ingrediente nu se mai folosesc');
  const withPhoto = RECIPES.filter((r) => r.img).length;
  assert.ok(RECIPES.length >= 800 && withPhoto >= 750, `${RECIPES.length} rețete, ${withPhoto} cu poză`);
  console.log(`   ${RECIPES.length} rețete, ${withPhoto} cu poză reală`);
});

t('rețetele de pe site-uri românești: sursă, pași proprii, video valid', () => {
  const ro = RECIPES.filter((r) => r.source);
  assert.ok(ro.length >= 300, `doar ${ro.length} rețete românești`);
  for (const r of ro) {
    assert.ok(/^https:\/\/(www\.)?(lauralaurentiu|e-retete)\.ro\//.test(r.source!.url), `${r.id}: sursă necunoscută ${r.source!.url}`);
    assert.ok(r.steps.length >= 2 && r.steps.every((s) => s.length < 220), `${r.id}: pașii lipsesc sau sunt prea lungi`);
    if (r.video) assert.match(r.video, /^[\w-]{11}$/, `${r.id}: id video greșit`);
    if (r.img) assert.ok(r.credit && /CC|domeniu public/.test(r.credit), `${r.id}: poza fără licență`);
    const k = perServing(r).kcal;
    assert.ok(k > 40 && k < 1100, `${r.id}: ${Math.round(k)} kcal pe porție`);
  }
  console.log(`   ${ro.length} rețete românești, ${ro.filter((r) => r.video).length} cu video, ${ro.filter((r) => r.img).length} cu poză liberă`);
});

t('Paște ortodox', () => {
  assert.equal(toISO(orthodoxEaster(2026)), '2026-04-12');
  assert.equal(toISO(orthodoxEaster(2025)), '2025-04-20');
  assert.equal(toISO(orthodoxEaster(2027)), '2027-05-02');
  assert.equal(toISO(orthodoxEaster(2024)), '2024-05-05');
});

t('calendar post', () => {
  const d = (s: string) => new Date(s + 'T12:00:00');
  assert.equal(fastInfo(d('2026-11-14'), 'toate').level, 'none'); // sâmbătă înainte de post
  assert.equal(fastInfo(d('2026-11-16'), 'toate').level, 'strict'); // luni în Postul Crăciunului
  assert.equal(fastInfo(d('2026-11-21'), 'toate').level, 'fish_ok'); // Intrarea în Biserică
  assert.equal(fastInfo(d('2026-11-22'), 'toate').level, 'fish_ok'); // duminică
  assert.equal(fastInfo(d('2026-12-20'), 'toate').level, 'strict'); // după 19 dec
  assert.equal(fastInfo(d('2026-12-30'), 'toate').level, 'none'); // harți (miercuri)
  assert.equal(fastInfo(d('2026-11-11'), 'miercuri_vineri').level, 'strict'); // miercuri
  assert.equal(fastInfo(d('2026-11-11'), 'posturile_mari').level, 'none');
  assert.equal(fastInfo(d('2026-04-15'), 'toate').level, 'none'); // Săptămâna Luminată
  assert.equal(fastInfo(d('2026-04-05'), 'toate').level, 'fish_ok'); // Florii 2026
  assert.equal(fastInfo(d('2026-03-25'), 'toate').level, 'fish_ok'); // Buna Vestire
  assert.equal(fastInfo(d('2026-11-21'), 'toate', false).level, 'strict');
});

t('compatibilitate rețete post/dietă', () => {
  const r = RECIPES.find((x) => x.id === 'iahnie_fasole')!;
  assert.equal(recipeDiet(r), 'vegan');
  assert.ok(fastAllows('strict', r));
  const s = RECIPES.find((x) => x.id === 'somon_rosii_lamaie')!;
  assert.ok(!fastAllows('strict', s) && fastAllows('fish_ok', s));
  assert.ok(recipeAllergens(RECIPES.find((x) => x.id === 'spaghete_bolognese')!).includes('gluten'));
});

const me: Member = {
  id: 'me', name: 'Cosmin', isMain: true, sex: 'm', birthYear: 2004, heightCm: 182, weightKg: 85, activity: 'moderat',
  goal: 'slabire', rateKg: 0.5, pregnancy: 'nu', medical: false, diet: 'omnivor', allergies: [], dislikes: [], kcalAdjust: 0,
};
const partner: Member = { ...me, id: 'p', name: 'Partener', isMain: false, sex: 'f', heightCm: 165, weightKg: 58, goal: 'mentinere', activity: 'usor' };
const kid: Member = { ...me, id: 'k', name: 'Copil', isMain: false, birthYear: 2018, heightCm: 130, weightKg: 27, goal: 'mentinere', allergies: ['nuci'] };

t('necesar caloric', () => {
  const tg = computeTargets(me, new Date('2026-11-11'));
  // BMR = 850 + 1137.5 - 110 + 5 = 1882.5 ; TDEE = 2917.9 ; -550
  assert.equal(tg.bmr, 1883);
  assert.equal(tg.kcal, 2370);
  const k = computeTargets(kid, new Date('2026-11-11'));
  assert.ok(k.isChild && k.kcal > 1500 && k.kcal < 2200, `copil ${k.kcal}`);
  const lowF = computeTargets({ ...partner, goal: 'slabire', rateKg: 1, weightKg: 50, heightCm: 168, activity: 'sedentar' }, new Date('2026-11-11'));
  assert.equal(lowF.goal, 'mentinere'); // IMC 17.7 → blocat
  const preg = computeTargets({ ...partner, goal: 'slabire', pregnancy: 't3' }, new Date('2026-11-11'));
  assert.equal(preg.goal, 'mentinere');
});

const settings: Settings = {
  equipment: ['plita', 'cuptor', 'microunde', 'blender'], slots: ['mic_dejun', 'pranz', 'gustare2', 'cina'],
  cookingDays: [6, 2], maxPrepWeekday: 45, maxPrepWeekend: 120, recipesPerSession: 3, budgetRon: 450,
  fasting: 'toate', fishOnDispensation: true,
};
const base: PlanInput = {
  startISO: '2026-11-15', members: [me, partner, kid], household: { memberIds: ['me', 'p'], guests: 0, applyFasting: true },
  settings, pantry: [], prices: {}, liked: [], disliked: [], previousRecipeIds: [], seed: 42,
};

function checkPlan(name: string, input: PlanInput) {
  const p = generatePlan(input);
  const slots = input.settings.slots.length * 7;
  assert.equal(p.meals.length, slots, `${name}: ${p.meals.length}/${slots} mese`);
  for (const m of p.meals) {
    const r = RECIPES.find((x) => x.id === m.recipeId)!;
    assert.ok(fastAllows(p.fastDays[m.day], r), `${name}: ${r.id} încalcă postul în ziua ${m.day}`);
    const s = p.sessions.find((x) => x.id === m.sessionId)!;
    assert.ok(m.day >= s.day, `${name}: mâncat înainte de gătit`);
    assert.ok(m.day - s.day <= r.keepsDays || m.frozen, `${name}: ${r.id} ținut ${m.day - s.day} zile (max ${r.keepsDays})`);
    assert.ok(input.settings.equipment.length === 0 || r.equipment.every((g) => g.some((e) => input.settings.equipment.includes(e))), `${name}: echipament`);
  }
  for (const s of p.sessions) assert.ok(Number.isInteger(s.portions) && s.portions >= (s.eat ?? 0) - 0.2, `${name}: porții negătibile ${s.portions}`);
  for (const m of p.meals) for (const sh of m.shares) assert.ok(Number.isInteger(sh.factor * 4), `${name}: porție ${sh.factor}`);
  for (const it of p.shopping) assert.ok(it.packages * ING[it.ingId].pkg >= it.buyG - 0.5, `${name}: ambalaj insuficient ${it.ingId}`);
  console.log(`   ${name}: ${p.sessions.length} gătiri, ${p.shopping.length} produse, ${Math.round(p.cost)} lei, ${p.warnings.length} avertismente`);
  return p;
}

let plan = generatePlan(base);
t('plan cuplu, gătit duminică+miercuri, Postul Crăciunului', () => { plan = checkPlan('cuplu+post', base); });
t('plan familie cu copil alergic la nuci', () => {
  const p = checkPlan('familie', { ...base, household: { memberIds: ['me', 'p', 'k'], guests: 0, applyFasting: false } });
  for (const m of p.meals) assert.ok(!recipeAllergens(RECIPES.find((r) => r.id === m.recipeId)!).includes('nuci'));
});
t('singur, gătit o dată pe săptămână', () => {
  checkPlan('singur 1 zi', { ...base, household: { memberIds: ['me'], guests: 0, applyFasting: false }, settings: { ...settings, cookingDays: [6] } });
});
t('vegan, 5 mese pe zi, gătit zilnic', () => {
  checkPlan('vegan', {
    ...base, members: [{ ...me, diet: 'vegan' }], household: { memberIds: ['me'], guests: 0, applyFasting: false },
    settings: { ...settings, equipment: ['plita', 'microunde'], slots: ['mic_dejun', 'gustare1', 'pranz', 'gustare2', 'cina'], cookingDays: [0, 1, 2, 3, 4, 5, 6] },
  });
});
t('doar microunde: nu se blochează, spune ce lipsește', () => {
  const p = generatePlan({ ...base, household: { memberIds: ['me'], guests: 0, applyFasting: false }, settings: { ...settings, equipment: ['microunde'] } });
  assert.ok(p.meals.length > 0 && p.warnings.length > 0);
});
t('buget mic → plan mai ieftin', () => {
  const cheap = generatePlan({ ...base, settings: { ...settings, budgetRon: 150 } });
  const rich = generatePlan({ ...base, settings: { ...settings, budgetRon: 2000 } });
  assert.ok(cheap.cost <= rich.cost + 1, `${cheap.cost} vs ${rich.cost}`);
  console.log(`   buget 150 → ${Math.round(cheap.cost)} lei, buget 2000 → ${Math.round(rich.cost)} lei`);
});
t('cămara reduce lista și e preferată', () => {
  let pantry = addToPantry([], 'cartofi', 2000, new Date('2026-11-14'));
  pantry = addToPantry(pantry, 'ciuperci', 500, new Date('2026-11-13'));
  const p = generatePlan({ ...base, pantry });
  const cart = p.shopping.find((s) => s.ingId === 'cartofi');
  if (cart) assert.ok(cart.fromPantryG > 0);
  const recs = recipesFromPantry(pantry, RECIPES, '2026-11-15');
  assert.ok(recs.length > 0 && recs[0].recipe.ing.some(([id]) => id === 'cartofi' || id === 'ciuperci'));
  const after = consumeFromPantry(pantry, 'cartofi', 1500);
  assert.equal(after.find((x) => x.ingId === 'cartofi')!.g, 500);
});
t('înlocuire rețetă și alternative', () => {
  const s = plan.sessions.find((x) => plan.meals.some((m) => m.sessionId === x.id && m.slot === 'pranz'))!;
  const alts = alternativesFor(plan, { sessionId: s.id }, base);
  assert.ok(alts.length > 0);
  const p2 = replaceSessionRecipe(plan, s.id, alts[0].id, base);
  assert.ok(p2.meals.filter((m) => m.sessionId === s.id).every((m) => m.recipeId === alts[0].id));
  const m = plan.meals.find((x) => x.slot === 'cina')!;
  const key = `${m.day}|${m.slot}`;
  const alts2 = alternativesFor(plan, { key }, base);
  const p3 = replaceSingleMeal(plan, key, alts2[0].id, base);
  assert.equal(p3.meals.find((x) => `${x.day}|${x.slot}` === key)!.recipeId, alts2[0].id);
  assert.equal(p3.meals.length, plan.meals.length);
});

// ── Varietate, preferințe, magazine ──
import { mergeRestrictions, proteinKind, recipeFits } from '../src/logic/nutrition';
import { BUDGET_SLACK, mainsNeeded, swipeDeck } from '../src/logic/planner';
import { compareStores, detectStore, priceAt } from '../src/logic/stores';
import { receiptTotal } from '../src/logic/receiptParser';
import { macrosFor, searchFoods, foodFromRef, recentFoods, slotForHour } from '../src/logic/foods';
import { weekRecap } from '../src/logic/recap';

const noFast: PlanInput = { ...base, household: { memberIds: ['me', 'p'], guests: 0, applyFasting: false }, settings: { ...settings, fasting: 'niciunul' } };

t('schimbi ce mănânci: planul se reface singur de azi înainte, ce ai mâncat rămâne', () => {
  for (const seed of [11, 12, 13]) {
    const p0 = generatePlan({ ...noFast, seed });
    // ziua 2: ai mâncat deja mesele zilelor 0–1; acum „nu mai mănânc” ingredientul principal al unui fel de joi
    const target = p0.meals.find((m) => m.day >= 3 && ['pranz', 'cina'].includes(m.slot))!;
    const main = RECIPE[target.recipeId].ing.filter(([id]) => !ING[id]?.staple).sort((a, b) => b[1] - a[1])[0][0];
    const eaten = p0.meals.filter((m) => m.day < 2).map((m) => `${m.day}|${m.slot}`);
    const plan = { ...p0, eaten };
    const input: PlanInput = { ...noFast, seed, members: noFast.members.map((m) => (m.id === 'me' ? { ...m, dislikes: [main] } : m)) };
    const { plan: p1, changed } = refitPlan(plan, input, 2);
    assert.ok(changed > 0, 'nu s-a schimbat nimic');
    const rs = mergeRestrictions(input.members.filter((m) => ['me', 'p'].includes(m.id)));
    for (const m of p1.meals) {
      const before = p0.meals.find((x) => x.day === m.day && x.slot === m.slot)!;
      if (m.day < 2) assert.equal(m.recipeId, before.recipeId, 's-a schimbat o masă deja mâncată');
      else for (const id of [m.recipeId, ...(m.sides ?? []).map((x) => x.recipeId)]) assert.ok(recipeFits(RECIPE[id], rs), `${RECIPE[id].name} conține ${main}`);
    }
    assert.ok(p1.shopping.every((x) => x.ingId !== main || p1.meals.some((m) => m.day < 2 && [m.recipeId, ...(m.sides ?? []).map((y) => y.recipeId)].some((id) => RECIPE[id].ing.some(([i]) => i === main)))), `${main} a rămas pe listă`);
  }
});

t('pornești postul: zilele rămase devin de post și mesele lor se schimbă', () => {
  const p0 = generatePlan({ ...base, household: { ...base.household, applyFasting: true }, settings: { ...settings, fasting: 'niciunul' }, seed: 21 });
  assert.ok(p0.fastDays.every((x) => x === 'none'));
  const input: PlanInput = { ...base, household: { ...base.household, applyFasting: true }, settings: { ...settings, fasting: 'miercuri_vineri' }, seed: 21 };
  const { plan: p1 } = refitPlan(p0, input, 0);
  assert.ok(p1.fastDays.some((x) => x !== 'none'), 'zilele de post nu s-au recalculat');
  for (const m of p1.meals) for (const id of [m.recipeId, ...(m.sides ?? []).map((x) => x.recipeId)]) assert.ok(fastAllows(p1.fastDays[m.day], RECIPE[id]), `${RECIPE[id].name} în zi de post`);
});

t('2 mese pe zi: mic dejun + cină înseamnă mic dejun adevărat, nu încă un fel greu', () => {
  for (const slots of [['mic_dejun', 'cina'], ['mic_dejun', 'pranz']] as const) {
    const p = generatePlan({ ...noFast, settings: { ...noFast.settings, slots: [...slots] }, seed: 5 });
    const md = p.meals.filter((m) => m.slot === 'mic_dejun');
    assert.equal(md.length, 7);
    for (const m of md) assert.ok(RECIPE[m.recipeId].meal.includes('mic_dejun'), `${RECIPE[m.recipeId].name} la micul dejun`);
    assert.ok(p.meals.every((m) => (slots as readonly string[]).includes(m.slot)));
  }
});

t('4 săptămâni la rând: același fel principal nu revine în săptămâna imediat următoare', () => {
  const history: Record<string, number> = {};
  const weeks: Set<string>[] = [];
  for (let w = 0; w < 4; w++) {
    const start = toISO(new Date(Date.UTC(2026, 10, 16 + 7 * w)));
    const p = generatePlan({ ...noFast, startISO: start, history: { ...history }, seed: 100 + w });
    const mains = new Set(p.meals.filter((m) => ['pranz', 'cina'].includes(m.slot)).map((m) => m.recipeId));
    weeks.push(mains);
    for (const k of Object.keys(history)) history[k] += 1;
    for (const id of mains) history[id] = 1;
  }
  for (let w = 1; w < 4; w++) {
    const again = [...weeks[w]].filter((id) => weeks[w - 1].has(id));
    assert.ok(again.length <= 1, `săptămâna ${w + 1} repetă: ${again.map((id) => RECIPE[id].name).join(', ')}`);
  }
});

t('„nu mănânc cârnați”: scoate cârnații și atât (crenvurștii, salamul, mititeii rămân)', () => {
  const noCarnati: PlanInput = { ...noFast, members: noFast.members.map((m) => (m.id === 'me' ? { ...m, dislikes: ['carnati'] } : m)) };
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const p = generatePlan({ ...noCarnati, seed });
    for (const m of p.meals) {
      for (const id of [m.recipeId, ...(m.sides ?? []).map((x) => x.recipeId)]) {
        const r = RECIPE[id];
        assert.ok(!r.ing.some(([i]) => ['carnati', 'carnati_proaspeti'].includes(i)), `${r.name} are cârnați`);
        assert.ok(!/c[âa]rna[țt]/i.test(r.name), `${r.name}`);
      }
    }
  }
  const rs = mergeRestrictions(noCarnati.members);
  const kept = RECIPES.filter((r) => !r.ing.some(([i]) => i === 'carnati' || i === 'carnati_proaspeti') && (r.ing.some(([i]) => i === 'crenvursti') || /\b(mici|mititei|salam)\b/i.test(r.name)));
  assert.ok(kept.length > 0);
  for (const r of kept) assert.ok(recipeFits(r, rs), `${r.name} a fost scoasă deși nu are cârnați`);
});


t('„ce nu mănânci”: fără pește și fără porc în plan', () => {
  const picky = { ...me, avoid: ['peste', 'fructe_mare', 'porc'] as Member['avoid'] };
  const p = generatePlan({ ...noFast, members: [picky, partner], household: { memberIds: ['me', 'p'], guests: 0, applyFasting: false } });
  for (const m of p.meals) {
    const r = RECIPE[m.recipeId];
    assert.ok(!r.ing.some(([id]) => ['peste', 'fructe_mare', 'porc'].includes(ING[id]?.meat ?? '')), `${r.id} conține ce nu mănânci`);
  }
  assert.ok(!recipeFits(RECIPE.somon_teriyaki, mergeRestrictions([picky])));
  assert.ok(recipeFits(RECIPE.pui_kung_pao, mergeRestrictions([picky])));
});

t('varietate: multe feluri diferite, nu de două ori în aceeași zi, nu aceeași carne la rând', () => {
  const p = generatePlan(noFast);
  const mains = p.meals.filter((m) => m.slot === 'pranz' || m.slot === 'cina').sort((a, b) => a.day - b.day || (a.slot === 'pranz' ? -1 : 1));
  const distinct = new Set(mains.map((m) => m.recipeId)).size;
  assert.ok(distinct >= 5, `doar ${distinct} feluri principale`);
  for (let d = 0; d < 7; d++) {
    const ids = mains.filter((m) => m.day === d).map((m) => m.recipeId);
    assert.equal(new Set(ids).size, ids.length, `ziua ${d}: același fel la prânz și cină`);
  }
  const counts: Record<string, number> = {};
  for (const m of mains) counts[m.recipeId] = (counts[m.recipeId] ?? 0) + 1;
  assert.ok(Math.max(...Object.values(counts)) <= 3, 'un fel apare de mai mult de 3 ori');
  const kinds = mains.map((m) => proteinKind(RECIPE[m.recipeId]));
  const meat = kinds.filter((k) => ['pui', 'porc', 'vita', 'curcan', 'miel', 'organe'].includes(k)).length;
  assert.ok(meat >= mains.length * 0.5, `prea puțină carne pentru cineva care nu ține post: ${meat}/${mains.length}`);
  const mare = generatePlan({ ...noFast, settings: { ...noFast.settings, variety: 'mare' } });
  const dm = new Set(mare.meals.filter((m) => m.slot === 'pranz' || m.slot === 'cina').map((m) => m.recipeId)).size;
  assert.ok(dm >= distinct, `„cât mai variat” (${dm}) nu e mai variat decât „echilibrat” (${distinct})`);
  console.log(`   ${distinct} feluri (echilibrat), ${dm} (cât mai variat), carne la ${meat}/${mains.length} mese`);
});

t('de la o săptămână la alta nu se repetă', () => {
  const w1 = generatePlan({ ...noFast, seed: 1 });
  const history: Record<string, number> = {};
  for (const m of w1.meals) history[m.recipeId] = 1;
  const w2 = generatePlan({ ...noFast, startISO: '2026-11-22', seed: 2, history });
  const m1 = new Set(w1.meals.filter((m) => m.slot === 'pranz' || m.slot === 'cina').map((m) => m.recipeId));
  const m2 = new Set(w2.meals.filter((m) => m.slot === 'pranz' || m.slot === 'cina').map((m) => m.recipeId));
  const same = [...m2].filter((id) => m1.has(id)).length;
  assert.ok(same <= 1, `${same} feluri principale repetate din săptămâna trecută`);
  const again = generatePlan({ ...noFast, seed: 99 });
  const m3 = new Set(again.meals.filter((m) => m.slot === 'pranz' || m.slot === 'cina').map((m) => m.recipeId));
  assert.ok([...m3].filter((id) => m1.has(id)).length < m1.size, '„Alt plan” dă exact același plan');
});

t('magazine: indice, prețuri de pe bon, comparație', () => {
  assert.ok(priceAt('lapte', 'lidl', {}) < priceAt('lapte', 'mega', {}));
  assert.equal(priceAt('lapte', 'lidl', {}, { lidl: { lapte: 6.49 } }), 6.49);
  const items = [{ ingId: 'lapte', packages: 2 }, { ingId: 'pui_piept', packages: 1 }];
  const cmp = compareStores(items, ['mega', 'lidl', 'kaufland'], {}, {});
  assert.equal(cmp[0].store, 'lidl');
  assert.equal(detectStore('LIDL DISCOUNT SRL\nCIF RO...'), 'lidl');
  assert.equal(detectStore('MEGA IMAGE SRL'), 'mega');
  assert.equal(receiptTotal(['SUBTOTAL 60,00', 'TOTAL   61,69', 'CARD 61,69']), 61.69);
  const p = generatePlan({ ...noFast, store: 'mega' });
  const p2 = generatePlan({ ...noFast, store: 'lidl' });
  assert.equal(p.store, 'mega');
  assert.ok(p.cost > 0 && p2.cost > 0);
});

t('jurnal: căutare, cantități, recente, masa după oră', () => {
  const res = searchFoods('sarmale');
  assert.ok(res.some((f) => f.recipeId === 'sarmale'));
  const ou = foodFromRef('i:oua')!;
  assert.equal(ou.amount, 50);
  assert.equal(Math.round(macrosFor(ou, 100).kcal), 143);
  const rec = recentFoods([{ id: '1', dateISO: '2026-11-10', label: 'x', kcal: 1, p: 0, c: 0, f: 0, ref: 'i:oua', g: 100 }, { id: '2', dateISO: '2026-11-11', label: 'y', kcal: 1, p: 0, c: 0, f: 0, ref: 'r:sarmale', g: 1 }]);
  assert.equal(rec[0].item.ref, 'r:sarmale'); assert.equal(rec[1].amount, 100);
  assert.equal(slotForHour(8, ['mic_dejun', 'pranz', 'cina']), 'mic_dejun');
  assert.equal(slotForHour(20, ['mic_dejun', 'pranz', 'cina']), 'cina');
});

t('rezumatul săptămânii', () => {
  const p = generatePlan(noFast);
  const plan2 = { ...p, eaten: ['me|0|pranz', 'me|1|cina'] };
  const r = weekRecap('2026-11-16', [
    { id: 'a', dateISO: '2026-11-16', label: 'x', kcal: 2000, p: 120, c: 0, f: 0 },
    { id: 'b', dateISO: '2026-11-17', label: 'y', kcal: 2200, p: 100, c: 0, f: 0 },
  ], [plan2], [{ id: 's', dateISO: '2026-11-18', store: 'lidl', amount: 250, source: 'bon' }], [{ dateISO: '2026-11-15', kg: 85 }, { dateISO: '2026-11-21', kg: 84.4 }], {});
  assert.equal(r.daysLogged, 2); assert.equal(Math.round(r.avgKcal), 2100); assert.equal(r.spent, 250); assert.equal(r.weightDelta, -0.6);
});

t('necesar: job + sport + procent de grăsime', () => {
  const desk = computeTargets({ ...me, job: 'birou', trainDays: 0 }, new Date('2026-11-11'));
  const gym = computeTargets({ ...me, job: 'birou', trainDays: 4, trainMin: 60, trainType: 'forta' }, new Date('2026-11-11'));
  const phys = computeTargets({ ...me, job: 'fizic', trainDays: 0 }, new Date('2026-11-11'));
  assert.ok(desk.tdee < gym.tdee && gym.tdee < phys.tdee + 300, `${desk.tdee} ${gym.tdee} ${phys.tdee}`);
  // 4 × 60 min forță × 85 kg × 4 MET net / 7 ≈ 194 kcal/zi
  assert.ok(Math.abs(gym.tdee - desk.tdee - 194) < 15);
  const lean = computeTargets({ ...me, bodyFat: 15 }, new Date('2026-11-11'));
  assert.equal(lean.method, 'Katch-McArdle (cu % grăsime)');
  assert.equal(lean.bmr, Math.round(370 + 21.6 * 85 * 0.85));
  const hp = computeTargets({ ...me, highProtein: true }, new Date('2026-11-11'));
  assert.ok(hp.protein > computeTargets(me, new Date('2026-11-11')).protein);
});

t('swipe: pachet variat, alegerile intră în plan, respinsele nu', () => {
  const deck = swipeDeck(noFast, 30);
  assert.ok(deck.length >= 20, `doar ${deck.length} cărți`);
  assert.ok(deck.every((r) => r.meal.includes('principal') && !r.tags?.includes('desert')));
  const kinds = new Set(deck.slice(0, 10).map((r) => proteinKind(r)));
  assert.ok(kinds.size >= 4, `primele 10 cărți au doar ${kinds.size} feluri de proteină`);
  const need = mainsNeeded(noFast);
  assert.ok(need >= 3 && need <= 14, `need ${need}`);
  const wanted = deck.slice(0, 4).map((r) => r.id);
  const skipped = deck.slice(4, 8).map((r) => r.id);
  const p = generatePlan({ ...noFast, wanted, skipped });
  const ids = new Set(p.meals.map((m) => m.recipeId));
  for (const id of wanted) assert.ok(ids.has(id), `${id} ales dar lipsește din plan`);
  for (const id of skipped) assert.ok(!ids.has(id), `${id} respins dar e în plan`);
  const picky = swipeDeck({ ...noFast, members: [{ ...me, avoid: ['peste', 'fructe_mare'] as Member['avoid'] }, partner] }, 40);
  assert.ok(!picky.some((r) => ['peste', 'fructe_mare'].includes(proteinKind(r))));
  console.log(`   ${deck.length} cărți, ${need} feluri necesare, primele: ${deck.slice(0, 5).map((r) => r.id).join(', ')}`);
});

t('bugetul e o limită: planul nu trece cu mai mult de 50 lei', () => {
  const solo = { ...noFast, members: [me], household: { memberIds: ['me'], guests: 0, applyFasting: false } };
  const out: string[] = [];
  for (const budget of [220, 250, 300, 400]) {
    for (const seed of [1, 2, 3]) {
      const p = generatePlan({ ...solo, seed, settings: { ...solo.settings, budgetRon: budget } });
      assert.ok(p.cost <= budget + BUDGET_SLACK, `buget ${budget}, seed ${seed}: ${Math.round(p.cost)} lei`);
      if (seed === 1) out.push(`${budget}→${Math.round(p.cost)}`);
    }
  }
  // ingredientele de bază (ulei, orez, făină…) nu intră automat pe listă
  const p = generatePlan(solo);
  assert.ok(!p.shopping.some((x) => ING[x.ingId].basic), 'ingredient de bază pe listă');
  console.log(`   buget→cost: ${out.join(', ')}`);
});

t('fără ore: „Ieri: ai mâncat ce era în plan?” notează tot, doar prima masă sau nimic', () => {
  // stocarea aplicației în Node: un localStorage în memorie
  const mem: Record<string, string> = {};
  (globalThis as Record<string, unknown>).window = { localStorage: { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } } };
  const { useStore } = require('../src/store/useStore');
  const { mealLabel } = require('../src/logic/planner');
  const st = useStore.getState();
  st.resetAll?.();
  useStore.setState({ members: [{ ...me, isMain: true }], onboarded: true, settings: { ...settings, fasting: 'niciunul', slots: ['pranz', 'cina'] } });
  assert.equal(mealLabel('pranz'), 'Prima masă');
  assert.equal(mealLabel('cina'), 'A doua masă');
  const plan = useStore.getState().generate('2026-11-16', { memberIds: ['me'], guests: 0, applyFasting: false }, 3);
  useStore.setState({ plans: { [plan.id]: { ...useStore.getState().plans[plan.id], createdAt: '2026-11-15T20:00:00' } } });
  const s2 = useStore.getState();
  assert.equal(s2.pendingMeals('2026-11-16').length, 2);
  s2.confirmDay('2026-11-16', 'all');
  assert.equal(useStore.getState().pendingMeals('2026-11-16').length, 0);
  assert.equal(useStore.getState().foodLog.filter((f: { dateISO: string }) => f.dateISO === '2026-11-16').length, 2);
  useStore.getState().confirmDay('2026-11-17', 'first');
  const p1 = useStore.getState().plans[plan.id];
  assert.ok(p1.eaten.some((k: string) => k.endsWith('|1|pranz')));
  assert.ok(p1.skipped.some((k: string) => k.endsWith('|1|cina')));
  // ziua dinainte de plan nu se întreabă
  assert.equal(useStore.getState().pendingMeals('2026-11-14').length, 0);
  // porția aleasă la adăugare (1½ în loc de cât era în plan) ajunge în jurnal
  const m = useStore.getState().plans[plan.id].meals.find((x: { day: number; slot: string }) => x.day === 2 && x.slot === 'pranz');
  useStore.getState().toggleEaten(plan.id, 2, 'pranz', false, 1.5);
  const e = useStore.getState().foodLog.find((f: { mealKey?: string }) => f.mealKey?.endsWith('|2|pranz'));
  // felul principal la porția aleasă, iar garniturile (ciorbă, pâine) în aceeași proporție
  const { mealMacros } = require('../src/logic/planner');
  const mainId = useStore.getState().members.find((x: { isMain: boolean }) => x.isMain).id;
  assert.ok(Math.abs(e.kcal - mealMacros(m, mainId, 1.5).kcal) < 1);
});

t('scrii normal ce ai mâncat: „o shaorma mare și un ayran”', () => {
  const { parseMealText } = require('../src/logic/freeText');
  const a = parseMealText('o shaorma mare și un ayran');
  assert.deepEqual(a.map((x: { item: { ref: string } }) => x.item.ref), ['g:g_shaorma', 'g:g_ayran']);
  assert.ok(Math.abs(a[0].amount - 1.4) < 0.01);
  const b = parseMealText('2 covrigi, o cafea cu lapte');
  assert.deepEqual(b.map((x: { item: { ref: string } }) => x.item.ref), ['g:g_covrig', 'g:g_cafea_lapte']);
  assert.equal(b[0].amount, 2);
  const c = parseMealText('3 mici și o bere');
  assert.ok(c[0].kcal < 500, '3 mici nu sunt trei porții');
});

t('prețuri de azi: cântărește produsul din nume și le folosește înaintea estimărilor', () => {
  const { gramsOf } = require('../src/logic/livePrices');
  const { setLivePrices } = require('../src/logic/stores');
  assert.equal(gramsOf('AGRICOLA PIEPT PUI DEZOSAT ATM650GR', 'BUC'), 650);
  assert.equal(gramsOf('BUC_Piept de pui dezosat', 'ca. 1 kg'), 1000);
  assert.equal(gramsOf('IAURT 4X125G', ''), 500);
  assert.equal(gramsOf('OUA M 10 BUC', 'BUC', 'buc', 55), 550);
  setLivePrices({ lidl: { pui_piept: 31.5 }, kaufland: { pui_piept: 38.9 } });
  assert.equal(priceAt('pui_piept', 'lidl', {}), 31.5);
  assert.ok(Math.abs(priceAt('pui_piept', 'mega', {}) - 0.5 * (31.5 / 0.95 + 38.9 / 1.0) * 1.1) < 0.01);
  assert.equal(priceAt('pui_piept', 'lidl', {}, { lidl: { pui_piept: 29 } }), 29, 'bonul tău are prioritate');
  setLivePrices(undefined);
});

t('planul pe bucătării: majoritatea felurilor din bucătăriile alese', () => {
  const p = generatePlan({ ...noFast, weekCuisines: ['it', 'ro'] });
  const mains = p.meals.filter((m) => m.slot === 'pranz' || m.slot === 'cina');
  const hit = mains.filter((m) => ['it', 'ro'].includes(RECIPE[m.recipeId].cuisine ?? '')).length;
  assert.ok(hit >= mains.length * 0.7, `doar ${hit}/${mains.length} din bucătăriile alese`);
});

console.log('\nExemplu plan (cuplu, post):');

for (let d = 0; d < 7; d++) {
  console.log(`  Ziua ${d} [${plan.fastDays[d]}]: ` + plan.meals.filter((m) => m.day === d).map((m) => `${m.slot}=${RECIPE[m.recipeId].name}${m.frozen ? ' (congelat)' : ''}`).join(' | '));
}
plan.warnings.forEach((w) => console.log('  ! ' + w));

// ── Parsere OCR ──
import { parseNutritionLabel } from '../src/logic/labelParser';
import { parseReceipt, pricePerPackage, splitReceipt } from '../src/logic/receiptParser';
import { linesToRows } from '../src/logic/ocr';
import { buildTaste, tasteBonus } from '../src/logic/taste';
import { RECIPE as RMAP } from '../src/data/recipes';

t('etichetă nutrițională (RO/EN)', () => {
  const v = parseNutritionLabel([
    'Valori nutriționale medii / Average nutritional values   100 g   porție 40 g',
    'Energie / Energy   1567 kJ / 372 kcal   627 kJ / 149 kcal',
    'Grăsimi / Fat   6,6 g   2,6 g',
    'din care acizi grași saturați / of which saturates   1,2 g',
    'Glucide / Carbohydrate   60 g   24 g',
    'din care zaharuri / of which sugars   1,5 g',
    'Fibre / Fibre   9,8 g',
    'Proteine / Protein   13 g',
    'Sare / Salt   0,02 g',
    'Cantitate netă: 500 g',
  ]);
  assert.equal(v.kcal, 372); assert.equal(v.f, 6.6); assert.equal(v.c, 60); assert.equal(v.sug, 1.5);
  assert.equal(v.fib, 9.8); assert.equal(v.p, 13); assert.equal(v.salt, 0.02); assert.equal(v.netG, 500); assert.ok(v.confident);
  const w = parseNutritionLabel(['ENERGIE 250 kJ', 'GRASIMI 1.5g', 'GLUCIDE 4,7 g', 'PROTEINE 3,3 g', 'SODIU 0,04 g']);
  assert.equal(w.kcal, 60); assert.equal(w.salt, 0.1);
});

t('rânduri din OCR cu poziții', () => {
  const rows = linesToRows([
    { text: '7,99 B', x: 0.8, y: 0.20, w: 0.1, h: 0.02 },
    { text: 'LAPTE ZUZU 1,5% 1L', x: 0.05, y: 0.205, w: 0.5, h: 0.02 },
    { text: 'TOTAL 7,99', x: 0.05, y: 0.4, w: 0.5, h: 0.03 },
  ]);
  assert.deepEqual(rows, ['LAPTE ZUZU 1,5% 1L   7,99 B', 'TOTAL 7,99']);
});

t('bon de cumpărături', () => {
  const items = parseReceipt([
    'KAUFLAND ROMANIA SCS', 'CIF RO15991149',
    'LAPTE ZUZU 1,5% 1L   7,99 B',
    '2 BUC X 3,49',
    'PAINE FELIATA 500G   6,98 B',
    '0,856 KG X 32,99',
    'PIEPT PUI   28,24 B',
    'ROSII CHERRY 250G   8,49 B',
    'REDUCERE   -1,00 B',
    'CIUPERCI CHAMPIGNON 500G   9,99 B',
    'PUNGA   0,50 C',
    'TOTAL   61,69',
    'CARD   61,69',
  ]);
  const byIng = Object.fromEntries(items.filter((i) => i.ingId).map((i) => [i.ingId!, i]));
  assert.equal(byIng.lapte.grams, 1000); assert.equal(byIng.lapte.total, 7.99);
  assert.equal(byIng.paine.qty, 2); assert.equal(byIng.paine.grams, 1000);
  assert.equal(byIng.pui_piept.grams, 856); assert.equal(byIng.pui_piept.total, 28.24);
  assert.equal(byIng.rosii.total, 7.49);
  assert.equal(byIng.ciuperci.grams, 500);
  assert.ok(items.some((i) => i.name.includes('PUNGA') && !i.ingId));
  assert.equal(pricePerPackage(byIng.pui_piept), 33); // 28,24 / 856 g × 1000 g
  const lidl = parseReceipt(['Piept pui 0,756 kg x 31,99   24,18 A', 'Banane 1,2 kg x 6,99   8,39 A']);
  assert.equal(lidl.length, 2); assert.equal(lidl[0].ingId, 'pui_piept'); assert.equal(lidl[0].grams, 756); assert.equal(lidl[1].ingId, 'banana');
});

t('bon cu de toate: detergentul și hârtia nu sunt mâncare, ciocolata și sucul da', () => {
  const rows = [
    'MEGA IMAGE SRL', 'CIF RO6719278',
    'LAPTE ZUZU 3,5% 1L   8,49 B',
    'DETERGENT ARIEL GEL 2,2L   54,99 A',
    'HARTIE IGIENICA ZEWA 10 ROLE   27,99 A',
    'CIOCOLATA MILKA 100G   6,49 B',
    'SUC NATURA PORTOCALE 1L   9,99 B',
    'OUA M 10 BUC   14,99 B',
    'FAIRY LAMAIE 450ML   9,49 A',
    'CASCAVAL MATURAT 300G   19,99 B',
    'SAPUN DOVE   5,99 A',
    'ULEI SPRAY GATIT 200ML   12,99 B',
    'PUNGA   0,50 A',
    'TOTAL   171,90',
  ];
  const items = parseReceipt(rows);
  const kind = (n: string) => items.find((i) => i.name.includes(n))!.kind;
  for (const n of ['DETERGENT', 'HARTIE IGIENICA', 'FAIRY', 'SAPUN', 'PUNGA']) assert.equal(kind(n), 'nealimentar', n);
  for (const n of ['LAPTE', 'OUA', 'CASCAVAL', 'ULEI SPRAY']) assert.equal(kind(n), 'aliment', n);
  for (const n of ['SUC']) assert.equal(kind(n), 'altele', n);
  assert.ok(items.filter((i) => i.kind === 'nealimentar').every((i) => !i.ingId), 'detergentul n-are ce căuta în cămară');
  const sp = splitReceipt(items, 171.9);
  assert.equal(sp.nonFood, 98.96);
  assert.equal(sp.food, 72.94);
});

import { parseShared, shareLink } from '../src/logic/recipeShare';
t('rețeta ta trimisă ca link ajunge întreagă (autor, moment, ingrediente, pași, diacritice)', () => {
  const mine = { ...RECIPE.sarmale_vita_cuptor, id: 'u_test', custom: true, author: 'Cosmin', moments: ['pranz', 'cina'] as ('pranz' | 'cina')[], name: 'Sarmalele mamei, cu smântână și mămăligă' };
  const custom = { ...ING.oua, id: 'c_branza_bunicii', name: 'Brânza bunicii' };
  mine.ing = [...mine.ing, [custom.id, 150]];
  const link = shareLink(mine, [custom]);
  assert.ok(link.startsWith('https://ionut43.github.io/nutritie/import?r='));
  assert.ok(link.length < 4000, `link prea lung: ${link.length}`);
  const got = parseShared(`Uite rețeta: ${link} poftă bună`)!;
  assert.equal(got.recipe.name, mine.name);
  assert.equal(got.recipe.author, 'Cosmin');
  assert.deepEqual(got.recipe.moments, ['pranz', 'cina']);
  assert.deepEqual(got.recipe.meal, ['principal']);
  assert.deepEqual(got.recipe.ing, mine.ing);
  assert.deepEqual(got.recipe.steps, mine.steps);
  assert.equal(got.ingredients[0].name, 'Brânza bunicii');
  assert.notEqual(got.recipe.id, mine.id);
  assert.equal(parseShared('https://ionut43.github.io/nutritie/import?r=stricat'), null);
});

import { BREAKFAST_FAVORITES, NOT_FAMILIAR, PLAIN_NAME } from '../src/data/curation';
t('lista făcută de mână (familiare, nume, mic dejun) arată doar rețete care există', () => {
  for (const id of [...BREAKFAST_FAVORITES, ...NOT_FAMILIAR, ...Object.keys(PLAIN_NAME)]) assert.ok(RECIPE[id], `nu există ${id}`);
  for (const id of BREAKFAST_FAVORITES) assert.ok(RECIPE[id].meal.includes('mic_dejun'), `${id} nu e mic dejun`);
  // planul implicit nu pune feluri cu nume pe care nu le știe nimeni
  for (const seed of [1, 2, 3, 4]) {
    const p = generatePlan({ ...noFast, seed });
    for (const m of p.meals) assert.ok(!NOT_FAMILIAR.has(m.recipeId), `${RECIPE[m.recipeId].name} în plan`);
  }
});

t('învățarea gusturilor', () => {
  const taste = buildTaste({ spaghete_bolognese: { up: 3, down: 0, skip: 0 }, iahnie_fasole: { up: 0, down: 2, skip: 1 } }, RMAP);
  assert.ok(taste.ingredient.tocata_vita > 0 && taste.ingredient.fasole_conserva < 0);
  assert.ok(tasteBonus(RMAP.lasagna_carne, taste) > tasteBonus(RMAP.fasole_carnati, taste));
});
import { timersInStep } from '../src/logic/timers';
t('cronometre din pași', () => {
  assert.deepEqual(timersInStep('Fierbe 4–5 minute amestecând.').map((x) => x.seconds), [300]);
  assert.deepEqual(timersInStep('Fierbe 2 ore la foc mic sau coace acoperit.').map((x) => x.seconds), [7200]);
  assert.deepEqual(timersInStep('Fierbe 1 oră și jumătate.').map((x) => x.seconds), [5400]);
  assert.deepEqual(timersInStep('Microunde 1 minut, amestecă, apoi încă 30–45 de secunde.').map((x) => x.seconds), [60, 45]);
  assert.equal(timersInStep('Taie ceapa.').length, 0);
});
import { loadLabels, rankLabels } from '../src/logic/vision';
import { offToIngredient, suggestIngredient } from '../src/logic/products';
t('recunoaștere farfurie: descriere + poza rețetei', () => {
  const emb = JSON.parse(fs.readFileSync('src/data/vision_embeddings.json', 'utf8'));
  const labels = loadLabels(emb);
  for (const r of RECIPES.filter((x) => !x.tags?.includes('garnitura'))) assert.ok(labels.ids.includes(r.id), `fără vector: ${r.id}`);
  assert.ok(labels.hasImg.filter(Boolean).length >= 270);
  const fx = JSON.parse(fs.readFileSync('scripts/fixtures/clip_fixture.json', 'utf8'));
  for (const [name, x] of Object.entries(fx) as [string, { emb: number[]; top: string }][]) {
    assert.equal(rankLabels(x.emb, labels)[0].id, x.top, `${name}: același rezultat ca în Python`);
  }
});
t('produs scanat (Open Food Facts)', () => {
  const j = JSON.parse(fs.readFileSync('scripts/fixtures/off_nutella.json', 'utf8'));
  const i = offToIngredient('3017620422003', j.product)!;
  assert.equal(i.kcal, 539); assert.ok(i.allergens.includes('lapte') && i.allergens.includes('nuci')); assert.equal(i.pkg > 0, true);
  assert.equal(i.id, 'p_3017620422003');
  suggestIngredient(j.product);
});

import { trimPlanSlots } from '../src/logic/planner';
t('suma meselor dintr-o zi = ținta de calorii (±5%), oricâte mese', () => {
  const solo = { ...noFast, members: [me], household: { memberIds: ['me'], guests: 0, applyFasting: false } };
  const target = computeTargets(me, new Date('2026-11-15')).kcal;
  const { mealMacros: mm } = require('../src/logic/planner');
  const dayKcal = (p: ReturnType<typeof generatePlan>, d: number) => p.meals.filter((m) => m.day === d)
    .reduce((a, m) => a + mm(m, 'me').kcal, 0);
  const out: string[] = [];
  for (const slots of [['pranz', 'cina'], ['mic_dejun', 'pranz', 'cina'], ['mic_dejun', 'pranz', 'gustare2', 'cina']] as Settings['slots'][]) {
    const p = generatePlan({ ...solo, settings: { ...solo.settings, slots } });
    assert.equal(p.meals.length, slots.length * 7, `${slots.length} mese: ${p.meals.length}`);
    const ks = Array.from({ length: 7 }, (_, d) => dayKcal(p, d));
    for (const k of ks) assert.ok(k <= target * 1.05 + 1, `${slots.length} mese: ${Math.round(k)} > ${target}`);
    out.push(`${slots.length} mese ${Math.round(Math.min(...ks))}–${Math.round(Math.max(...ks))}`);
    if (slots.length === 4) {
      // din 4 mese în 2: rămân prânzul și cina, porțiile cresc, ziua tot în țintă
      const tp = trimPlanSlots(p, ['pranz', 'cina'], { ...solo, settings: { ...solo.settings, slots: ['pranz', 'cina'] } });
      assert.equal(tp.meals.length, 14);
      assert.ok(tp.meals.every((m) => m.slot === 'pranz' || m.slot === 'cina'));
      for (let d = 0; d < 7; d++) assert.ok(dayKcal(tp, d) <= target * 1.05 + 1);
      for (const s of tp.sessions) assert.ok(tp.meals.some((m) => m.sessionId === s.id || m.sides?.some((x) => x.sessionId === s.id)) || s.done);
      out.push(`4→2 ${Math.round(Math.min(...[0, 1, 2, 3, 4, 5, 6].map((d) => dayKcal(tp, d))))}–${Math.round(Math.max(...[0, 1, 2, 3, 4, 5, 6].map((d) => dayKcal(tp, d))))}`);
    }
  }
  console.log(`   ținta ${target}: ${out.join(', ')}`);
});

t('lacătul: mesele fixate rămân exact acolo când refaci planul; la 2 mese gătești rar', () => {
  const solo = { ...noFast, members: [me], household: { memberIds: ['me'], guests: 0, applyFasting: false }, settings: { ...noFast.settings, slots: ['pranz', 'cina'] as Settings['slots'] } };
  const p1 = generatePlan({ ...solo, seed: 11 });
  const locked = [p1.meals[1], p1.meals[6], p1.meals[11]].map((m) => ({ day: m.day, slot: m.slot, recipeId: m.recipeId }));
  for (const seed of [12, 13, 14]) {
    const p2 = generatePlan({ ...solo, seed, locked });
    for (const l of locked) assert.equal(p2.meals.find((m) => m.day === l.day && m.slot === l.slot)?.recipeId, l.recipeId, `seed ${seed} ziua ${l.day}`);
  }
  const cookDays = new Set(p1.sessions.filter((x) => p1.meals.some((m) => m.sessionId === x.id)).map((x) => x.day)).size;
  assert.ok(cookDays <= 4, `gătești de ${cookDays} ori`);
  console.log(`   gătești de ${cookDays} ori, ${new Set(p1.meals.map((m) => m.recipeId)).size} rețete`);
});

t('mic dejun variat și puțină linte la cine mănâncă de toate', () => {
  let rare = 0, mains = 0;
  const kinds = new Map<string, number>();
  // 4 săptămâni la rând pentru fiecare buget, cu istoricul săptămânilor dinainte (ca în aplicație)
  for (const budget of [200, 300, 450]) {
    let history: Record<string, number> = {};
    for (const seed of [1, 2, 3, 4]) {
    const p = generatePlan({ ...base, members: [{ ...me, diet: 'omnivor' }], household: { memberIds: ['me'], guests: 0, applyFasting: false },
      settings: { ...settings, slots: ['mic_dejun', 'pranz', 'cina'], budgetRon: budget, fasting: 'niciunul' }, seed, history });
    history = Object.fromEntries(Object.entries(history).map(([k, v]) => [k, v + 1]));
    for (const m of p.meals) history[m.recipeId] = 1;
    for (const m of p.meals) {
      const r = RECIPE[m.recipeId];
      if (m.slot === 'mic_dejun') kinds.set(r.id, (kinds.get(r.id) ?? 0) + 1);
      if (m.slot !== 'mic_dejun' && r.meal.includes('principal')) { mains++; if (r.tags?.includes('mai_rar')) rare++; }
    }
    }
  }
  // 12 săptămâni: multe feluri de mic dejun, niciunul nu domină; linte/năut cel mult ~o dată pe săptămână
  const top = Math.max(...kinds.values()), total = [...kinds.values()].reduce((a, b) => a + b, 0);
  assert.ok(kinds.size >= 15, `doar ${kinds.size} feluri de mic dejun în 12 săptămâni`);
  assert.ok(top / total <= 0.2, `un mic dejun e ${Math.round((100 * top) / total)}% din toate`);
  assert.ok(rare <= 16, `${rare} mese cu linte/năut/bulgur din ${mains}`);
  console.log(`   12 săptămâni: ${kinds.size} feluri de mic dejun (cel mai des ${top}/${total}), ${rare}/${mains} mese cu linte, năut sau bulgur`);
});

console.log(`\n${passed} teste trecute`);
