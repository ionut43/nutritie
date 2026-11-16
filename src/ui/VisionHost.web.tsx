import ortJs from '../data/ortWasmJs';
import { crumb } from './diag';

/*
 * Varianta din browser (iPhone, din Safari): CLIP rulează direct în pagină, cu același onnxruntime-web (WebAssembly)
 * ca în WebView-ul de pe Android. Modelul și motorul stau în memoria Safari (Cache Storage), descărcate o singură dată.
 */
export function VisionHost() {
  return null;
}

const MEAN = [0.48145466, 0.4578275, 0.40821073];
const STD = [0.26862954, 0.26130258, 0.27577711];
export const VISION_CACHE = 'nutritie-vision-v1';

type Ort = {
  env: { wasm: { numThreads: number; proxy: boolean; wasmBinary?: ArrayBuffer } };
  InferenceSession: { create(m: Uint8Array, o: object): Promise<Session> };
  Tensor: new (t: string, d: Float32Array, s: number[]) => unknown;
};
type Session = { run(f: Record<string, unknown>): Promise<{ image_embeds: { data: Float32Array } }> };

let session: Promise<Session> | null = null;

function loadOrt(): Ort {
  const w = window as unknown as { ort?: Ort };
  if (!w.ort) {
    const s = document.createElement('script');
    s.textContent = ortJs; // scriptul clasic definește `var ort` global
    document.head.appendChild(s);
  }
  if (!w.ort) throw new Error('Motorul de recunoaștere nu a pornit în browserul ăsta.');
  return w.ort;
}

/** fișierul din memoria Safari (sau, dacă lipsește, de pe internet) */
export async function cachedBytes(url: string): Promise<ArrayBuffer> {
  const c = await caches.open(VISION_CACHE);
  const hit = await c.match(url);
  if (hit) return hit.arrayBuffer();
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Nu pot descărca ${url} (${r.status})`);
  await c.put(url, r.clone());
  return r.arrayBuffer();
}

function getSession(modelUrl: string, wasmUrl: string): Promise<Session> {
  if (session) return session;
  session = (async () => {
    const ort = loadOrt();
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmBinary = await cachedBytes(wasmUrl);
    const model = await cachedBytes(modelUrl);
    return ort.InferenceSession.create(new Uint8Array(model), { executionProviders: ['wasm'], graphOptimizationLevel: 'basic' });
  })();
  session.catch(() => { session = null; });
  return session;
}

function pixels(dataUrl: string): Promise<Float32Array> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = 224; c.height = 224;
      const g = c.getContext('2d');
      if (!g) { rej(new Error('nu pot citi poza')); return; }
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 224, 224);
      const d = g.getImageData(0, 0, 224, 224).data;
      const n = 224 * 224;
      const out = new Float32Array(3 * n);
      for (let i = 0; i < n; i++) {
        out[i] = (d[i * 4] / 255 - MEAN[0]) / STD[0];
        out[n + i] = (d[i * 4 + 1] / 255 - MEAN[1]) / STD[1];
        out[2 * n + i] = (d[i * 4 + 2] / 255 - MEAN[2]) / STD[2];
      }
      res(out);
    };
    img.onerror = () => rej(new Error('nu pot citi poza'));
    img.src = dataUrl;
  });
}

/** embedding CLIP (512) al pozei, în pagină */
export async function clipEmbedWeb(modelUrl: string, wasmUrl: string, dataUrl: string): Promise<number[]> {
  const t0 = Date.now();
  const s = await getSession(modelUrl, wasmUrl);
  const ort = loadOrt();
  const out = await s.run({ pixel_values: new ort.Tensor('float32', await pixels(dataUrl), [1, 3, 224, 224]) });
  crumb(`recunoaștere: gata în ${Date.now() - t0} ms`);
  return Array.from(out.image_embeds.data);
}
