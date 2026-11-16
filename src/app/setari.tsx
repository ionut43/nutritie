import React from 'react';
import { useFeature, useStore } from '../store/useStore';
import { CookingForm, EquipmentForm, FastingForm, MealsPerDay } from '../ui/forms';
import { NumberField, Notice, Screen, Section, Segmented, T } from '../ui/kit';

export default function SettingsScreen() {
  const { settings, updateSettings, setMealSlots } = useStore();
  const postOn = useFeature('post');
  const dessertsOn = useFeature('deserturi');
  return (
    <Screen edges={['bottom']}>
      <Notice tone="primary" text="Bugetul și zilele de gătit se aplică planurilor noi. Numărul de mese se aplică imediat." />
      <Section title="Buget pe săptămână">
        <NumberField value={settings.budgetRon} step={25} min={20} max={10000} suffix="lei" onChange={(budgetRon) => updateSettings({ budgetRon })} />
      </Section>
      <Section title="Mese pe zi">
        <MealsPerDay value={settings.slots} onChange={setMealSlots} />
        <T v="small">Se schimbă și planul de săptămâna asta.</T>
        {dessertsOn && (
          <>
            <T v="h3">Desert, de câte ori pe săptămână?</T>
            <Segmented options={[{ label: 'Deloc', value: 0 }, { label: '1–2', value: 2 }, { label: '3–4', value: 4 }, { label: 'Zilnic', value: 7 }]}
              value={settings.dessertsPerWeek ?? 2} onChange={(dessertsPerWeek) => updateSettings({ dessertsPerWeek })} />
          </>
        )}
      </Section>
      <Section title="Gătit și varietate"><CookingForm s={settings} onChange={updateSettings} /></Section>
      <Section title="Echipamente din bucătărie"><EquipmentForm value={settings.equipment} onChange={(equipment) => updateSettings({ equipment })} /></Section>
      {postOn && <Section title="Post"><FastingForm s={settings} onChange={updateSettings} /></Section>}
    </Screen>
  );
}
