import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, View } from 'react-native';
import { MOMENT_LABEL, type Moment } from '../logic/recipeShare';
import { friendly } from '../sync/family';
import { importParam, listPublic, myUserId, type PublicRecipe, reportRecipe } from '../sync/publicRecipes';
import { Btn, Card, Chip, Empty, Field, Notice, Row, Screen, Section, T, useTheme } from '../ui/kit';

const MOMENTS: Moment[] = ['mic_dejun', 'pranz', 'cina', 'gustare', 'desert'];

/** rețetele publicate de oamenii care folosesc aplicația, cu „făcută de …” */
export default function Comunitate() {
  const t = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<PublicRecipe[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [moment, setMoment] = useState<Moment | undefined>();
  const [me, setMe] = useState<string | undefined>();

  const load = useCallback(async () => {
    setErr(null);
    try { setItems(await listPublic(q, moment)); } catch (e) { setErr(friendly(e)); setItems([]); }
  }, [q, moment]);
  useEffect(() => { const h = setTimeout(() => { void load(); }, 300); return () => clearTimeout(h); }, [load]);
  useEffect(() => { void myUserId().then(setMe); }, []);

  const report = (p: PublicRecipe) => {
    const go = () => reportRecipe(p.id).then(() => setItems((xs) => xs?.filter((x) => x.id !== p.id) ?? null)).catch((e) => setErr(friendly(e)));
    if (Platform.OS === 'web') { void go(); return; }
    Alert.alert('Raportezi rețeta?', 'Dacă nu e o rețetă sau e jignitoare. După câteva raportări nu se mai arată nimănui.', [
      { text: 'Nu', style: 'cancel' }, { text: 'Raportez', style: 'destructive', onPress: () => { void go(); } },
    ]);
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Rețete de la alții' }} />
      <T v="small">Rețete scrise de oamenii care folosesc aplicația. Le vezi, le pui la rețetele tale și intră în plan ca oricare alta. Pe ale tale le publici din rețetă, cu „Publică pentru toți”.</T>
      <Field label="Caută" value={q} onChangeText={setQ} placeholder="ex. ciorbă, clătite, pui" icon="search" />
      <Row wrap gap={8}>
        {MOMENTS.map((m) => <Chip key={m} label={MOMENT_LABEL[m]} selected={moment === m} onPress={() => setMoment(moment === m ? undefined : m)} />)}
      </Row>
      {err && <Notice tone="danger" icon="alert-circle" text={err} />}
      {items === null && <View style={{ padding: 30 }}><ActivityIndicator color={t.primary} /></View>}
      {items?.length === 0 && !err && (
        <Empty icon="restaurant" title={q || moment ? 'Nimic găsit' : 'Încă nu a publicat nimeni'}
          text={q || moment ? 'Încearcă alt cuvânt.' : 'Fii primul: deschide o rețetă de-a ta și apasă „Publică pentru toți”.'} />
      )}
      {!!items?.length && (
        <Section title={`${items.length} rețete`}>
          {items.map((p) => (
            <Card key={p.id} style={{ gap: 6 }} onPress={() => router.push({ pathname: '/import', params: { r: importParam(p) } })}>
              <T v="h3">{p.name}</T>
              <T v="small">Făcută de {p.author_name}{p.moments.length ? ` · ${p.moments.map((m) => MOMENT_LABEL[m]?.toLowerCase()).join(', ')}` : ''} · {p.recipe.s} porții · {p.recipe.p} min</T>
              {p.author_id !== me && (
                <Row style={{ justifyContent: 'flex-end' }}>
                  <Btn title="Raportează" icon="flag-outline" variant="ghost" small onPress={() => report(p)} />
                </Row>
              )}
            </Card>
          ))}
        </Section>
      )}
    </Screen>
  );
}
