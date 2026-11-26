import React from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Member } from '../logic/types';
import { useStore } from '../store/useStore';
import { ActivityForm, AvoidForm, AwayForm, BodyForm, DietForm, GoalForm, HealthForm, SportForm, TargetPreview } from './forms';
import { Btn, Row, Section, T, useTheme } from './kit';

/** Formular complet pentru un membru (folosit în configurare și în Profil) */
export function MemberFields({ m, onChange }: { m: Member; onChange: (m: Member) => void }) {
  const slots = useStore((s) => s.settings.slots);
  return (
    <View style={{ gap: 18 }}>
      <BodyForm m={m} onChange={onChange} />
      <Section title="Obiectiv"><GoalForm m={m} onChange={onChange} /></Section>
      <Section title="O zi obișnuită"><ActivityForm m={m} onChange={onChange} /></Section>
      <Section title="Sport"><SportForm m={m} onChange={onChange} /></Section>
      <Section title="Detalii"><HealthForm m={m} onChange={onChange} /></Section>
      <Section title="Mese acasă"><AwayForm m={m} slots={slots} onChange={onChange} /></Section>
      <Section title="Cum mănâncă"><DietForm m={m} onChange={onChange} /></Section>
      <Section title="Ce nu mănâncă"><AvoidForm m={m} onChange={onChange} /></Section>
      <Section title="Rezultat"><TargetPreview m={m} /></Section>
    </View>
  );
}

export function MemberModal({ member, visible, onClose, onSave, onDelete }: {
  member: Member | null; visible: boolean; onClose: () => void; onSave: (m: Member) => void; onDelete?: () => void;
}) {
  const t = useTheme();
  const [m, setM] = React.useState<Member | null>(member);
  React.useEffect(() => { setM(member); }, [member]);
  if (!m) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <Row style={{ justifyContent: 'space-between', padding: 16, paddingBottom: 8 }}>
          <Btn title="Anulează" variant="ghost" small onPress={onClose} />
          <T v="h3">{m.name || 'Membru nou'}</T>
          <Btn title="Salvează" small onPress={() => onSave({ ...m, name: m.name.trim() || 'Membru' })} />
        </Row>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <MemberFields m={m} onChange={setM} />
          {onDelete && <Btn title="Șterge membrul" variant="danger" icon="trash" onPress={onDelete} style={{ marginTop: 20 }} />}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
