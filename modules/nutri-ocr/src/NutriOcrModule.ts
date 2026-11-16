import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { OcrLine } from './NutriOcr.types';

declare class NutriOcrModule extends NativeModule<{}> {
  recognize(uri: string): Promise<OcrLine[]>;
  /** doar Android 11+: motivele ultimelor închideri ale aplicației */
  lastExits?(): { time: number; reason: string; code: number; description: string; status: number; importance: number; pss: number; rss: number; trace?: string | null }[];
}

/** null când aplicația rulează fără modulul nativ (ex. Expo Go) */
export default requireOptionalNativeModule<NutriOcrModule>('NutriOcr');
