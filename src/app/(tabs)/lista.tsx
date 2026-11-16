import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useFeature } from '../../store/useStore';
import { Header, Screen, Segmented } from '../../ui/kit';
import { PantryView } from '../../ui/PantryView';
import { ShoppingView } from '../../ui/ShoppingView';

/** Cumpărăturile și cămara, în același loc */
export default function ListTab() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const pantryOn = useFeature('camara');
  const [tab, setTab] = useState<'lista' | 'camara'>(params.tab === 'camara' ? 'camara' : 'lista');
  useEffect(() => { if (params.tab === 'camara' || params.tab === 'lista') setTab(params.tab); }, [params.tab]);
  return (
    <Screen>
      <Header title="Acasă" />
      {pantryOn && <Segmented options={[{ label: 'Lista', value: 'lista' }, { label: 'Cămara', value: 'camara' }]} value={tab} onChange={setTab} />}
      {tab === 'lista' || !pantryOn ? <ShoppingView /> : <PantryView />}
    </Screen>
  );
}
