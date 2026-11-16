/* În Safari / browser aplicația se actualizează singură la fiecare deschidere: nu e nimic de instalat. */
export type Update = { versionCode: number; url: string; sizeMB: number; notes: string };
export const currentVersion = () => 0;
export async function checkForUpdate(): Promise<Update | null> { return null; }
export async function installUpdate(): Promise<void> { /* nimic */ }
