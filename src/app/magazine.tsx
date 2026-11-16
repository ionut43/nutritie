import { Stack } from 'expo-router';
import React from 'react';
import { learnedCount, STORE } from '../logic/stores';
import { LivePricesCard } from '../ui/LivePricesCard';
import { useStore } from '../store/useStore';
import { StoresForm } from '../ui/forms';
import { Card, Row, Screen, Section, T } from '../ui/kit';
import { StoreBadge } from '../ui/shared';

export default function Stores() {
  const { settings, updateSettings, storePrices } = useStore();
  const known = (settings.stores ?? []).filter((s) => learnedCount(s, storePrices) > 0);
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Magazinele tale' }} />
      <StoresForm s={settings} onChange={updateSettings} />
      <Section title="Prețuri de azi" sub="Din Monitorul Prețurilor: magazinele raportează zilnic prețurile la Consiliul Concurenței.">
        <LivePricesCard />
      </Section>
      <Section title="Prețuri de pe bonurile tale" sub="Din bonurile scanate. Cu cât scanezi mai multe, cu atât comparația între magazine e mai exactă.">
        <Card style={{ gap: 10 }}>
          {known.length === 0 ? <T v="small">Încă niciun bon scanat. Până atunci prețurile sunt estimate: Lidl și Penny cele mai mici, Mega Image cele mai mari.</T>
            : known.map((s) => (
              <Row key={s} style={{ justifyContent: 'space-between' }}>
                <StoreBadge id={s} small />
                <T v="small">{learnedCount(s, storePrices)} produse cu preț de pe bon</T>
              </Row>
            ))}
          <T v="small">Indice de preț estimat: {(settings.stores ?? []).map((s) => `${STORE[s].name} ${Math.round(STORE[s].index * 100)}`).join(' · ')} (100 = media).</T>
        </Card>
      </Section>
    </Screen>
  );
}
