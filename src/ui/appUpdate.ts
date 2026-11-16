import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

/*
 * Actualizarea aplicației direct din ea, fără magazin și fără altă aplicație:
 * verific pe GitHub (Releases) dacă există o versiune mai nouă, o descarc și deschid instalarea Android.
 * Android cere o singură confirmare („Instalezi actualizarea?”); datele rămân, pentru că e aceeași semnătură.
 */
export type Update = { versionCode: number; url: string; sizeMB: number; notes: string };

const repo = (): string | undefined => (Constants.expoConfig?.extra as { updateRepo?: string } | undefined)?.updateRepo;
export const currentVersion = (): number => Number(Constants.expoConfig?.android?.versionCode ?? 0);

let lastCheck = 0;
let cached: Update | null = null;

/** versiunea nouă, dacă există (cel mult o verificare la 6 ore) */
export async function checkForUpdate(force = false): Promise<Update | null> {
  if (Platform.OS !== 'android' || !repo()) return null;
  if (!force && Date.now() - lastCheck < 6 * 3600_000) return cached;
  lastCheck = Date.now();
  try {
    const r = await fetch(`https://api.github.com/repos/${repo()}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return cached;
    const rel = (await r.json()) as { tag_name?: string; body?: string; assets?: { name: string; browser_download_url: string; size: number }[] };
    // tag-ul e build-N, iar versionCode = N + 100 (vezi .github/workflows/build.yml)
    const n = Number(String(rel.tag_name ?? '').replace(/^\D+/, ''));
    const apk = rel.assets?.find((a) => a.name.endsWith('.apk'));
    if (!n || !apk) return (cached = null);
    const vc = n + 100;
    cached = vc > currentVersion() ? { versionCode: vc, url: apk.browser_download_url, sizeMB: Math.round(apk.size / 1e6), notes: rel.body ?? '' } : null;
    return cached;
  } catch {
    return cached;
  }
}

/** descarcă APK-ul și deschide instalarea */
export async function installUpdate(u: Update, onProgress: (pct: number) => void): Promise<void> {
  const f = new File(Paths.cache, `Nutritie-${u.versionCode}.apk`);
  if (!f.exists || f.size < u.sizeMB * 0.9e6) {
    if (f.exists) f.delete();
    const task = File.createDownloadTask(u.url, f, {
      onProgress: ({ bytesWritten }) => onProgress(Math.min(1, bytesWritten / Math.max(1, u.sizeMB * 1e6))),
    });
    await task.downloadAsync();
    if (!f.exists || f.size < u.sizeMB * 0.9e6) throw new Error('Descărcarea nu s-a terminat. Încearcă din nou pe Wi-Fi.');
  }
  onProgress(1);
  const uri = await getContentUriAsync(f.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: uri, type: 'application/vnd.android.package-archive', flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}
