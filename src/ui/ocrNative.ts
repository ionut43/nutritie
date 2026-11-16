import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import NutriOcr from '../../modules/nutri-ocr';
import { linesToRows } from '../logic/ocr';

/** OCR-ul rulează pe telefon (Apple Vision / Google ML Kit); lipsește doar în Expo Go și pe web */
export const ocrAvailable = !!NutriOcr;

export async function recognizeRows(uri: string): Promise<string[]> {
  if (!NutriOcr) throw new Error('Citirea textului merge doar în aplicația instalată.');
  // redesenăm imaginea drept (orientare corectă) și la o mărime potrivită pentru OCR
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1800 });
  const img = await ctx.renderAsync();
  const saved = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
  const lines = await NutriOcr.recognize(saved.uri);
  return linesToRows(lines);
}
