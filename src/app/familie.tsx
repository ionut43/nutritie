import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Share, View } from 'react-native';
import { useStore } from '../store/useStore';
import { createFamily, friendly, joinFamily, leaveFamily, renewCode, syncNow } from '../sync/family';
import { success, tick } from '../ui/haptics';
import { Btn, Card, Field, Notice, Row, Screen, Section, T, useTheme } from '../ui/kit';

const ago = (iso?: string) => {
  if (!iso) return '';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return min < 1 ? 'acum' : min < 60 ? `acum ${min} min` : `azi la ${new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
};

/** familia pe mai multe telefoane: același plan, aceeași listă și cămară; fiecare cu jurnalul lui */
export default function Familie() {
  const t = useTheme();
  const { family, syncStatus, members } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const run = async (f: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await f(); success(); } catch (e) { setErr(friendly(e)); } finally { setBusy(false); }
  };
  const me = members.find((m) => m.isMain);

  if (!family) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: 'Familia pe mai multe telefoane' }} />
        <Card style={{ gap: 6 }}>
          <T v="h3">Fiecare cu telefonul lui, aceeași casă</T>
          <T v="small">Planul săptămânii, lista de cumpărături, cămara și rețetele voastre sunt aceleași pe toate telefoanele. Ce bifează unul la magazin vede imediat și celălalt.</T>
          <T v="small">Ce mănânci, greutatea și ce îți place rămân doar pe telefonul tău. Nu ai nevoie de email sau parolă.</T>
        </Card>
        <Section title="Faci familia">
          <Field label="Numele familiei (opțional)" value={name} onChangeText={setName} placeholder={`Familia lui ${me?.name.trim() || 'Ana'}`} />
          <Btn title="Creează familia" icon="people" disabled={busy} onPress={() => run(() => createFamily(name || `Familia lui ${me?.name.trim() || 'mea'}`))} />
          <T v="small">Primești un cod de 6 caractere pe care îl dai celorlalți.</T>
        </Section>
        <Section title="Ai primit un cod">
          <Field label="Codul familiei" value={code} onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="ex. K7MPQ2" />
          <Btn title="Intră în familie" icon="enter-outline" variant="secondary" disabled={busy || code.length !== 6} onPress={() => run(() => joinFamily(code))} />
          <T v="small">Primești planul, lista și cămara familiei. Ce aveai aici rămâne pe telefon; planurile tale pentru alte săptămâni pleacă și la ei.</T>
        </Section>
        {busy && <ActivityIndicator color={t.primary} />}
        {err && <Notice tone="danger" icon="alert-circle" text={err} />}
      </Screen>
    );
  }

  const state = syncStatus.state;
  const line = state === 'syncing' ? 'Se sincronizează…'
    : state === 'offline' ? 'Fără internet: schimbările pleacă când revine.'
    : state === 'error' ? `Nu s-a putut sincroniza: ${syncStatus.msg ?? ''}`
    : syncStatus.atISO ? `Sincronizat ${ago(syncStatus.atISO)}` : 'Pornește sincronizarea…';

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: family.name }} />
      <Card style={{ gap: 8, alignItems: 'center' }}>
        <T v="small">Codul familiei</T>
        <T style={{ fontSize: 34, fontWeight: '800', letterSpacing: 6 }}>{family.code}</T>
        <Row wrap gap={8}>
          <Btn small title="Trimite codul" icon="share-outline" onPress={() => { tick(); void Share.share({ message: `Intră în familia „${family.name}” din aplicația Nutriție: Profil → Familia pe mai multe telefoane → codul ${family.code}` }); }} />
          <Btn small variant="secondary" title="Cod nou" icon="refresh" disabled={busy} onPress={() => run(renewCode)} />
        </Row>
        <T v="small" style={{ textAlign: 'center' }}>Cu codul intră oricine îl are. Dacă a ajuns unde nu trebuia, fă unul nou: cei din familie rămân.</T>
      </Card>
      <Section title="Cine e în familie">
        <Card style={{ gap: 6 }}>
          {family.people.map((p) => (
            <T key={p.userId}>{p.name || 'Fără nume'}{p.userId === family.userId ? ' (tu, pe telefonul ăsta)' : ''}</T>
          ))}
        </Card>
        <T v="small">Copiii sau cei fără telefon îi adaugi ca membri, de la Profil: îi văd toți.</T>
      </Section>
      <Section title="Sincronizare">
        <Notice tone={state === 'error' ? 'danger' : state === 'offline' ? 'warn' : 'primary'} icon={state === 'ok' ? 'checkmark-circle' : 'sync'} text={line} />
        <Btn small variant="secondary" title="Sincronizează acum" icon="sync" disabled={busy} onPress={() => run(syncNow)} />
        <T v="small">Se împart: planul, lista de cumpărături, cămara, setările casei (buget, mese, zile de gătit) și rețetele voastre. Rămân doar pe telefonul tău: ce ai mâncat, greutatea, ce îți place.</T>
      </Section>
      <Section title="Ieși din familie">
        <T v="small">Datele rămân pe telefon, dar nu se mai sincronizează. Poți intra la loc cu codul.</T>
        <Btn small variant="secondary" title="Ieși din familie" icon="exit-outline" disabled={busy} onPress={() => run(leaveFamily)} />
      </Section>
      {busy && <View style={{ alignItems: 'center' }}><ActivityIndicator color={t.primary} /></View>}
      {err && <Notice tone="danger" icon="alert-circle" text={err} />}
    </Screen>
  );
}
