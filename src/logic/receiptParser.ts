import { ING } from '../data/ingredients';
import { norm, toNum } from './ocr';

export interface ReceiptItem {
  raw: string;
  name: string;
  total: number;
  qty?: number;
  unit?: 'buc' | 'kg';
  unitPrice?: number;
  /** grame deduse din bon sau din denumire */
  grams?: number;
  /** ingredientul propus */
  ingId?: string;
  /** ce fel de produs e: mâncare (în cămară), altă mâncare/băutură (dulciuri, suc) sau nu e mâncare (detergent, hârtie, vase) */
  kind: ItemKind;
}

export type ItemKind = 'aliment' | 'altele' | 'nealimentar';

/*
 * Pe același bon sunt și lucruri care nu se mănâncă: ele nu intră în cămară și nu se socotesc la mâncare.
 * Cuvintele sunt cele de pe bonurile din România (prescurtate cum le scriu casele de marcat).
 */
const NON_FOOD = /(DETERG|ARIEL|PERSIL|\bDERO\b|BONUX|\bDASH\b|\bTIDE\b|BALSAM.*RUF|LENOR|COCCOLINO|SILAN|CALGON|VANISH|FAIRY|\bPUR\b.*(VASE|BALSAM|GEL)|\bJAR\b.*VASE|PRONTO|DOMESTOS|CIF\b|MR\.? ?PROPER|\bCLOR|INALBITOR|ODORIZ|SPRAY.*(CASA|MOBIL|GEAM|INSECT|PARFUM|CAMERA)|INSECTIC|HARTIE.*(IGIEN|COPT)|H\.? ?IGIEN|PROSOP.*HART|ROLA.*HART|SERVET|BATISTE|SAPUN|SAMPON|SHAMPOO|GEL.*DUS|DEODOR|ANTIPERSP|PASTA.*DINTI|PERIUT|COLGATE|BLEND-?A|SENSODYNE|SCUTEC|PAMPERS|HUGGIES|ABSORB|TAMPOAN|ALWAYS|DISCHETE|BETISOARE|LAME|GILLETTE|SPUMA.*RAS|CREMA.*(MAINI|FATA|CORP)|BURETE|LAVET|MOP|\bMATURA\b|SACI?\b.*(MENAJ|GUNOI)|SAC.*GUNOI|PUNGA|SACOSA|FOLIE.*(ALIM|ALUMIN)|CASOLET|PAHAR.*PLAST|FARFURI.*(UNIC|CARTON|PLAST)|TACAMURI|BATERI|ACUMULATOR|\bBEC\b|LUMANAR|CHIBRIT|BRICHET|TIGARI|TIGARETE|\bIQOS|HEETS|TERREA|NISIP.*PISIC|ASTERNUT|HRANA.*(PISIC|CAINI|CAINE)|WHISKAS|PEDIGREE|FRISKIES|PURINA|FELIX|SHEBA|ROYAL CANIN|OALA|TIGAIE|CRATITA|CUTIT|SPATULA|POLONIC|RAZATOARE|CASEROL|RECIPIENT|CUTIE.*DEPOZ|GARANTIE|SGR|AMBALAJ)/;
/** băuturi: sunt mâncare, dar nu ingrediente („SUC PORTOCALE” nu e portocale) */
const DRINK = /(\bSUC\b|NECTAR|\bAPA\b|AQUA|BORSEC|DORNA|COLA\b|PEPSI|FANTA|SPRITE|SCHWEPPES|ENERGIZ|RED ?BULL|\bBERE\b|\bVIN\b|CAFEA|ESPRESSO|NESCAFE|\bCEAI\b|LIMONAD|SMOOTHIE)/;

export function itemKind(name: string, ingId?: string): ItemKind {
  const n = norm(name);
  if (NON_FOOD.test(n)) return 'nealimentar';
  // ce nu e ingredient de gătit dar nici detergent (dulciuri, suc, cafea, salam): tot mâncare, doar că nu intră în cămară
  return ingId ? 'aliment' : 'altele';
}

const PRICE_END = /(-?\d{1,4}[.,]\d{2})\s*[A-Z]?\s*$/;
const QTY = /(?:^|\s)(\d{1,3}(?:[.,]\d{1,3})?)\s*(BUC|BC|KG|KGM)?\s*[X*]\s*(\d{1,4}[.,]\d{2})/;
const SKIP = /(TOTAL|SUBTOTAL|TVA|CARD|NUMERAR|CASH|REST\b|BON FISCAL|C\.?I\.?F|COD FISCAL|NR\.?\s*BON|PLATA|DATA|ORA|CASIER|CASA|MULTUMIM|PUNCTE|SUMA|ACHITAT|VISA|MASTERCARD|LEI\s*$)/;

/** denumiri de pe bonuri → ingredient (ordinea contează: întâi cele mai specifice) */
const MAP: [RegExp, string][] = [
  [/UNT.*ARAHID|PEANUT/, 'unt_arahide'], [/PIEPT.*CURCAN.*(FEL|SUNCA)|SUNCA.*CURCAN|CURCAN.*FELI/, 'sunca_curcan'],
  [/PIEPT.*PUI|FILE.*PUI|PUI.*PIEPT/, 'pui_piept'], [/PULP.*PUI|PUI.*PULP|PUI.*DEZOS/, 'pui_pulpe'], [/FICAT/, 'ficat_pui'],
  [/TOCAT.*CURCAN|CURCAN.*TOCAT/, 'tocata_curcan'], [/PIEPT.*CURCAN|CURCAN/, 'curcan_piept'],
  [/TOCAT.*VIT|VIT.*TOCAT/, 'tocata_vita'], [/TOCAT/, 'tocata_mixta'], [/CEAFA/, 'ceafa_porc'], [/MUSCHI/, 'muschi_porc'],
  [/VITA|VITEL/, 'vita_pulpa'], [/CARNATI|CIRNATI|CABANOS/, 'carnati'], [/COSTITA|BACON|SLANINA/, 'costita'],
  [/SOMON/, 'somon'], [/PASTRAV/, 'pastrav'], [/MACROU|SCRUMBIE/, 'macrou'], [/\bCOD\b|MERLUCIU|HEK|PANGASIUS/, 'cod'],
  [/CREVETI/, 'creveti'], [/SARDIN/, 'sardine'], [/\bTON\b/, 'ton'],
  [/\bOUA\b|\bOUE\b|OUA /, 'oua'], [/(LAPTE|BAUTURA).*(SOIA|SOYA)/, 'lapte_soia'], [/KEFIR|\bSANA\b|LAPTE BATUT/, 'kefir'],
  [/IAURT.*GREC|GREEK/, 'iaurt_grec'], [/IAURT/, 'iaurt'], [/BR.*VACI/, 'branza_vaci'], [/RICOTTA/, 'ricotta'],
  [/CREMA.*BRANZ|PHILADELPHIA|CREMA DE BR/, 'crema_branza'], [/TELEMEA|\bFETA\b/, 'telemea'],
  [/MOZZARELLA/, 'mozzarella'], [/PARMEZAN|PARMIGIANO|GRANA/, 'parmezan'], [/CASCAVAL|GOUDA|EDAM|CHEDDAR|SVAIT/, 'cascaval'],
  [/SMANTANA/, 'smantana'], [/\bUNT\b/, 'unt'], [/LAPTE/, 'lapte'], [/TOFU/, 'tofu'],
  [/ULEI.*MASLIN|OLIVE/, 'ulei_masline'], [/ULEI/, 'ulei'], [/FAINA/, 'faina'], [/OREZ/, 'orez'],
  [/PASTE|SPAGHET|PENNE|FUSILLI|TAGLIATELL|MACAROANE|FARFALLE|LASAGN/, 'paste'], [/OVAZ/, 'ovaz'], [/MALAI|MAMALIG/, 'malai'],
  [/BULGUR/, 'bulgur'], [/CUSCUS|COUSCOUS/, 'cuscus'], [/QUINOA/, 'quinoa'], [/HRISCA/, 'hrisca'], [/\bGRIS\b/, 'gris'], [/PESMET/, 'pesmet'],
  [/PAINE.*INTEGR|INTEGRAL|GRAHAM/, 'paine_integrala'], [/LIPII|TORTILLA|WRAP/, 'tortilla'], [/PAINE|BAGHET|FRANZEL|CHIFL/, 'paine'],
  [/CARTOF.*DULC|BATAT/, 'cartofi_dulci'], [/CARTOF/, 'cartofi'], [/CEAPA.*VERDE/, 'ceapa_verde'], [/CEAPA/, 'ceapa'], [/PRAZ/, 'praz'],
  [/USTUROI/, 'usturoi'], [/MORCOV/, 'morcov'], [/PASTARNAC/, 'pastarnac'], [/TELINA/, 'telina'], [/SFECLA/, 'sfecla'],
  [/ARDEI.*IUTE|CHILI/, 'ardei_iute'], [/ARDEI|GOGOSAR|KAPIA/, 'ardei'],
  [/ROSII.*(PASAT|CONSERV|TOCAT)|PASSATA|BULION|PULPA DE ROSII/, 'rosii_pasate'], [/PASTA.*(TOMAT|ROSII)/, 'pasta_tomate'],
  [/ROSII|TOMATE|CHERRY/, 'rosii'], [/CASTRAVE/, 'castraveti'], [/RIDICH/, 'ridichi'], [/DOVLECE|ZUCCHIN/, 'dovlecei'],
  [/DOVLEAC/, 'dovleac'], [/VINETE/, 'vinete'], [/VARZA.*ROSI/, 'varza_rosie'], [/VARZA.*MURAT/, 'varza_murata'], [/VARZA/, 'varza'],
  [/CONOPID/, 'conopida'], [/BROCCOLI/, 'broccoli'], [/SPANAC/, 'spanac'], [/CIUPERC|CHAMPIGNON/, 'ciuperci'],
  [/SALATA (VERDE|ICEBERG)|LAPTUC|ICEBERG/, 'salata'], [/RUCOLA|RUCOLLA/, 'rucola'], [/PATRUNJEL/, 'patrunjel'], [/MARAR/, 'marar'],
  [/LEUSTEAN/, 'leustean'], [/BUSUIOC/, 'busuioc_verde'], [/AVOCADO/, 'avocado'], [/MAZARE/, 'mazare'],
  [/FASOLE.*VERDE|PASTAI/, 'fasole_verde'], [/FASOLE.*ROSI|KIDNEY/, 'fasole_rosie'], [/FASOLE/, 'fasole_conserva'],
  [/NAUT/, 'naut'], [/LINTE/, 'linte'], [/PORUMB/, 'porumb'], [/MASLINE/, 'masline'], [/\bBORS\b/, 'bors'], [/SOS.*SOIA|SOIA/, 'sos_soia'],
  [/BANAN/, 'banana'], [/\bMERE\b|\bMAR\b/, 'mar'], [/\bPERE\b|\bPARA\b/, 'pere'], [/PORTOCAL/, 'portocale'], [/KIWI/, 'kiwi'],
  [/STRUGUR/, 'struguri'], [/LAMAI/, 'lamaie'], [/FRUCTE.*PADURE|AFINE|ZMEUR|MURE/, 'fructe_padure'], [/CAPSUN/, 'capsuni'],
  [/PRUNE.*USCAT/, 'prune_uscate'], [/STAFIDE/, 'stafide'], [/\bNUCI\b|MIEZ.*NUC/, 'nuci'], [/MIGDAL/, 'migdale'], [/ALUNE/, 'alune'],
  [/SEMINTE.*DOVLEAC/, 'seminte_dovleac'], [/SEMINTE/, 'seminte_floarea'], [/CHIA/, 'chia'], [/TAHINI/, 'tahini'],
  [/MIERE/, 'miere'], [/ZAHAR/, 'zahar'], [/\bGEM\b|DULCEATA/, 'gem'], [/CACAO/, 'cacao'], [/CIOCOLAT/, 'ciocolata'],
  [/MUSTAR/, 'mustar'], [/MAIONEZ/, 'maioneza'], [/KETCHUP/, 'ketchup'],
];

export function matchIngredient(name: string): string | undefined {
  const n = norm(name);
  for (const [re, id] of MAP) if (re.test(n) && ING[id]) return id;
  return undefined;
}

/** grame din denumire: „LAPTE 1,5% 1L”, „PASTE 500G” */
function gramsFromName(n: string): number | undefined {
  const m = /(\d{1,4}(?:[.,]\d{1,3})?)\s*(KG|G|GR|L|ML)\b/.exec(n.replace(/\d+[.,]?\d*\s*%/g, ''));
  if (!m) return undefined;
  const v = toNum(m[1]);
  return m[2] === 'KG' || m[2] === 'L' ? v * 1000 : v;
}

export function parseReceipt(rows: string[]): ReceiptItem[] {
  const items: ReceiptItem[] = [];
  let pending: { qty: number; unit?: 'buc' | 'kg'; unitPrice: number } | null = null;
  const finish = (it: Omit<ReceiptItem, 'kind'> & { kind?: ItemKind }) => {
    const nonFood = NON_FOOD.test(norm(it.name));
    it.ingId = nonFood || (DRINK.test(norm(it.name)) && !/OTET/.test(norm(it.name))) ? undefined : matchIngredient(it.name);
    it.kind = itemKind(it.name, it.ingId);
    const inName = gramsFromName(it.name);
    if (it.unit === 'kg' && it.qty) it.grams = Math.round(it.qty * 1000);
    else if (inName) it.grams = Math.round(inName * (it.qty ?? 1));
    else if (it.ingId) it.grams = Math.round(ING[it.ingId].pkg * (it.qty ?? 1));
    items.push(it as ReceiptItem);
  };
  const cleanName = (x: string) => x.replace(/[^A-Z0-9%.,\s-]/g, ' ').replace(/\b\d{5,}\b/g, '').replace(/\s{2,}/g, ' ').trim();

  for (const raw of rows) {
    const n = norm(raw).replace(/\s+/g, ' ').trim();
    if (!n) continue;
    const q = QTY.exec(n);
    if (q) {
      const qty = toNum(q[1]);
      const unit: 'buc' | 'kg' = /KG/.test(q[2] ?? '') || /\d[.,]\d{3}/.test(q[1]) ? 'kg' : 'buc';
      const info = { qty, unit, unitPrice: toNum(q[3]) };
      const before = cleanName(n.slice(0, q.index));
      const tail = n.slice(q.index + q[0].length);
      const tp = PRICE_END.exec(tail);
      if (/[A-Z]{3,}/.test(before) && !SKIP.test(before)) {
        // totul pe un rând: „PIEPT PUI 0,856 KG X 32,99 28,24 B”
        finish({ raw, name: before, total: tp ? toNum(tp[1]) : Math.round(qty * info.unitPrice * 100) / 100, ...info });
        pending = null;
        continue;
      }
      const last = items[items.length - 1];
      if (last && last.qty === undefined && Math.abs(last.total - qty * info.unitPrice) < 0.06 + last.total * 0.02) {
        Object.assign(last, info);
        if (unit === 'kg') last.grams = Math.round(qty * 1000);
        else if (last.ingId && !/\d\s*(KG|G|GR|L|ML)\b/.test(last.name)) last.grams = Math.round(ING[last.ingId].pkg * qty);
      } else pending = info;
      continue;
    }
    if (SKIP.test(n)) { pending = null; continue; }
    const p = PRICE_END.exec(n);
    if (!p) continue;
    const total = toNum(p[1]);
    const name = cleanName(n.slice(0, p.index));
    if (total < 0 || /DISCOUNT|REDUCERE|RED\.|PROMO/.test(name)) {
      const last = items[items.length - 1];
      if (last) last.total = Math.max(0, Math.round((last.total + total) * 100) / 100);
      continue;
    }
    if (!/[A-Z]{3,}/.test(name)) continue;
    const it: Omit<ReceiptItem, 'kind'> = { raw, name, total };
    if (pending && Math.abs(pending.qty * pending.unitPrice - total) < 0.06 + total * 0.02) Object.assign(it, pending);
    pending = null;
    finish(it);
  }
  return items;
}

/** prețul pe ambalajul standard al ingredientului, din ce ai plătit */
export function pricePerPackage(item: ReceiptItem): number | undefined {
  if (!item.ingId || !item.grams || item.total <= 0) return undefined;
  return Math.round(((item.total / item.grams) * ING[item.ingId].pkg) * 10) / 10;
}

/** cât din bon e mâncare și cât nu (detergent, hârtie, vase…); diferența până la total se socotește mâncare */
export function splitReceipt(items: Pick<ReceiptItem, 'kind' | 'total'>[], paid?: number): { food: number; other: number; nonFood: number; total: number } {
  const sum = (k: ItemKind) => Math.round(items.filter((i) => i.kind === k).reduce((a, i) => a + i.total, 0) * 100) / 100;
  const nonFood = sum('nealimentar');
  const total = paid && paid > 0 ? paid : Math.round(items.reduce((a, i) => a + i.total, 0) * 100) / 100;
  const other = sum('altele');
  return { food: Math.max(0, Math.round((total - nonFood) * 100) / 100), other, nonFood, total };
}

/** totalul de plată de pe bon (rândul TOTAL), dacă se poate citi */
export function receiptTotal(rows: string[]): number | undefined {
  let best: number | undefined;
  for (const raw of rows) {
    const line = raw.toUpperCase();
    if (!/\bTOTAL\b/.test(line) || /SUBTOTAL|TVA|DISCOUNT|PUNCTE/.test(line)) continue;
    const nums = [...line.matchAll(/(\d{1,5}[.,]\d{2})\b/g)].map((m) => Number(m[1].replace(',', '.')));
    if (nums.length) best = Math.max(best ?? 0, nums[nums.length - 1]);
  }
  return best;
}
