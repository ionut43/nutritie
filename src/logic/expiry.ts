import { ING } from '../data/ingredients';
import { addDays, fromISO } from './dates';
import type { PantryItem } from './types';

export interface ExpiryNotice { at: Date; title: string; body: string }

const list = (names: string[]) => (names.length > 4 ? `${names.slice(0, 4).join(', ')} și încă ${names.length - 4}` : names.join(', '));

/** Notificări: cu o zi înainte la 18:00 și în ziua expirării la 9:00 (condimentele nu se anunță) */
export function expirySchedule(pantry: PantryItem[], now = new Date(), horizonDays = 30): ExpiryNotice[] {
  const byDay = new Map<string, string[]>();
  for (const p of pantry) {
    const i = ING[p.ingId];
    if (!i || i.staple || i.shelfDays >= 180) continue;
    const arr = byDay.get(p.expiresISO) ?? [];
    if (!arr.includes(i.name.toLowerCase())) arr.push(i.name.toLowerCase());
    byDay.set(p.expiresISO, arr);
  }
  const out: ExpiryNotice[] = [];
  const limit = addDays(now, horizonDays).getTime();
  for (const [iso, names] of [...byDay.entries()].sort()) {
    const d = fromISO(iso);
    const eve = new Date(addDays(d, -1).setHours(18, 0, 0, 0));
    const morning = new Date(new Date(d).setHours(9, 0, 0, 0));
    if (eve.getTime() > now.getTime() && eve.getTime() < limit) {
      out.push({ at: eve, title: 'Mâine expiră', body: `${list(names)}. Deschide aplicația să vezi ce poți găti cu ele.` });
    }
    if (morning.getTime() > now.getTime() && morning.getTime() < limit) {
      out.push({ at: morning, title: 'Azi expiră', body: `${list(names)}. Folosește-le azi sau congelează-le.` });
    }
  }
  return out.slice(0, 50);
}
