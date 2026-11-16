import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import embeddings from '../data/vision_embeddings.json';
import gate from '../data/vision_gate.json';
import { foodProbability, loadLabels, rankLabels, type LabelSet } from '../logic/vision';
import { crumb } from './diag';
import { clipEmbedWeb, VISION_CACHE } from './VisionHost.web';

/*
 * Varianta din Safari: același model CLIP (MIT, ~89 MB) și același motor WebAssembly (~15 MB) ca în aplicația de Android,
 * descărcate o singură dată în memoria browserului. Pozele nu pleacă de pe telefon.
 */
const MODEL_URL = 'https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/onnx/vision_model_quantized.onnx';
const MODEL_BYTES = 89_117_001;
const WASM_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/ort-wasm-simd-threaded.wasm';
const WASM_BYTES = 14_848_852;
const FLAG = 'nutritie-vision-ready';

let labels: LabelSet | null = null;

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* nimic */ } };

export function visionCrashedBefore(): boolean { return false; }
export function resetVisionGuard() { /* în browser nu există */ }

export function visionSupported(): boolean {
  return typeof WebAssembly !== 'undefined' && typeof caches !== 'undefined';
}

export function modelReady(): boolean {
  return get(FLAG) === '1';
}

export function downloadSizeMB(): number {
  return Math.round((MODEL_BYTES + WASM_BYTES) / 1e6);
}

async function fetchTo(cache: Cache, url: string, bytes: number, onBytes: (n: number) => void) {
  if (await cache.match(url)) { onBytes(bytes); return; }
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error('Descărcarea nu s-a terminat. Încearcă din nou pe Wi-Fi.');
  const reader = r.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onBytes(got);
  }
  if (got < bytes * 0.98) throw new Error('Descărcarea nu s-a terminat. Încearcă din nou pe Wi-Fi.');
  await cache.put(url, new Response(new Blob(parts as BlobPart[]), { headers: { 'Content-Type': 'application/octet-stream' } }));
}

export async function downloadModel(onProgress: (pct: number) => void): Promise<void> {
  try { await navigator.storage?.persist?.(); } catch { /* nimic */ }
  const cache = await caches.open(VISION_CACHE);
  const total = MODEL_BYTES + WASM_BYTES;
  await fetchTo(cache, WASM_URL, WASM_BYTES, (n) => onProgress(Math.min(1, n / total)));
  await fetchTo(cache, MODEL_URL, MODEL_BYTES, (n) => onProgress(Math.min(1, (WASM_BYTES + n) / total)));
  set(FLAG, '1');
}

export async function recognizePlate(uri: string, allow?: (id: string) => boolean) {
  if (!modelReady()) throw new Error('Modelul nu este descărcat.');
  const c = await caches.open(VISION_CACHE);
  if (!(await c.match(MODEL_URL)) || !(await c.match(WASM_URL))) {
    set(FLAG, null); // Safari a golit memoria: se descarcă din nou
    throw new Error('Modelul nu mai e în memoria telefonului. Descarcă-l din nou.');
  }
  if (!labels) labels = loadLabels(embeddings as Parameters<typeof loadLabels>[0]);
  crumb('recunoaștere: micșorez poza');
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 336 });
  const img = await ctx.renderAsync();
  const small = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.92, base64: true });
  const dataUrl = small.base64 ? `data:image/jpeg;base64,${small.base64}` : small.uri;
  crumb('recunoaștere: rulez modelul');
  const emb = await clipEmbedWeb(MODEL_URL, WASM_URL, dataUrl);
  if (!emb || emb.length !== 512) throw new Error('Recunoașterea a eșuat. Încearcă o poză mai clară.');
  const pf = foodProbability(emb, gate as { food: number[][]; not: number[][] });
  crumb(`recunoaștere: mâncare ${Math.round(pf * 100)}%`);
  if (pf < 0.4) throw new Error('Nu pare să fie mâncare în poza asta. Fă o poză farfuriei, de aproape, sau caută ce ai mâncat.');
  return rankLabels(emb, labels, 6, allow);
}
