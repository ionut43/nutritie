import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import type { Member } from '../../logic/types';
import { newMember, useStore } from '../../store/useStore';
import { Btn, Screen } from '../../ui/kit';
import { MemberFields } from '../../ui/MemberEditor';

export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { members, upsertMember, removeMember } = useStore();
  const existing = members.find((m) => m.id === id);
  const [m, setM] = useState<Member>(() => existing ?? newMember(false, ''));
  const save = () => {
    if (!m.name.trim()) { Alert.alert('Scrie un nume'); return; }
    upsertMember({ ...m, name: m.name.trim() });
    router.back();
  };
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: existing ? (existing.isMain ? 'Profilul meu' : existing.name) : 'Membru nou', headerRight: () => <Btn title="Salvează" small variant="ghost" onPress={save} /> }} />
      <MemberFields m={m} onChange={setM} />
      <Btn title="Salvează" onPress={save} style={{ marginTop: 16 }} />
      {existing && !existing.isMain && (
        <Btn title="Șterge membrul" variant="danger" icon="trash-outline" onPress={() => Alert.alert(`Ștergi pe ${existing.name}?`, '', [
          { text: 'Nu', style: 'cancel' }, { text: 'Șterge', style: 'destructive', onPress: () => { removeMember(existing.id); router.back(); } },
        ])} />
      )}
    </Screen>
  );
}
