import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useStore } from '../store/useStore';
import { Btn, Icon, T, useTheme } from './kit';

/*
 * Varianta din Safari: blocarea cu Face ID / Touch ID / codul telefonului, prin WebAuthn (passkey local).
 * Cheia stă doar pe telefon și nu e trimisă nicăieri; o folosesc doar ca să cer Face ID.
 */
const KEY = 'nutritie-lock-cred';
const rnd = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

export async function biometricsAvailable(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

async function register(): Promise<boolean> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: rnd(32),
      rp: { name: 'Nutriție' },
      user: { id: rnd(16), name: 'nutritie', displayName: 'Nutriție' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) return false;
  try { localStorage.setItem(KEY, b64(cred.rawId)); } catch { /* nimic */ }
  return true;
}

async function verify(): Promise<boolean> {
  const id = stored();
  if (!id) return register();
  const r = await navigator.credentials.get({
    publicKey: { challenge: rnd(32), allowCredentials: [{ type: 'public-key', id: unb64(id) }], userVerification: 'required', timeout: 60_000 },
  });
  return !!r;
}

/** la activare: creează cheia (Face ID) și o confirmă */
export async function confirmIdentity(): Promise<boolean> {
  try {
    return await verify();
  } catch {
    return false;
  }
}

export function LockGate({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const enabled = useStore((s) => s.lockEnabled);
  const [unlocked, setUnlocked] = useState(false);
  const [err, setErr] = useState('');

  // Safari cere Face ID doar după o atingere, așa că afișez butonul; la ieșirea din aplicație se blochează la loc
  useEffect(() => {
    const h = () => { if (document.visibilityState === 'hidden') setUnlocked(false); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);

  if (!enabled || unlocked) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="lock-closed" size={40} color={t.primary} />
      </View>
      <T v="h2">Aplicația e blocată</T>
      <T v="small" style={{ textAlign: 'center' }}>Datele tale rămân doar pe acest telefon.</T>
      <Btn title="Deblochează cu Face ID" icon="finger-print" onPress={async () => {
        setErr('');
        if (await confirmIdentity()) setUnlocked(true);
        else setErr('N-a mers. Încearcă din nou.');
      }} />
      {!!err && <T v="small" color={t.danger}>{err}</T>}
      {!!err && <Btn title="Fă din nou cheia Face ID" variant="ghost" small onPress={async () => {
        // și crearea cheii cere Face ID sau codul telefonului, deci nu ocolește blocarea
        try { if (await register()) setUnlocked(true); } catch { setErr('N-a mers. Încearcă din nou.'); }
      }} />}
    </View>
  );
}
