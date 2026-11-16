import { ING } from '../data/ingredients';

const nf = (x: number, d = 1) => x.toLocaleString('ro-RO', { maximumFractionDigits: d });

function roundG(g: number): number {
  if (g >= 1000) return Math.round(g / 50) * 50;
  if (g >= 100) return Math.round(g / 10) * 10;
  if (g >= 20) return Math.round(g / 5) * 5;
  return Math.max(1, Math.round(g));
}

export function fmtMass(g: number): string {
  const r = roundG(g);
  return r >= 1000 ? `${nf(r / 1000, 2)} kg` : `${r} g`;
}

export function fmtQty(ingId: string, g: number): string {
  const i = ING[ingId];
  if (!i) return fmtMass(g);
  if (i.staple && g < 5) return 'după gust';
  if (i.unit === 'buc' && i.gPerPiece) {
    const n = Math.round((g / i.gPerPiece) * 2) / 2;
    if (n >= 0.5 && i.gPerPiece >= 30) return `${nf(n)} buc (${fmtMass(g)})`;
    if (n >= 1 && i.gPerPiece < 30) return `${Math.round(n)} ${i.id === 'usturoi' ? 'căței' : 'buc'}`;
  }
  if (i.unit === 'ml') {
    const ml = g / (i.density ?? 1);
    if (ml < 20) {
      const lg = ml / 15;
      return lg >= 0.75 ? `${nf(Math.round(lg * 2) / 2)} lingură${lg >= 1.5 ? 'i' : ''}` : `${Math.max(1, Math.round(ml / 5))} linguriță`;
    }
    const r = roundG(ml);
    return r >= 1000 ? `${nf(r / 1000, 2)} l` : `${r} ml`;
  }
  return fmtMass(g);
}

export function fmtPackage(ingId: string, packages: number): string {
  const i = ING[ingId];
  if (!i) return `${packages}`;
  if (i.unit === 'ml') {
    const ml = i.pkg / (i.density ?? 1);
    return `${packages} × ${ml >= 1000 ? `${nf(ml / 1000, 2)} l` : `${Math.round(ml)} ml`}`;
  }
  if (i.unit === 'buc' && i.gPerPiece && i.id !== 'oua' && i.pkg === i.gPerPiece) return `${packages} buc`;
  if (i.id === 'oua') return `${packages} × 10 buc`;
  return `${packages} × ${fmtMass(i.pkg)}`;
}

export const fmtRon = (x: number) => `${nf(x, 0)} lei`;
export const fmtKcal = (x: number) => `${Math.round(x)} kcal`;
export { nf };
