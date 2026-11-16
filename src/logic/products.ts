import type { Aisle, Allergen, AnimalKind, Ingredient } from './types';
import { matchIngredient } from './receiptParser';

/** Răspunsul Open Food Facts (doar câmpurile folosite) */
export interface OffProduct {
  product_name?: string; product_name_ro?: string; brands?: string; quantity?: string;
  categories_tags?: string[]; allergens_tags?: string[];
  nutriments?: Record<string, number | string | undefined>;
}

const ALLERGEN_MAP: Record<string, Allergen> = {
  'en:gluten': 'gluten', 'en:crustaceans': 'crustacee', 'en:eggs': 'oua', 'en:fish': 'peste', 'en:peanuts': 'arahide',
  'en:soybeans': 'soia', 'en:milk': 'lapte', 'en:nuts': 'nuci', 'en:celery': 'telina', 'en:mustard': 'mustar',
  'en:sesame-seeds': 'susan', 'en:sulphur-dioxide-and-sulphites': 'sulfiti', 'en:lupin': 'lupin', 'en:molluscs': 'moluste',
};

export function guessAisle(cats: string[]): Aisle {
  const c = cats.join(' ');
  if (/frozen/.test(c)) return 'congelate';
  if (/fishes|seafood/.test(c)) return 'peste';
  if (/meats|sausages|hams|poultry/.test(c)) return 'carne';
  if (/dairies|cheeses|yogurts|milks/.test(c)) return 'lactate';
  if (/eggs/.test(c)) return 'oua';
  if (/breads|bakery/.test(c)) return 'panificatie';
  if (/cereals|pastas|rices|flours|legumes/.test(c)) return 'cereale';
  if (/canned/.test(c)) return 'conserve';
  if (/fruits/.test(c) && !/juices/.test(c)) return 'fructe';
  if (/vegetables/.test(c)) return 'legume';
  if (/nuts|seeds/.test(c)) return 'nuci';
  if (/oils/.test(c)) return 'uleiuri';
  if (/sauces|condiments|spices/.test(c)) return 'condimente';
  return 'altele';
}

function guessAnimal(cats: string[], allergens: Allergen[]): AnimalKind | undefined {
  const c = cats.join(' ');
  if (/en:meats|en:sausages|en:hams|en:poultry/.test(c)) return 'carne';
  if (/en:fishes|en:seafood/.test(c) || allergens.includes('peste')) return 'peste';
  if (/en:dairies|en:cheeses|en:yogurts|en:milks/.test(c) || allergens.includes('lapte')) return 'lactate';
  if (/en:eggs/.test(c) || allergens.includes('oua')) return 'oua';
  if (/en:honeys/.test(c)) return 'miere';
  return undefined;
}

export function parseQuantity(q?: string): number | undefined {
  if (!q) return undefined;
  const m = /(\d+(?:[.,]\d+)?)\s*(kg|g|gr|l|ml|cl)\b/i.exec(q);
  if (!m) return undefined;
  const v = parseFloat(m[1].replace(',', '.'));
  const u = m[2].toLowerCase();
  return u === 'kg' || u === 'l' ? v * 1000 : u === 'cl' ? v * 10 : v;
}

const num = (x: unknown) => (typeof x === 'number' ? x : typeof x === 'string' ? parseFloat(x) : NaN);

/** Produs scanat → ingredient al aplicației (valorile sunt la 100 g, ca în restul bazei) */
export function offToIngredient(code: string, p: OffProduct, price?: number): Ingredient | null {
  const n = p.nutriments ?? {};
  const kcal = num(n['energy-kcal_100g']) || (num(n['energy_100g']) ? num(n['energy_100g']) / 4.184 : NaN);
  if (!Number.isFinite(kcal)) return null;
  const cats = p.categories_tags ?? [];
  const allergens = [...new Set((p.allergens_tags ?? []).map((a) => ALLERGEN_MAP[a]).filter(Boolean))] as Allergen[];
  const name = [p.product_name_ro || p.product_name, p.brands?.split(',')[0]].filter(Boolean).join(' – ') || `Produs ${code}`;
  const pkg = parseQuantity(p.quantity) ?? 100;
  const v = (k: string) => { const x = num(n[k]); return Number.isFinite(x) ? Math.round(x * 10) / 10 : 0; };
  return {
    id: `p_${code}`, name, aisle: guessAisle(cats), kcal: Math.round(kcal), p: v('proteins_100g'), c: v('carbohydrates_100g'),
    f: v('fat_100g'), fib: v('fiber_100g'), sug: v('sugars_100g'), salt: v('salt_100g'), allergens, animal: guessAnimal(cats, allergens),
    unit: /\b(ml|l|cl)\b/i.test(p.quantity ?? '') ? 'ml' : 'g', pkg, price: price ?? 0, shelfDays: 30, barcode: code,
  };
}

/** Ingredientul din rețete cu care seamănă produsul (ca să-l folosească planificatorul) */
export function suggestIngredient(p: OffProduct): string | undefined {
  return matchIngredient([p.product_name_ro, p.product_name, ...(p.categories_tags ?? []).map((c) => c.replace(/^\w+:/, '').replace(/-/g, ' '))].filter(Boolean).join(' '));
}

export async function fetchProduct(code: string): Promise<OffProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_ro,brands,quantity,nutriments,categories_tags,allergens_tags`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Nutritie/1.0 (aplicatie personala)' } });
  if (!res.ok) return null;
  const j = await res.json();
  return j?.status === 1 ? (j.product as OffProduct) : null;
}
