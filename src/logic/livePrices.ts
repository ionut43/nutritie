import { ING } from '../data/ingredients';
import PRICE_MAP from '../data/price_map.json';
import PRICE_PRODUCTS from '../data/price_products.json';
import type { StoreId } from './stores';

/*
 * Prețuri de azi din Monitorul Prețurilor (Consiliul Concurenței): magazinele raportează zilnic.
 * Pentru fiecare ingredient iau produsele potrivite, prețul pe kg din magazinele din jurul tău și,
 * pe fiecare rețea, o valoare „de coș obișnuit” (percentila 30, nu cel mai scump brand).
 */
const BASE = 'https://monitorulpreturilor.info/pmonsvc/Retail';
const NET: Record<string, StoreId> = {
  AUCHAN: 'auchan', '5940475006709': 'carrefour', KAUFLAND: 'kaufland', '4055329000008': 'lidl',
  '5940475870003': 'mega', PENNY: 'penny', PROFI: 'profi', SELGROS: 'selgros',
};

export interface LivePrices {
  fetchedAt: string;
  area: { name: string; lat: number; lon: number };
  /** prețul pachetului din aplicație, pe magazin */
  prices: Partial<Record<StoreId, Record<string, number>>>;
  /** câte produse și magazine au stat la bază */
  stats: { products: number; stores: number };
}

export const CITIES: { name: string; lat: number; lon: number }[] = [
  { name: 'București, Sector 1', lat: 44.4655, lon: 26.0832 }, { name: 'București, Sector 2', lat: 44.4489, lon: 26.1386 },
  { name: 'București, Sector 3', lat: 44.4202, lon: 26.1497 }, { name: 'București, Sector 4', lat: 44.3842, lon: 26.1123 },
  { name: 'București, Sector 5', lat: 44.4002, lon: 26.0650 }, { name: 'București, Sector 6', lat: 44.4306, lon: 26.0322 },
  { name: 'Cluj-Napoca', lat: 46.7712, lon: 23.6236 },
  { name: 'Iași', lat: 47.1585, lon: 27.6014 }, { name: 'Timișoara', lat: 45.7489, lon: 21.2087 },
  { name: 'Constanța', lat: 44.1598, lon: 28.6348 }, { name: 'Craiova', lat: 44.3302, lon: 23.7949 },
  { name: 'Brașov', lat: 45.6427, lon: 25.5887 }, { name: 'Galați', lat: 45.4353, lon: 28.008 },
  { name: 'Ploiești', lat: 44.9419, lon: 26.0225 }, { name: 'Oradea', lat: 47.0465, lon: 21.9189 },
  { name: 'Sibiu', lat: 45.7983, lon: 24.1256 }, { name: 'Pitești', lat: 44.8565, lon: 24.8692 },
];

const NUM = '(\\d+(?:[.,]\\d+)?)';
const n = (s: string) => parseFloat(s.replace(',', '.'));

/** cât cântărește produsul (g sau ml), din nume și unitate; null dacă nu reiese */
export function gramsOf(name: string, unit: string, ingUnit?: string, gpp = 50): number | null {
  const t = `${name} ${unit}`.toLowerCase().replace(/gr\./g, 'g ');
  let v: number; let u: string; let mult = 1;
  const a = new RegExp(`(\\d+)\\s*[x*]\\s*${NUM}\\s*(kg|g|gr|ml|l)\\b`).exec(t);
  const b = new RegExp(`${NUM}\\s*(kg|g|gr|ml|l)\\s*[x*]\\s*(\\d+)`).exec(t);
  if (a) { mult = +a[1]; v = n(a[2]); u = a[3]; } else if (b) { v = n(b[1]); u = b[2]; mult = +b[3]; } else {
    const m = new RegExp(`${NUM}\\s*(kg|kilogram|g|gr|grame|ml|l|litri|ltr)\\b`).exec(t);
    if (!m) {
      if (ingUnit === 'buc') {
        const p = /(\d+)\s*(buc|bucati|oua|ou|x)\b/.exec(t);
        if (p) return +p[1] * gpp;
      }
      return /\bkg\b|\/kg|kilogram|vrac|\bk\b/.test(t) ? 1000 : null;
    }
    v = n(m[1]); u = m[2];
  }
  const g = v * (['kg', 'kilogram', 'l', 'litri', 'ltr'].includes(u) ? 1000 : 1) * mult;
  return g >= 5 && g <= 25000 ? g : null;
}

const MAP = PRICE_MAP as unknown as Record<string, [string, string, string]>;

async function text(url: string, signal?: AbortSignal) {
  const r = await fetch(url, { signal, headers: { Accept: 'application/xml' } });
  if (!r.ok) throw new Error(`Serverul de prețuri a răspuns ${r.status}`);
  return r.text();
}

/** produsele din catalog pentru un ingredient (dacă nu le am deja) */
async function searchProducts(iid: string, signal?: AbortSignal): Promise<number[]> {
  const m = MAP[iid];
  if (!m) return [];
  const [q, inc, exc] = m;
  const xml = await text(`${BASE}/GetCatalogProductsByNameNetwork?prodname=${encodeURIComponent(q)}`, signal);
  const out: { pid: number; has: boolean }[] = [];
  const re = /<CatalogProduct>[\s\S]*?<Id>(\d+)<\/Id>[\s\S]*?<Name>([\s\S]*?)<\/Name>/g;
  let x: RegExpExecArray | null;
  while ((x = re.exec(xml))) {
    const low = x[2].toLowerCase();
    if (inc && !new RegExp(inc).test(low)) continue;
    if (exc && new RegExp(exc).test(low)) continue;
    out.push({ pid: +x[1], has: /\d+(?:[.,]\d+)?\s*(kg|g|gr|ml|l)\b|\/kg|\bkg\b|vrac/.test(low) });
  }
  return out.sort((p, q2) => Number(q2.has) - Number(p.has)).slice(0, 24).map((p) => p.pid);
}

export async function fetchLivePrices(area: { name: string; lat: number; lon: number }, known: Record<string, number[]>,
  onProgress: (msg: string, pct: number) => void, signal?: AbortSignal): Promise<{ live: LivePrices; products: Record<string, number[]> }> {
  const products: Record<string, number[]> = { ...(PRICE_PRODUCTS as { products: Record<string, number[]> }).products, ...known };
  const missing = Object.keys(MAP).filter((k) => !products[k]?.length && ING[k]);
  for (let i = 0; i < missing.length; i++) {
    onProgress(`Caut produsele (${i + 1}/${missing.length})`, (i / missing.length) * 0.3);
    try { products[missing[i]] = await searchProducts(missing[i], signal); } catch { /* sar peste */ }
  }
  const byPid = new Map<number, string[]>();
  for (const [iid, ids] of Object.entries(products)) for (const p of ids) byPid.set(p, [...(byPid.get(p) ?? []), iid]);
  const ids = [...byPid.keys()];
  const obs = new Map<string, Map<number, number[]>>(); // `${iid}|${net}` -> pid -> preț/kg
  const stores = new Set<string>();
  const B = 120;
  for (let k = 0; k < ids.length; k += B) {
    onProgress('Iau prețurile din magazinele din jur', 0.3 + (k / ids.length) * 0.7);
    const xml = await text(`${BASE}/GetStoresForProductsByLatLon?lat=${area.lat}&lon=${area.lon}&buffer=1500&csvprodids=${ids.slice(k, k + B).join(',')}&OrderBy=price`, signal);
    for (const st of xml.split('<RetailStore>').slice(1)) {
      const sid = /<Distance>[\s\S]*?<\/Distance><Id>(\d+)<\/Id>/.exec(st)?.[1];
      if (sid) stores.add(sid);
      for (const p of st.split('<Product>').slice(1)) {
        const net = /<Networkid>([^<]*)<\/Networkid>/.exec(p)?.[1] ?? '';
        const store = NET[net];
        const price = parseFloat(/<Price>([^<]*)<\/Price>/.exec(p)?.[1] ?? '0');
        if (!store || !price) continue;
        const cat = /<Catprod><Id>(\d+)<\/Id><Name>([^<]*)<\/Name>/.exec(p);
        if (!cat) continue;
        const pid = +cat[1];
        const unit = /<Unit>([^<]*)<\/Unit>/.exec(p)?.[1] ?? '';
        const own = /<\/Catprod><Id>\d+<\/Id><Name>([^<]*)<\/Name>/.exec(p)?.[1] ?? '';
        for (const iid of byPid.get(pid) ?? []) {
          const ing = ING[iid];
          if (!ing) continue;
          const g = gramsOf(`${cat[2]} ${own}`, unit, ing.unit, ing.gPerPiece ?? 50);
          if (!g) continue;
          const perKg = (price / g) * 1000;
          const est = (ing.price / ing.pkg) * 1000;
          if (perKg < est * 0.25 || perKg > est * 4) continue; // alt produs decât credem
          const key = `${iid}|${store}`;
          const m = obs.get(key) ?? new Map<number, number[]>();
          m.set(pid, [...(m.get(pid) ?? []), perKg]);
          obs.set(key, m);
        }
      }
    }
  }
  const prices: LivePrices['prices'] = {};
  const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  for (const [key, per] of obs) {
    const [iid, store] = key.split('|') as [string, StoreId];
    const vals = [...per.values()].map(med).sort((a, b) => a - b);
    const q = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.3))];
    (prices[store] ??= {})[iid] = Math.round(q * ING[iid].pkg / 10) / 100;
  }
  onProgress('Gata', 1);
  return { live: { fetchedAt: new Date().toISOString(), area, prices, stats: { products: ids.length, stores: stores.size } }, products };
}
