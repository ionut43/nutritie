import { ING } from '../data/ingredients';

/*
 * Magazinele și prețurile.
 * Prețul de bază al fiecărui ingredient e o estimare pentru un supermarket mediu din București.
 * Fiecare magazin are un indice față de această bază, după comparațiile de coș publicate în 2025–2026
 * (Lidl cel mai ieftin, Mega Image cel mai scump, diferență de ~13% pe coșul de bază). Indicii sunt
 * doar punctul de plecare: după fiecare bon scanat, aplicația folosește prețul real din magazinul respectiv.
 */

export type StoreId =
  | 'lidl' | 'kaufland' | 'mega' | 'carrefour' | 'auchan' | 'profi' | 'penny' | 'selgros' | 'freshful' | 'altul';

export interface StoreInfo { id: StoreId; name: string; color: string; ink: string; index: number; receipt: RegExp }

export const STORES: StoreInfo[] = [
  { id: 'lidl', name: 'Lidl', color: '#0050AA', ink: '#FFF000', index: 0.95, receipt: /\bLIDL\b/i },
  { id: 'kaufland', name: 'Kaufland', color: '#E10915', ink: '#FFFFFF', index: 1.0, receipt: /KAUFLAND/i },
  { id: 'mega', name: 'Mega Image', color: '#E2001A', ink: '#FFFFFF', index: 1.1, receipt: /MEGA\s*IMAGE/i },
  { id: 'carrefour', name: 'Carrefour', color: '#004E9F', ink: '#FFFFFF', index: 1.05, receipt: /CARREFOUR/i },
  { id: 'auchan', name: 'Auchan', color: '#D6180B', ink: '#FFFFFF', index: 1.03, receipt: /AUCHAN/i },
  { id: 'profi', name: 'Profi', color: '#F28C00', ink: '#FFFFFF', index: 1.0, receipt: /\bPROFI\b/i },
  { id: 'penny', name: 'Penny', color: '#CD1719', ink: '#FFFFFF', index: 0.96, receipt: /\bPENNY\b/i },
  { id: 'selgros', name: 'Selgros', color: '#00305E', ink: '#FFFFFF', index: 0.98, receipt: /SELGROS/i },
  { id: 'freshful', name: 'Freshful (online)', color: '#00A651', ink: '#FFFFFF', index: 1.06, receipt: /FRESHFUL/i },
  { id: 'altul', name: 'Alt magazin', color: '#5B6470', ink: '#FFFFFF', index: 1.0, receipt: /$^/ },
];

export const STORE: Record<StoreId, StoreInfo> = Object.fromEntries(STORES.map((s) => [s.id, s])) as Record<StoreId, StoreInfo>;

/** prețuri învățate din bonuri: magazin → ingredient → preț pe ambalajul tipic */
export type StorePrices = Partial<Record<StoreId, Record<string, number>>>;

/** prețul unui ambalaj, în ordinea: bon din magazinul respectiv → prețul editat de tine × indice → estimarea × indice */
/** prețurile de azi din Monitorul Prețurilor (le setează aplicația după ce le descarcă) */
let LIVE: Partial<Record<StoreId, Record<string, number>>> = {};
export function setLivePrices(p: Partial<Record<StoreId, Record<string, number>>> | undefined) { LIVE = p ?? {}; }
export function livePrice(ingId: string, store?: StoreId): number | undefined {
  if (!store) return undefined;
  const own = LIVE[store]?.[ingId];
  if (own !== undefined) return own;
  // magazinul nu raportează produsul: media celorlalte, ajustată după cât de scump e magazinul
  const others = (Object.keys(LIVE) as StoreId[]).filter((k) => LIVE[k]?.[ingId] !== undefined);
  if (!others.length) return undefined;
  const avg = others.reduce((a, k) => a + LIVE[k]![ingId] / (STORE[k]?.index ?? 1), 0) / others.length;
  return avg * (STORE[store]?.index ?? 1);
}

/** ordinea: prețul de pe bonul tău > prețul de azi din magazine > prețul scris de tine > estimarea */
export function priceAt(ingId: string, store: StoreId | undefined, prices: Record<string, number>, storePrices: StorePrices = {}): number {
  const learned = store ? storePrices[store]?.[ingId] : undefined;
  if (learned !== undefined) return learned;
  const live = livePrice(ingId, store);
  if (live !== undefined) return live;
  const base = prices[ingId] ?? ING[ingId]?.price ?? 0;
  return base * (store ? STORE[store]?.index ?? 1 : 1);
}

/** câte prețuri reale (de pe bon) știm pentru magazin */
export function learnedCount(store: StoreId, storePrices: StorePrices): number {
  return Object.keys(storePrices[store] ?? {}).length;
}

/** costul aceleiași liste (ingId → nr. ambalaje) în fiecare magazin */
export function compareStores(
  items: { ingId: string; packages: number }[], stores: StoreId[], prices: Record<string, number>, storePrices: StorePrices,
): { store: StoreId; cost: number; known: number }[] {
  return stores
    .map((st) => {
      let cost = 0;
      let known = 0;
      for (const it of items) {
        if (it.packages <= 0) continue;
        cost += it.packages * priceAt(it.ingId, st, prices, storePrices);
        if (storePrices[st]?.[it.ingId] !== undefined) known++;
      }
      return { store: st, cost, known };
    })
    .sort((a, b) => a.cost - b.cost);
}

/** recunoaște magazinul după antetul bonului */
export function detectStore(text: string): StoreId | undefined {
  return STORES.find((s) => s.id !== 'altul' && s.receipt.test(text))?.id;
}
