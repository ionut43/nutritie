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

/* În Safari (varianta web) copiile stau în IndexedDB, nu în fișiere. */
type WebCopy = { name: string; dateISO: string; json: string };
let webCopies: WebCopy[] = [];
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('nutritie', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('copii', { keyPath: 'name' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbAll(): Promise<WebCopy[]> {
  const db = await idb();
  return new Promise((res, rej) => {
    const q = db.transaction('copii').objectStore('copii').getAll();
    q.onsuccess = () => res((q.result as WebCopy[]).sort((a, b) => b.dateISO.localeCompare(a.dateISO)));
    q.onerror = () => rej(q.error);
  });
}
async function webAutoBackup(force: boolean) {
  try {
    webCopies = await idbAll();
    const st = useStore.getState();
    if (!st.onboarded) return;
    const today = new Date().toISOString().slice(0, 10);
    const last = webCopies[0];
    if (!force && last && (Date.parse(today) - Date.parse(last.dateISO)) / 86400000 < 7) return;
    const db = await idb();
    const tx = db.transaction('copii', 'readwrite');
    const os = tx.objectStore('copii');
    os.put({ name: `nutritie-auto-${today}.json`, dateISO: today, json: JSON.stringify(exportData()) });
    for (const old of [{ name: `nutritie-auto-${today}.json`, dateISO: today, json: '' }, ...webCopies.filter((c) => c.dateISO !== today)].slice(4)) os.delete(old.name);
    await new Promise((res) => { tx.oncomplete = res; tx.onerror = res; });
    webCopies = await idbAll();
  } catch { /* nimic */ }
}

export function autoBackups(): { name: string; uri: string; dateISO: string }[] {
  if (Platform.OS === 'web') return webCopies.map((c) => ({ name: c.name, uri: `idb:${c.name}`, dateISO: c.dateISO }));
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
  if (Platform.OS === 'web') { void webAutoBackup(force); return true; }
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
    const text = uri.startsWith('idb:') ? (await idbAll()).find((c) => `idb:${c.name}` === uri)?.json ?? '' : await new File(uri).text();
    const d = JSON.parse(text);
    return d?.app === 'nutritie' && d?.state ? d : null;
  } catch {
    return null;
  }
}
