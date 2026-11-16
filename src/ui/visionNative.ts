import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import embeddings from '../data/vision_embeddings.json';
import gate from '../data/vision_gate.json';
import { foodProbability, loadLabels, rankLabels, type LabelSet } from '../logic/vision';
import { crumb } from './diag';
import { clipEmbedWeb } from './VisionHost';

/*
 * Modelul de imagine (CLIP ViT-B/32, licență MIT, ~89 MB) și motorul WebAssembly (onnxruntime-web, MIT, ~15 MB)
 * se descarcă o singură dată, gratuit. Recunoașterea rulează pe telefon, într-un WebView invizibil,
 * fără internet după descărcare, și nicio poză nu pleacă de pe telefon.
 */
const MODEL_URL = 'https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/onnx/vision_model_quantized.onnx';
const MODEL_BYTES = 89_117_001;
const WASM_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/ort-wasm-simd-threaded.wasm';
const WASM_BYTES = 14_848_852;

const modelFile = () => new File(Paths.document, 'clip_vision_q8.onnx');
const wasmFile = () => new File(Paths.document, 'ort-wasm-simd-threaded-1.31.1.wasm');

let labels: LabelSet | null = null;

/*
 * Plasă de siguranță: înainte de recunoaștere las un semn pe telefon și îl șterg după.
 * Dacă aplicația se închide în timpul recunoașterii, la următoarea deschidere semnul e acolo,
 * așa că nu mai pornesc recunoașterea singur (alegi din plan sau cauți) până nu ceri tu.
 */
const guardFile = () => new File(Paths.document, 'vision_web_running.flag');
export function visionCrashedBefore(): boolean {
  try { return guardFile().exists; } catch { return false; }
}
export function resetVisionGuard() {
  try { const f = guardFile(); if (f.exists) f.delete(); } catch { /* nimic */ }
}

export function visionSupported(): boolean {
  return Platform.OS !== 'web';
}

const complete = (f: File, bytes: number) => { try { return f.exists && f.size >= bytes * 0.98; } catch { return false; } };
const modelOk = () => complete(modelFile(), MODEL_BYTES);
const wasmOk = () => complete(wasmFile(), WASM_BYTES);

export function modelReady(): boolean {
  return modelOk() && wasmOk();
}

/** cât mai e de descărcat (MB): după actualizare lipsește doar motorul, 15 MB */
export function downloadSizeMB(): number {
  return Math.round(((modelOk() ? 0 : MODEL_BYTES) + (wasmOk() ? 0 : WASM_BYTES)) / 1e6);
}

export async function downloadModel(onProgress: (pct: number) => void): Promise<void> {
  const parts = [
    ...(wasmOk() ? [] : [{ url: WASM_URL, file: wasmFile(), bytes: WASM_BYTES }]),
    ...(modelOk() ? [] : [{ url: MODEL_URL, file: modelFile(), bytes: MODEL_BYTES }]),
  ];
  const total = parts.reduce((a, p) => a + p.bytes, 0) || 1;
  let done = 0;
  for (const p of parts) {
    if (p.file.exists) p.file.delete();
    const task = File.createDownloadTask(p.url, p.file, {
      onProgress: ({ bytesWritten }) => onProgress(Math.min(1, (done + bytesWritten) / total)),
    });
    await task.downloadAsync();
    if (!complete(p.file, p.bytes)) throw new Error('Descărcarea nu s-a terminat. Încearcă din nou pe Wi-Fi.');
    done += p.bytes;
  }
}

/** Poza (orientată corect, micșorată) → CLIP pe telefon → cele mai probabile rețete / alimente */
export async function recognizePlate(uri: string, allow?: (id: string) => boolean) {
  if (!visionSupported()) throw new Error('Recunoașterea merge doar în aplicația instalată.');
  if (!modelReady()) throw new Error('Modelul nu este descărcat.');
  if (!labels) labels = loadLabels(embeddings as Parameters<typeof loadLabels>[0]);
  // micșorăm poza (păstrând proporțiile și orientarea); modulul nativ decupează pătratul din centru
  crumb('recunoaștere: micșorez poza');
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 336 });
  const img = await ctx.renderAsync();
  const small = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.92, base64: true });
  crumb('recunoaștere: rulez modelul');
  try { const g = guardFile(); if (!g.exists) g.create(); } catch { /* nimic */ }
  let emb: number[] | null;
  try {
    emb = await clipEmbedWeb(modelFile().uri, wasmFile().uri, `data:image/jpeg;base64,${small.base64}`);
  } finally {
    resetVisionGuard(); // o eroare obișnuită nu e o închidere a aplicației
  }
  if (!emb || emb.length !== 512) throw new Error('Recunoașterea a eșuat. Încearcă o poză mai clară.');
  const pf = foodProbability(emb, gate as { food: number[][]; not: number[][] });
  crumb(`recunoaștere: mâncare ${Math.round(pf * 100)}%`);
  if (pf < 0.4) throw new Error('Nu pare să fie mâncare în poza asta. Fă o poză farfuriei, de aproape, sau caută ce ai mâncat.');
  return rankLabels(emb, labels, 6, allow);
}
