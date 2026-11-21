import React from 'react';
import { Pressable, View } from 'react-native';
import { useStore } from '../store/useStore';
import { Icon, T, useTheme } from './kit';

/** după ce ai schimbat ce mănânci: „Am înlocuit 3 mese…”; dispare când o atingi sau după o zi */
export function RefitBanner() {
  const t = useTheme();
  const r = useStore((s) => s.lastRefit);
  if (!r || Date.now() - new Date(r.atISO).getTime() > 86400000) return null;
  const n = r.count;
  return (
    <Pressable onPress={() => useStore.setState({ lastRefit: undefined })} accessibilityRole="button" accessibilityLabel="Am înțeles"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: t.primarySoft }}>
      <Icon name="refresh" color={t.primary} size={24} />
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontWeight: '700' }} color={t.primary}>Planul s-a actualizat</T>
        <T v="small" color={t.text}>{n === 1 ? 'Am înlocuit o masă care' : `Am înlocuit ${n} mese care`} nu se mai potriveau cu ce mănânci. Lista de cumpărături e refăcută. Atinge ca să închizi.</T>
      </View>
    </Pressable>
  );
}
