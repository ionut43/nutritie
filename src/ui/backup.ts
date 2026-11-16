import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { exportData, useStore } from '../store/useStore';

/** Salvează toate datele într-un fișier și deschide meniul de partajare (iCloud, Drive, e-mail) */
export async function exportBackup(): Promise<boolean> {
  const json = JSON.stringify(exportData());
  const name = `nutritie-backup-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    useStore.getState().markBackup();
    return true;
  }
  const f = new File(Paths.cache, name);
  f.create({ overwrite: true });
  f.write(json);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'Salvează backup-ul', UTI: 'public.json' });
  useStore.getState().markBackup();
  return true;
}

/** Citește un backup ales de utilizator; întoarce datele sau null dacă fișierul nu e valid */
export async function pickBackup(): Promise<unknown | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled) return null;
  try {
    const text = Platform.OS === 'web' ? await (await fetch(res.assets[0].uri)).text() : await new File(res.assets[0].uri).text();
    const d = JSON.parse(text);
    return d?.app === 'nutritie' && d?.state ? d : null;
  } catch {
    return null;
  }
}

/*
 * Copie automată pe telefon, o dată pe săptămână (ultimele 4). Te apără dacă ceva se strică în aplicație;
 * pentru schimbarea telefonului rămâne „Fă backup” (în Drive, iCloud sau pe e-mail).
 */
const autoDir = () => new Directory(Paths.document, 'copii');

export function autoBackups(): { name: string; uri: string; dateISO: string }[] {
  if (Platform.OS === 'web') return [];
  try {
    const d = autoDir();
    if (!d.exists) return [];
    return d.list().filter((x): x is File => x instanceof File && x.name.startsWith('nutritie-auto-'))
      .map((f) => ({ name: f.name, uri: f.uri, dateISO: f.name.slice(14, 24) }))
      .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  } catch {
    return [];
  }
}

export function autoBackup(force = false): boolean {
  if (Platform.OS === 'web') return false;
  try {
    const st = useStore.getState();
    if (!st.onboarded) return false;
    const today = new Date().toISOString().slice(0, 10);
    const last = autoBackups()[0];
    if (!force && last && (Date.parse(today) - Date.parse(last.dateISO)) / 86400000 < 7) return false;
    const d = autoDir();
    if (!d.exists) d.create({ intermediates: true });
    const f = new File(d, `nutritie-auto-${today}.json`);
    f.create({ overwrite: true });
    f.write(JSON.stringify(exportData()));
    for (const old of autoBackups().slice(4)) { try { new File(old.uri).delete(); } catch { /* nimic */ } }
    return true;
  } catch {
    return false;
  }
}

export async function readBackup(uri: string): Promise<unknown | null> {
  try {
    const d = JSON.parse(await new File(uri).text());
    return d?.app === 'nutritie' && d?.state ? d : null;
  } catch {
    return null;
  }
}
