import { norm, toNum } from './ocr';

/** Valori nutriționale la 100 g citite de pe etichetă */
export interface LabelValues {
  kcal?: number; p?: number; c?: number; f?: number; fib?: number; sug?: number; salt?: number;
  /** cantitatea din ambalaj, dacă apare (g sau ml) */
  netG?: number;
  /** cât de sigur e rezultatul: valorile se potrivesc între ele (kcal ≈ 4P + 4C + 9G) */
  confident: boolean;
  found: number;
}

const NUM = '(\\d{1,4}(?:[.,]\\d{1,2})?)';

// cuvinte-cheie în română, engleză și alte limbi des întâlnite pe ambalaje din UE
const KEYS: Record<'f' | 'c' | 'sug' | 'fib' | 'p' | 'salt', RegExp> = {
  f: /\b(GRASIMI|LIPIDE|FAT|GRASSI|FETT|MATIERES GRASSES|GRASAS)\b/,
  c: /\b(GLUCIDE|CARBOHIDRATI|CARBOHYDRATES?|HIDRATI DE CARBON|CARBOIDRATI|KOHLENHYDRATE|GLUCIDES|HIDRATOS)\b/,
  sug: /\b(ZAHARURI|ZAHAR|SUGARS?|ZUCCHERI|ZUCKER|SUCRES|AZUCARES)\b/,
  fib: /\b(FIBRE|FIBRA|FIBRES|FIBERS?|FIBRE ALIMENTARE|BALLASTSTOFFE)\b/,
  p: /\b(PROTEINE|PROTEINS?|PROTEINES|EIWEISS|PROTEINAS)\b/,
  salt: /\b(SARE|SALT|SALE|SALZ|SEL|SAL)\b/,
};

/** primul număr după cuvântul-cheie (coloana „la 100 g” e de obicei prima) */
function after(text: string, re: RegExp, from = 0): number | undefined {
  const sub = text.slice(from);
  const m = re.exec(sub);
  if (!m) return undefined;
  const rest = sub.slice(m.index + m[0].length, m.index + m[0].length + 60);
  const n = new RegExp(`${NUM}\\s*(?:G|GR)?\\b`).exec(rest.replace(/<\s*/g, ''));
  return n ? toNum(n[1]) : undefined;
}

export function parseNutritionLabel(rows: string[]): LabelValues {
  const text = norm(rows.join('\n')).replace(/[|]/g, ' ');
  const out: LabelValues = { confident: false, found: 0 };

  const kcal = /(\d{1,4}(?:[.,]\d)?)\s*KCAL/.exec(text);
  if (kcal) out.kcal = toNum(kcal[1]);
  else {
    const kj = /(\d{2,4}(?:[.,]\d)?)\s*KJ/.exec(text);
    if (kj) out.kcal = Math.round(toNum(kj[1]) / 4.184);
  }

  out.f = after(text, KEYS.f);
  // carbohidrații: primul „glucide” care nu e precedat de „din care”
  out.c = after(text, KEYS.c);
  out.sug = after(text, KEYS.sug);
  out.fib = after(text, KEYS.fib);
  out.p = after(text, KEYS.p);
  const salt = after(text, KEYS.salt);
  if (salt !== undefined) out.salt = salt;
  else {
    const na = after(text, /\b(SODIU|SODIUM)\b/);
    if (na !== undefined) out.salt = Math.round(na * 2.5 * 100) / 100;
  }

  const net = /(NET|NETA|CANTITATE|GREUTATE|CONTINUT|CONTENT)[^0-9]{0,25}(\d{2,4}(?:[.,]\d+)?)\s*(G|GR|ML|KG|L)\b/.exec(text);
  if (net) {
    const v = toNum(net[2]);
    out.netG = net[3] === 'KG' || net[3] === 'L' ? v * 1000 : v;
  } else {
    // altfel, cea mai mare cantitate de pe rânduri fără valori nutriționale sau porții
    let best = 0;
    for (const row of text.split('\n')) {
      if (Object.values(KEYS).some((re) => re.test(row)) || /PORTIE|PORTION|KCAL|KJ|100\s*(G|ML)/.test(row)) continue;
      for (const m of row.matchAll(/(\d{2,4}(?:[.,]\d+)?)\s*(G|GR|ML|KG|L)\b/g)) {
        const v = toNum(m[1]) * (m[2] === 'KG' || m[2] === 'L' ? 1000 : 1);
        if (v >= 50 && v > best) best = v;
      }
    }
    if (best) out.netG = best;
  }

  // valori imposibile la 100 g → ignorate
  for (const k of ['f', 'c', 'sug', 'fib', 'p', 'salt'] as const) {
    const v = out[k];
    if (v !== undefined && (v < 0 || v > 100)) out[k] = undefined;
  }
  if (out.kcal !== undefined && (out.kcal < 0 || out.kcal > 900)) out.kcal = undefined;
  if (out.sug !== undefined && out.c !== undefined && out.sug > out.c) out.sug = undefined;

  out.found = (['kcal', 'f', 'c', 'p'] as const).filter((k) => out[k] !== undefined).length
    + (['sug', 'fib', 'salt'] as const).filter((k) => out[k] !== undefined).length;
  if (out.kcal !== undefined && out.p !== undefined && out.c !== undefined && out.f !== undefined) {
    const est = 4 * out.p + 4 * out.c + 9 * out.f + 2 * (out.fib ?? 0);
    out.confident = Math.abs(est - out.kcal) <= Math.max(25, out.kcal * 0.2);
  }
  return out;
}
