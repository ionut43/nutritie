export const DAY_NAMES = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
export const DAY_SHORT = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];
const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

export function todayISO(): string {
  return toISO(new Date());
}

/** 0 = luni … 6 = duminică */
export function weekdayMon(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function daysBetween(aISO: string, bISO: string): number {
  return Math.round((fromISO(bISO).getTime() - fromISO(aISO).getTime()) / 86400000);
}

export function fmtDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtDayLabel(d: Date): string {
  return `${DAY_NAMES[weekdayMon(d)]}, ${fmtDate(d)}`;
}
