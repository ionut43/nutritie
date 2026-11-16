import { Stack } from 'expo-router';
import React from 'react';
import { useActiveMember, useStore } from '../store/useStore';
import { AvoidForm, CuisineForm, DietStyleForm } from '../ui/forms';
import { Notice, Screen, Section } from '../ui/kit';

/** Ce mănânci și ce nu: stil, carne, excluderi, alergii, bucătării */
export default function Preferences() {
  const { settings, updateSettings, upsertMember } = useStore();
  const main = useActiveMember();
  if (!main) return null;
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Ce mănânc' }} />
      <Notice tone="primary" text="Se aplică planurilor noi. Pentru planul curent apasă „Alt plan”." />
      <Section title="Stil"><DietStyleForm m={main} s={settings} onMember={upsertMember} onSettings={updateSettings} /></Section>
      <Section title="Ce nu mănânc"><AvoidForm m={main} onChange={upsertMember} /></Section>
      <Section title="Bucătării"><CuisineForm s={settings} onChange={updateSettings} /></Section>
    </Screen>
  );
}
