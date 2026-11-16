import { addDays, toISO, weekdayMon } from './dates';
import type { FastLevel, FastPref } from './types';

/*
 * Calendarul de post al Bisericii Ortodoxe Române (stil nou), calculat pe orice an:
 * - Postul Mare (Paști − 48 … Paști − 1), dezlegare la pește de Buna Vestire și de Florii
 * - Postul Sfinților Apostoli (luni după Duminica Tuturor Sfinților … 28 iunie), pește sâmbăta, duminica și pe 24 iunie
 * - Postul Adormirii Maicii Domnului (1–14 aug.), pește pe 6 aug.
 * - Postul Crăciunului (15 nov. – 24 dec.), pește sâmbăta și duminica până pe 19 dec., plus 21 nov. și 6 dec.
 * - Miercurea și vinerea, în afara săptămânilor fără post (harți)
 * - Zile de post singulare: 5 ian., 29 aug., 14 sep.
 * - Săptămâna brânzei (înainte de Postul Mare): fără carne
 */

/** Paștele ortodox (algoritmul Meeus pentru calendarul iulian, convertit în gregorian; valabil 1900–2099) */
export function orthodoxEaster(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31); // 3 = martie, 4 = aprilie (iulian)
  const day = ((d + e + 114) % 31) + 1;
  return addDays(new Date(year, month - 1, day), 13);
}

const between = (d: Date, a: Date, b: Date) => d.getTime() >= a.getTime() && d.getTime() <= b.getTime();
const md = (d: Date, m: number, day: number) => d.getMonth() === m - 1 && d.getDate() === day;

export interface FastInfo { level: FastLevel; reason: string }

export function fastInfo(date: Date, pref: FastPref, fishOnDispensation = true): FastInfo {
  const none: FastInfo = { level: 'none', reason: '' };
  if (pref === 'niciunul') return none;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const y = d.getFullYear();
  const E = orthodoxEaster(y);
  const P = addDays(E, 49); // Rusalii
  const wd = weekdayMon(d);
  const weekend = wd >= 5;
  const fish = (reason: string): FastInfo => ({ level: fishOnDispensation ? 'fish_ok' : 'strict', reason });
  const strict = (reason: string): FastInfo => ({ level: 'strict', reason });

  const greatAllowed = pref === 'posturile_mari' || pref === 'toate';
  const wedFriAllowed = pref === 'miercuri_vineri' || pref === 'toate';
  const singlesAllowed = pref === 'toate';

  if (greatAllowed) {
    // Săptămâna brânzei
    if (between(d, addDays(E, -55), addDays(E, -49))) return { level: 'no_meat', reason: 'Săptămâna brânzei (fără carne)' };
    // Postul Mare
    if (between(d, addDays(E, -48), addDays(E, -1))) {
      const holyWeek = between(d, addDays(E, -6), addDays(E, -1));
      if (toISO(d) === toISO(addDays(E, -7))) return fish('Postul Mare – Floriile');
      if (md(d, 3, 25) && !holyWeek) return fish('Postul Mare – Buna Vestire');
      return strict('Postul Mare');
    }
    // Postul Sfinților Apostoli Petru și Pavel
    const apStart = addDays(P, 8);
    const apEnd = new Date(y, 5, 28);
    if (apStart.getTime() <= apEnd.getTime() && between(d, apStart, apEnd)) {
      if (md(d, 6, 24)) return fish('Postul Sf. Petru – Nașterea Sf. Ioan');
      if (weekend) return fish('Postul Sf. Petru');
      return strict('Postul Sf. Petru');
    }
    // Postul Adormirii Maicii Domnului
    if (between(d, new Date(y, 7, 1), new Date(y, 7, 14))) {
      if (md(d, 8, 6)) return fish('Postul Adormirii – Schimbarea la Față');
      return strict('Postul Adormirii Maicii Domnului');
    }
    // Postul Crăciunului
    if (between(d, new Date(y, 10, 15), new Date(y, 11, 24))) {
      if (md(d, 11, 21)) return fish('Postul Crăciunului – Intrarea în Biserică');
      if (md(d, 12, 6)) return fish('Postul Crăciunului – Sf. Nicolae');
      if (weekend && d.getTime() <= new Date(y, 11, 19).getTime()) return fish('Postul Crăciunului');
      return strict('Postul Crăciunului');
    }
  }

  if (singlesAllowed) {
    if (md(d, 1, 5)) return strict('Ajunul Bobotezei');
    if (md(d, 8, 29)) return strict('Tăierea capului Sf. Ioan');
    if (md(d, 9, 14)) return strict('Înălțarea Sfintei Cruci');
  }

  if (wedFriAllowed && (wd === 2 || wd === 4)) {
    const harti =
      (d.getMonth() === 11 && d.getDate() >= 25) ||
      (d.getMonth() === 0 && d.getDate() <= 4) ||
      between(d, addDays(E, 1), addDays(E, 6)) ||
      between(d, addDays(P, 1), addDays(P, 6)) ||
      between(d, addDays(E, -69), addDays(E, -64));
    if (!harti) return strict(wd === 2 ? 'Miercuri – zi de post' : 'Vineri – zi de post');
  }
  return none;
}

export function fastLevel(date: Date, pref: FastPref, fishOnDispensation = true): FastLevel {
  return fastInfo(date, pref, fishOnDispensation).level;
}

export const FAST_LABEL: Record<FastLevel, string> = {
  none: '',
  no_meat: 'Fără carne',
  fish_ok: 'Post, cu dezlegare la pește',
  strict: 'Post',
};
