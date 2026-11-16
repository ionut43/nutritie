/*
 * Recunoașterea farfuriei: CLIP (OpenAI, licență MIT) rulat pe telefon.
 * Descrierile tuturor rețetelor și alimentelor sunt transformate dinainte în vectori (scripts/build_vision.py);
 * pe telefon rulează doar encoderul de imagine și se caută descrierea cea mai apropiată.
 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeB64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]), b = B64.indexOf(clean[i + 1]);
    const c = B64.indexOf(clean[i + 2]), d = B64.indexOf(clean[i + 3]);
    out[o++] = (a << 2) | (b >> 4);
    if (c >= 0 && o < out.length) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0 && o < out.length) out[o++] = ((c & 3) << 6) | d;
  }
  return out;
}

export interface LabelSet { ids: string[]; dim: number; T: Float32Array; I: Float32Array; hasImg: boolean[] }

type Q8 = { scale: number; data: string };

function dequant(q8: Q8, rows: number, dim: number): { M: Float32Array; nonzero: boolean[] } {
  const bytes = decodeB64(q8.data);
  const q = new Int8Array(bytes.buffer, bytes.byteOffset, rows * dim);
  const M = new Float32Array(q.length);
  const nonzero: boolean[] = [];
  for (let r = 0; r < rows; r++) {
    let n = 0;
    for (let k = 0; k < dim; k++) { const v = q[r * dim + k] * q8.scale; M[r * dim + k] = v; n += v * v; }
    nonzero.push(n > 1e-6);
    n = Math.sqrt(n) || 1;
    for (let k = 0; k < dim; k++) M[r * dim + k] /= n;
  }
  return { M, nonzero };
}

export function loadLabels(json: { ids: string[]; dim: number; text: Q8; image: Q8 }): LabelSet {
  const t = dequant(json.text, json.ids.length, json.dim);
  const i = dequant(json.image, json.ids.length, json.dim);
  return { ids: json.ids, dim: json.dim, T: t.M, I: i.M, hasImg: i.nonzero };
}

/** cât contează potrivirea cu poza rețetei față de descriere (ales pe pozele de test, vezi scripts/eval_vision.py) */
export const IMAGE_WEIGHT = 0.4;

function zscores(v: number[], mask?: boolean[]): number[] {
  const xs = mask ? v.filter((_, k) => mask[k]) : v;
  const m = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / Math.max(1, xs.length)) || 1;
  return v.map((x) => (x - m) / sd);
}

/**
 * Scorul fiecărei etichete: potrivirea cu descrierea (text) plus, unde există, potrivirea cu poza rețetei.
 * Cele două se aduc pe aceeași scară (z-score), apoi se transformă în probabilități.
 */
export function rankLabels(img: ArrayLike<number>, labels: LabelSet, k = 5, allow?: (id: string) => boolean, w = IMAGE_WEIGHT): { id: string; p: number }[] {
  let norm = 0;
  for (let i = 0; i < labels.dim; i++) norm += img[i] * img[i];
  norm = Math.sqrt(norm) || 1;
  const rows: number[] = [];
  for (let r = 0; r < labels.ids.length; r++) if (!allow || allow(labels.ids[r])) rows.push(r);
  const st: number[] = [], si: number[] = [], has: boolean[] = [];
  for (const r of rows) {
    let a = 0, b = 0;
    for (let i = 0; i < labels.dim; i++) { a += labels.T[r * labels.dim + i] * img[i]; b += labels.I[r * labels.dim + i] * img[i]; }
    st.push(a / norm); si.push(b / norm); has.push(labels.hasImg[r]);
  }
  const zt = zscores(st);
  const zi = has.some(Boolean) ? zscores(si, has) : zt;
  const score = rows.map((_, k2) => (zt[k2] + w * (has[k2] ? zi[k2] : zt[k2])) / (1 + w));
  const max = Math.max(...score);
  const ex = score.map((s) => Math.exp(4 * (s - max)));
  const sum = ex.reduce((a, b) => a + b, 0);
  return rows.map((r, k2) => ({ id: labels.ids[r], p: ex[k2] / sum })).sort((a, b) => b.p - a.p).slice(0, k);
}

/**
 * Poarta „e mâncare?”: poza se compară cu câteva descrieri de mâncare și câteva de lucruri care nu sunt
 * (capturi de ecran, documente, oameni, camere). Întoarce probabilitatea că e mâncare.
 * Pe pozele de test: mâncarea ≥ 0,8, o captură de chat ~0.
 */
export function foodProbability(img: ArrayLike<number>, gate: { food: number[][]; not: number[][] }): number {
  let norm = 0;
  for (let i = 0; i < img.length; i++) norm += img[i] * img[i];
  norm = Math.sqrt(norm) || 1;
  const cos = (v: number[]) => { let a = 0; for (let i = 0; i < v.length; i++) a += v[i] * img[i]; return (a / norm) * 100; };
  const f = gate.food.map(cos), n = gate.not.map(cos);
  const max = Math.max(...f, ...n);
  const sf = f.reduce((a, x) => a + Math.exp(x - max), 0);
  const sn = n.reduce((a, x) => a + Math.exp(x - max), 0);
  return sf / (sf + sn);
}
