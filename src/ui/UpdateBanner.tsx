import React, { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { checkForUpdate, currentVersion, installUpdate, lastUpdateError, type Update } from './appUpdate';
import { Icon, Progress, T, useTheme } from './kit';

/** o bandă discretă pe „Azi” când există o versiune nouă; o atingi și se instalează peste, cu datele păstrate */
export function UpdateBanner() {
  const t = useTheme();
  const [u, setU] = useState<Update | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    const h = setTimeout(() => { checkForUpdate().then((x) => { if (alive) setU(x); }); }, 2500);
    return () => { alive = false; clearTimeout(h); };
  }, []);
  if (!u) return null;
  const go = async () => {
    if (pct !== null) return;
    setErr(''); setPct(0);
    try { await installUpdate(u, setPct); } catch (e) { setErr(e instanceof Error ? e.message : 'Nu s-a putut descărca.'); }
    setPct(null);
  };
  return (
    <Pressable onPress={go} accessibilityRole="button" accessibilityLabel="Actualizează aplicația"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: t.primarySoft }}>
      <Icon name="arrow-down-circle" color={t.primary} size={26} />
      <View style={{ flex: 1, gap: 4 }}>
        <T style={{ fontWeight: '700' }} color={t.primary}>{pct !== null ? `Se descarcă ${Math.round(pct * 100)}%` : 'E o versiune nouă a aplicației'}</T>
        {pct !== null ? <Progress value={pct} max={1} height={5} /> : (
          <T v="small" color={t.text}>Atinge ca s-o instalezi peste ({u.sizeMB} MB, mai bine pe Wi-Fi). Datele rămân.</T>
        )}
        {!!err && <T v="small" color={t.danger}>{err}</T>}
      </View>
    </Pressable>
  );
}

/** în Profil: ce versiune ai și un buton „Caută actualizări” (doar pe Android) */
export function AppVersionRow() {
  const t = useTheme();
  const [msg, setMsg] = useState('');
  const [u, setU] = useState<Update | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  if (Platform.OS !== 'android') return null;
  const check = async () => {
    setMsg('Caut…');
    const x = await checkForUpdate(true);
    setU(x);
    setMsg(x ? `Versiunea ${x.versionCode} e gata de instalat (${x.sizeMB} MB).` : lastUpdateError ? `Nu am putut verifica: ${lastUpdateError}` : 'Ai ultima versiune.');
  };
  return (
    <View style={{ gap: 6 }}>
      <T v="small">Versiunea aplicației: {currentVersion() || '?'}</T>
      {pct !== null ? <Progress value={pct} max={1} height={5} /> : null}
      <Pressable onPress={async () => {
        if (u) { setPct(0); try { await installUpdate(u, setPct); } catch (e) { setMsg(e instanceof Error ? e.message : 'Nu s-a putut descărca.'); } setPct(null); } else check();
      }} hitSlop={8}>
        <T v="small" color={t.primary} style={{ fontWeight: '700' }}>{u ? 'Instalează actualizarea' : 'Caută actualizări'}</T>
      </Pressable>
      {!!msg && <T v="small">{msg}</T>}
    </View>
  );
}
