import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RECIPES } from '../../data/recipes';
import { fastAllows, hasEquipment, mergeRestrictions, perServing, proteinKind, recipeFits } from '../../logic/nutrition';
import type { Cuisine, RecipeMeal } from '../../logic/types';
import { useStore } from '../../store/useStore';
import { Chip, Field, Header, IconBtn, T, useTheme } from '../../ui/kit';
import { RecipeTile } from '../../ui/shared';
import { CUISINE_LABEL } from '../../ui/visual';

type F = 'toate' | RecipeMeal | 'desert' | 'post' | 'rapid' | 'proteic' | 'fara_carne' | 'favorite' | 'ale_mele';

const FILTERS: [F, string][] = [
  ['toate', 'Toate'], ['principal', 'Prânz și cină'], ['mic_dejun', 'Mic dejun'], ['gustare', 'Gustări'], ['desert', 'Deserturi'],
  ['rapid', 'Sub 30 min'], ['proteic', 'Multe proteine'], ['fara_carne', 'Fără carne'], ['post', 'De post'], ['favorite', 'Favorite'], ['ale_mele', 'Ale mele'],
];

export default function Recipes() {
  const t = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { members, settings, liked, disliked, customRecipes } = useStore();
  const [q, setQ] = useState('');
  const [f, setF] = useState<F>('toate');
  const [cu, setCu] = useState<Cuisine | 'all'>('all');
  const [fitOnly, setFitOnly] = useState(true);
  const rs = mergeRestrictions(members);
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const list = useMemo(() => RECIPES.filter((r) => {
    if (q && !norm(r.name).includes(norm(q)) && !norm(r.en ?? '').includes(norm(q)) && !r.ing.some(([id]) => norm(id).includes(norm(q)))) return false;
    if (fitOnly && (!recipeFits(r, rs) || !hasEquipment(r, settings.equipment))) return false;
    if (cu !== 'all' && r.cuisine !== cu) return false;
    const ps = perServing(r);
    switch (f) {
      case 'mic_dejun': case 'principal': return r.meal.includes(f);
      case 'gustare': return r.meal.includes('gustare') && !r.tags?.includes('desert');
      case 'desert': return !!r.tags?.includes('desert');
      case 'post': return fastAllows('strict', r);
      case 'fara_carne': return ['leguminoase', 'oua_lactate', 'legume'].includes(proteinKind(r)) && r.meal.includes('principal');
      case 'rapid': return r.prep <= 30;
      case 'proteic': return ps.kcal > 0 && (ps.p * 4) / ps.kcal >= 0.28;
      case 'favorite': return liked.includes(r.id);
      case 'ale_mele': return !!r.custom;
      default: return true;
    }
  }).sort((a, b) => Number(disliked.includes(a.id)) - Number(disliked.includes(b.id)) || Number(!!b.custom) - Number(!!a.custom)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [q, f, cu, fitOnly, members, settings.equipment, liked, disliked, customRecipes]);

  const colW = (Math.min(width, 700) - 16 * 2 - 12) / 2;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        windowSize={7}
        ListHeaderComponent={(
          <View style={{ gap: 12 }}>
            <Header title="Rețete" sub={`${list.length} din ${RECIPES.length}`} right={<IconBtn icon="add" tone="primary" onPress={() => router.push('/reteta-noua')} />} />
            <Field value={q} onChangeText={setQ} placeholder="Caută rețete sau ingrediente" icon="search" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {FILTERS.map(([v, l]) => <Chip key={v} label={l} selected={f === v} onPress={() => setF(v)} />)}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Chip label={fitOnly ? 'Potrivite pentru mine' : 'Toate rețetele'} icon={fitOnly ? 'funnel' : 'funnel-outline'} tone={fitOnly ? 'accent' : 'warn'} onPress={() => setFitOnly(!fitOnly)} />
              <Chip label="Orice bucătărie" selected={cu === 'all'} onPress={() => setCu('all')} />
              {(Object.keys(CUISINE_LABEL) as Cuisine[]).map((c) => <Chip key={c} label={CUISINE_LABEL[c]} selected={cu === c} onPress={() => setCu(c)} />)}
            </ScrollView>
          </View>
        )}
        ListEmptyComponent={<T v="small" style={{ textAlign: 'center', marginTop: 30 }}>Nicio rețetă nu se potrivește. Schimbă filtrele.</T>}
        renderItem={({ item }) => {
          const ps = perServing(item);
          return (
            <RecipeTile r={item} width={colW} onPress={() => router.push({ pathname: '/reteta/[id]', params: { id: item.id } })}
              sub={`${Math.round(ps.kcal)} kcal · ${Math.round(ps.p)} g proteine${disliked.includes(item.id) ? ' · nu-ți place' : ''}`} />
          );
        }}
      />
    </SafeAreaView>
  );
}
