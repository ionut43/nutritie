import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import NutriOcr from '../../modules/nutri-ocr';

/*
 * Jurnal de diagnostic, doar pe telefon: ultimii pași (ex. „poză aleasă”, „încep recunoașterea”)
 * și ultima eroare. Dacă aplicația se închide, la redeschidere vedem unde a rămas.
 */
const file = () => new File(Paths.document, 'diag.log');
const MAX = 60;
let mem: string[] | null = null;

function load(): string[] {
  if (mem) return mem;
  try { const f = file(); mem = f.exists ? f.textSync().split('\n').filter(Boolean) : []; } catch { mem = []; }
  return mem;
}

export function crumb(msg: string) {
  const lines = load();
  lines.push(`${new Date().toISOString().slice(5, 19).replace('T', ' ')} ${msg}`);
  while (lines.length > MAX) lines.shift();
  try { const f = file(); if (!f.exists) f.create(); f.writeSync(lines.join('\n')); } catch { /* nimic */ }
}

export function readCrumbs(): string[] {
  mem = null;
  return load();
}

export function clearCrumbs() {
  mem = [];
  try { const f = file(); if (f.exists) f.delete(); } catch { /* nimic */ }
}

/** erorile JavaScript necaptate ajung în jurnal înainte să închidă aplicația */
export function installErrorLog() {
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: Error, fatal?: boolean) => void; setGlobalHandler: (h: (e: Error, fatal?: boolean) => void) => void } };
  const eu = g.ErrorUtils;
  if (!eu) return;
  const prev = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => {
    crumb(`EROARE${fatal ? ' FATALĂ' : ''}: ${e?.message ?? e} | ${(e?.stack ?? '').split('\n').slice(0, 4).join(' / ')}`);
    prev(e, fatal);
  });
}

export function exitReasons() {
  if (Platform.OS !== 'android') return [];
  try { return NutriOcr?.lastExits?.() ?? []; } catch { return []; }
}

export function report(): string {
  const exits = exitReasons().map((e) => `${new Date(e.time).toLocaleString('ro-RO')}: ${e.reason}${e.description ? ` (${e.description})` : ''}, memorie ${Math.round(e.pss / 1024)} MB${e.trace ? `\n${e.trace.slice(0, 1500)}` : ''}`);
  return [
    `Telefon: ${Platform.OS} ${String(Platform.Version)}`,
    exits.length ? `Ultimele închideri:\n${exits.join('\n')}` : Platform.OS === 'android' ? 'Ultimele închideri: niciuna înregistrată' : 'Pe iPhone: Configurări → Confidențialitate și securitate → Analiză și îmbunătățiri → Date de analiză → caută „Nutritie” și trimite fișierul.',
    `Ultimii pași:\n${readCrumbs().slice(-25).join('\n') || '(gol)'}`,
  ].join('\n\n');
}
