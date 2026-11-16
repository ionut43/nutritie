import type { Activity, Goal, JobActivity, Member, TrainType, WeightEntry } from './types';
import { daysBetween } from './dates';

/*
 * Adulți (≥ 18 ani): Mifflin-St Jeor × factor de activitate.
 * Copii și adolescenți: ecuațiile EER ale Institute of Medicine (Dietary Reference Intakes, 2005).
 * Sarcină/alăptare: suplimentele IOM (T2 +340, T3 +452, alăptare +330 kcal), fără deficit.
 * 1 kg de grăsime ≈ 7700 kcal → 0,5 kg/săpt ≈ 550 kcal/zi.
 */

export const ACTIVITY: Record<Activity, { label: string; desc: string; factor: number; pa: { m: number; f: number } }> = {
  sedentar: { label: 'Sedentar', desc: 'Birou, aproape fără sport', factor: 1.2, pa: { m: 1.0, f: 1.0 } },
  usor: { label: 'Ușor activ', desc: 'Sport ușor 1–3 zile/săpt. sau mult mers pe jos', factor: 1.375, pa: { m: 1.13, f: 1.16 } },
  moderat: { label: 'Moderat activ', desc: 'Sport 3–5 zile/săpt.', factor: 1.55, pa: { m: 1.26, f: 1.31 } },
  activ: { label: 'Activ', desc: 'Sport intens 6–7 zile/săpt. sau muncă fizică', factor: 1.725, pa: { m: 1.42, f: 1.56 } },
  foarte_activ: { label: 'Foarte activ', desc: 'Antrenamente de 2 ori pe zi sau muncă fizică grea', factor: 1.9, pa: { m: 1.42, f: 1.56 } },
};

/** activitatea zilnică fără sport (include digestia), ca multiplu al metabolismului bazal */
export const JOB: Record<JobActivity, { label: string; desc: string; base: number }> = {
  birou: { label: 'Stau mult jos', desc: 'Birou, școală, condus', base: 1.25 },
  picioare: { label: 'Sunt des în picioare', desc: 'Vânzări, profesor, mers mult pe jos', base: 1.4 },
  fizic: { label: 'Muncă fizică', desc: 'Depozit, service, șantier ușor', base: 1.6 },
  foarte_fizic: { label: 'Muncă fizică grea', desc: 'Construcții, cărat greutăți toată ziua', base: 1.8 },
};

/** echivalentul metabolic net (peste repaus) al antrenamentului, pe oră */
export const TRAIN: Record<TrainType, { label: string; net: number }> = {
  forta: { label: 'Forță (sală, greutăți)', net: 4 },
  cardio: { label: 'Cardio (alergat, bicicletă, înot)', net: 7 },
  mixt: { label: 'Mixt (sporturi de echipă, crossfit)', net: 5.5 },
};

/** factorul zilnic din job și pași (pașii cântăresc mai mult când sunt știuți) */
export function dailyBase(m: Member): number {
  const job = m.job ? JOB[m.job].base : ACTIVITY[m.activity].factor;
  if (!m.steps || m.steps <= 0) return job;
  const fromSteps = Math.min(1.75, Math.max(1.2, 1.2 + (Math.max(0, m.steps - 3000) / 10000) * 0.35));
  return Math.max(job, fromSteps);
}

/** kcal/zi în medie din antrenamente */
export function exerciseKcal(m: Member): number {
  if (!m.trainDays || !m.trainMin) return 0;
  const net = TRAIN[m.trainType ?? 'mixt'].net;
  return (net * m.weightKg * (m.trainMin / 60) * m.trainDays) / 7;
}

/** categoria veche de activitate, pentru copii (formula IOM) */
export function activityCategory(m: Member): Activity {
  if (!m.job) return m.activity;
  const pal = dailyBase(m) + exerciseKcal(m) / Math.max(1, 10 * m.weightKg + 600);
  return pal < 1.3 ? 'sedentar' : pal < 1.45 ? 'usor' : pal < 1.65 ? 'moderat' : pal < 1.85 ? 'activ' : 'foarte_activ';
}

/** câte săptămâni până la greutatea dorită, în ritmul ales */
export function weeksToTarget(m: Member): number | null {
  if (!m.targetKg || !m.rateKg || m.goal === 'mentinere') return null;
  const diff = m.goal === 'slabire' ? m.weightKg - m.targetKg : m.targetKg - m.weightKg;
  if (diff <= 0) return null;
  return Math.ceil(diff / m.rateKg);
}

export const GOAL_LABEL: Record<Goal, string> = {
  slabire: 'Să slăbesc (deficit caloric)',
  mentinere: 'Să-mi mențin greutatea',
  masa: 'Să iau în greutate (surplus caloric)',
};

export interface Targets {
  kcal: number; bmr: number; tdee: number;
  protein: number; fat: number; carbs: number; fiber: number;
  /** sare maximă recomandată (OMS) g/zi */
  saltMax: number;
  bmi: number; age: number; isChild: boolean; goal: Goal;
  method: string; warnings: string[];
}

export function ageOf(m: Member, at = new Date()): number {
  return at.getFullYear() - m.birthYear;
}

export function bmiOf(m: Member): number {
  const h = m.heightCm / 100;
  return m.weightKg / (h * h);
}

const round10 = (x: number) => Math.round(x / 10) * 10;

export function computeTargets(m: Member, at = new Date()): Targets {
  const age = ageOf(m, at);
  const w = m.weightKg;
  const hM = m.heightCm / 100;
  const bmi = bmiOf(m);
  const warnings: string[] = [];
  let goal: Goal = m.goal;
  let bmr: number;
  let tdee: number;
  let method: string;
  const isChild = age < 18;

  if (isChild) {
    const pa = ACTIVITY[activityCategory(m)].pa[m.sex];
    if (age < 3) {
      tdee = 89 * w - 100 + 20;
      method = 'IOM EER (1–2 ani)';
    } else {
      const extra = age <= 8 ? 20 : 25;
      tdee = m.sex === 'm'
        ? 88.5 - 61.9 * age + pa * (26.7 * w + 903 * hM) + extra
        : 135.3 - 30.8 * age + pa * (10.0 * w + 934 * hM) + extra;
      method = 'IOM EER (copii și adolescenți)';
    }
    bmr = tdee / ACTIVITY[activityCategory(m)].factor;
    if (goal !== 'mentinere') warnings.push('Pentru copii și adolescenți aplicația nu calculează deficit sau surplus. Discută cu medicul pediatru.');
    goal = 'mentinere';
  } else {
    if (m.bodyFat && m.bodyFat >= 4 && m.bodyFat <= 60) {
      // cu procentul de grăsime știut, Katch-McArdle e mai exactă (pornește de la masa slabă)
      bmr = 370 + 21.6 * w * (1 - m.bodyFat / 100);
      method = 'Katch-McArdle (cu % grăsime)';
    } else {
      bmr = 10 * w + 6.25 * m.heightCm - 5 * age + (m.sex === 'm' ? 5 : -161);
      method = 'Mifflin-St Jeor';
    }
    tdee = m.job ? bmr * dailyBase(m) + exerciseKcal(m) : bmr * ACTIVITY[m.activity].factor;
  }

  let kcal = tdee;

  if (!isChild && m.sex === 'f' && m.pregnancy !== 'nu') {
    if (goal !== 'mentinere') warnings.push('În sarcină sau alăptare nu se recomandă deficit caloric. Ținta e pentru menținere plus necesarul suplimentar.');
    goal = 'mentinere';
    kcal += { nu: 0, t1: 0, t2: 340, t3: 452, alaptare: 330 }[m.pregnancy];
  }

  if (!isChild && goal === 'slabire' && bmi < 18.5) {
    warnings.push(`IMC-ul tău e ${bmi.toFixed(1)} (subponderal). Am setat ținta la menținere. Discută cu un medic înainte de orice deficit.`);
    goal = 'mentinere';
  }

  if (!isChild && goal === 'slabire') {
    const wanted = m.rateKg * 1100;
    const maxDef = tdee * 0.25;
    if (wanted > maxDef) warnings.push(`Ritmul ales cere un deficit prea mare. L-am limitat la ${Math.round(maxDef)} kcal/zi (25% din necesar).`);
    kcal = tdee - Math.min(wanted, maxDef);
    const floor = m.sex === 'm' ? 1500 : 1200;
    if (kcal < floor) {
      kcal = floor;
      warnings.push(`Ținta nu coboară sub ${floor} kcal/zi, minimul sigur fără supraveghere medicală.`);
    }
  } else if (!isChild && goal === 'masa') {
    kcal = tdee + Math.min(m.rateKg * 1100, 500);
  }

  kcal += m.kcalAdjust;
  kcal = round10(kcal);

  // Proteine: peste IMC 25 se socotesc pe greutatea ajustată (nu pe tot surplusul), și cel mult ~32% din calorii,
  // cât se poate mânca din mâncare obișnuită. Sub 0,8 g/kg nu coboară niciodată.
  const refW = bmi > 25 ? 25 * hM * hM + 0.25 * (w - 25 * hM * hM) : w;
  const gPerKg = isChild ? 1.0 : m.pregnancy !== 'nu' ? 1.3 : (goal === 'mentinere' ? 1.2 : 1.6) + (m.highProtein ? 0.4 : 0);
  const capPct = m.highProtein ? 0.38 : 0.32;
  const protein = Math.round(Math.max(0.8 * refW, Math.min(refW * gPerKg, (kcal * capPct) / 4)));
  const fat = Math.round(Math.max((kcal * 0.3) / 9, 0.6 * w));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((kcal / 1000) * 14);

  if (m.medical) warnings.push('Ai indicat o afecțiune care cere dietă medicală. Folosește valorile doar după ce le confirmi cu medicul sau nutriționistul.');

  const saltMax = age < 4 ? 2 : age < 7 ? 3 : age < 11 ? 5 : 5;
  return { kcal, bmr: Math.round(bmr), tdee: round10(tdee), protein, fat, carbs, fiber, saltMax, bmi, age, isChild, goal, method, warnings };
}

/** Pantă kg/săptămână prin regresie liniară pe ultimele `days` zile */
export function weightTrend(log: WeightEntry[], days = 28): { slope: number; n: number; spanDays: number } | null {
  if (log.length < 3) return null;
  const sorted = [...log].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  const last = sorted[sorted.length - 1].dateISO;
  const pts = sorted.filter((e) => daysBetween(e.dateISO, last) <= days);
  if (pts.length < 3) return null;
  const x = pts.map((e) => daysBetween(pts[0].dateISO, e.dateISO));
  const y = pts.map((e) => e.kg);
  const span = x[x.length - 1];
  if (span < 10) return null;
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let num = 0, den = 0;
  x.forEach((xi, i) => { num += (xi - mx) * (y[i] - my); den += (xi - mx) ** 2; });
  if (den === 0) return null;
  return { slope: (num / den) * 7, n: pts.length, spanDays: span };
}

/** Sugestie de ajustare (kcal/zi) comparând trendul real cu ritmul dorit */
export function adaptiveSuggestion(m: Member, log: WeightEntry[]): { delta: number; text: string } | null {
  const t = weightTrend(log);
  if (!t) return null;
  const desired = m.goal === 'slabire' ? -m.rateKg : m.goal === 'masa' ? m.rateKg : 0;
  const diff = t.slope - desired; // kg/săpt
  const fmt = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)} kg/săpt.`;
  if (Math.abs(diff) < 0.15) return { delta: 0, text: `Trend ${fmt(t.slope)} – ești pe drumul bun, nu schimba nimic.` };
  // diferența în kcal/zi, limitată la ±200 pe pas
  const delta = Math.max(-200, Math.min(200, -Math.round((diff * 1100) / 50) * 50));
  const dir = delta < 0 ? 'scade' : 'crește';
  return { delta, text: `Trend real ${fmt(t.slope)}, ținta e ${fmt(desired)}. Recomand să ${dir} ținta cu ${Math.abs(delta)} kcal/zi.` };
}
