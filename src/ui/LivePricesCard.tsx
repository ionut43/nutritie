import React, { useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { daysBetween, todayISO } from '../logic/dates';
import { CITIES } from '../logic/livePrices';
import { useStore } from '../store/useStore';
import { success } from './haptics';
import { Btn, Chip, Progress, T, useTheme } from './kit';

const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** de unde vin prețurile și butonul care le aduce pe cele de azi */
export function LivePricesCard({ compact }: { compact?: boolean }) {
  const t = useTheme();
  const { livePrices, settings, refreshLivePrices } = useStore();
  const [busy, setBusy] = useState<{ msg: string; pct: number } | null>(null);
  const [pick, setPick] = useState(false);
  const area = settings.priceArea ?? CITIES[0];
  const age = livePrices ? daysBetween(livePrices.fetchedAt.slice(0, 10), todayISO()) : null;
  const d = livePrices ? new Date(livePrices.fetchedAt) : null;

  const run = async (a = area) => {
    setBusy({ msg: 'Pornesc', pct: 0 });
    try {
      const lp = await refreshLivePrices(a, (msg, pct) => setBusy({ msg, pct }));
      success();
      const n = Object.values(lp.prices).reduce((s, x) => s + Object.keys(x ?? {}).length, 0);
      if (!n) Alert.alert('N-am găsit prețuri', 'Serverul a răspuns, dar fără prețuri pentru zona asta. Încearcă alt oraș sau mai târziu.');
    } catch (e) {
      Alert.alert('Nu am putut lua prețurile', `${e instanceof Error ? e.message : String(e)}\n\nVerifică internetul. Dacă tot nu merge, trimite-mi mesajul din „Raportează o problemă”.`);
    } finally {
      setBusy(null);
    }
  };

  // în Safari serverul de prețuri nu răspunde direct (lipsește permisiunea CORS); prețurile vin de la GitHub, în fiecare luni
  if (Platform.OS === 'web') {
    return (
      <T v="small" color={t.muted}>
        {d ? `Prețuri reale din magazine (Monitorul Prețurilor), din ${d.getDate()} ${MONTHS[d.getMonth()]}. ` : ''}Se actualizează singure în fiecare luni.
        {compact ? '' : ' Pe bon poate ieși puțin diferit; bonurile scanate devin prețurile tale.'}
      </T>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <T v="small" color={age != null && age <= 7 ? t.accent : t.muted}>
        {d ? `Prețuri de azi din magazinele din ${livePrices!.area.name}, luate pe ${d.getDate()} ${MONTHS[d.getMonth()]}${age && age > 7 ? ' (au trecut ' + age + ' zile, actualizează-le)' : ''}. Sursa: Monitorul Prețurilor.`
          : 'Prețurile sunt doar estimate. Atinge „Prețuri de azi” ca să iau prețurile reale din magazinele din zona ta (Monitorul Prețurilor, raportate zilnic de magazine).'}
        {compact ? '' : ' Pe bon poate ieși puțin diferit, din promoții sau alt brand; bonurile scanate devin prețurile tale.'}
      </T>
      {busy ? (
        <View style={{ gap: 6 }}>
          <Progress value={busy.pct} max={1} height={6} />
          <T v="small">{busy.msg}</T>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn title={livePrices ? 'Actualizează prețurile' : 'Prețuri de azi'} icon="refresh" small onPress={() => run()} style={{ flex: 1 }} />
          <Btn title={area.name} small variant="secondary" onPress={() => setPick(!pick)} />
        </View>
      )}
      {pick && !busy && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CITIES.map((c) => <Chip key={c.name} label={c.name} selected={c.name === area.name} onPress={() => { setPick(false); run(c); }} />)}
        </ScrollView>
      )}
    </View>
  );
}
