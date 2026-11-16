import * as LocalAuthentication from 'expo-local-authentication';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useStore } from '../store/useStore';
import { Btn, Icon, T, useTheme } from './kit';

/** Blochează aplicația cu Face ID / amprentă / cod, dacă utilizatorul a activat asta */
export function LockGate({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const enabled = useStore((s) => s.lockEnabled);
  const [unlocked, setUnlocked] = useState(false);
  const busy = useRef(false);

  const unlock = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Deblochează Nutriție', cancelLabel: 'Anulează' });
      if (res.success) setUnlocked(true);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (enabled && !unlocked) unlock();
  }, [enabled, unlocked, unlock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') setUnlocked(false);
    });
    return () => sub.remove();
  }, []);

  if (!enabled || unlocked) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="lock-closed" size={40} color={t.primary} />
      </View>
      <T v="h2">Aplicația e blocată</T>
      <T v="small" style={{ textAlign: 'center' }}>Datele tale rămân doar pe acest telefon.</T>
      <Btn title="Deblochează" icon="finger-print" onPress={unlock} />
    </View>
  );
}

export async function biometricsAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function confirmIdentity(): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirmă că ești tu' });
    return r.success;
  } catch {
    return false;
  }
}
