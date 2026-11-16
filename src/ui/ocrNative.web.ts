import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { OcrLine } from '../../modules/nutri-ocr/src/NutriOcr.types';
import { linesToRows } from '../logic/ocr';

/*
 * Varianta din Safari: textul de pe bonuri și etichete îl citește Tesseract (Apache 2.0), în WebAssembly, în browser.
 * Prima dată descarcă motorul și limbile română + engleză (~15 MB); apoi le ține în memoria browserului.
 */
export const ocrAvailable = typeof WebAssembly !== 'undefined';

type TWorker = { recognize(img: string, o?: object, out?: object): Promise<{ data: { blocks: { paragraphs: { lines: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }[] }[] | null } }> };
let worker: Promise<TWorker> | null = null;

function getWorker(): Promise<TWorker> {
  if (!worker) {
    worker = import('tesseract.js').then((T) => T.createWorker(['ron', 'eng']) as unknown as Promise<TWorker>);
    worker.catch(() => { worker = null; });
  }
  return worker;
}

const size = (src: string) => new Promise<{ w: number; h: number }>((res, rej) => {
  const i = new Image();
  i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight });
  i.onerror = () => rej(new Error('Nu pot citi poza.'));
  i.src = src;
});

export async function recognizeRows(uri: string): Promise<string[]> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1800 });
  const img = await ctx.renderAsync();
  const saved = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.92, base64: true });
  const src = saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : saved.uri;
  const [{ w, h }, wk] = await Promise.all([size(src), getWorker()]);
  const { data } = await wk.recognize(src, {}, { blocks: true });
  const lines: OcrLine[] = [];
  for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) {
    lines.push({ text: l.text.trim(), x: l.bbox.x0 / w, y: l.bbox.y0 / h, w: (l.bbox.x1 - l.bbox.x0) / w, h: (l.bbox.y1 - l.bbox.y0) / h });
  }
  return linesToRows(lines);
}
