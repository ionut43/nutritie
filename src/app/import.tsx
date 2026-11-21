import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Linking, Platform, TextInput, View } from 'react-native';
import { ING } from '../data/ingredients';
import { fmtQty } from '../logic/format';
import { addMacros, ZERO } from '../logic/nutrition';
import { MOMENT_LABEL, parseShared } from '../logic/recipeShare';
import { useStore } from '../store/useStore';
import { Btn, Card, Divider, Notice, Row, Screen, Section, T, useTheme } from '../ui/kit';

/** o rețetă primită de la cineva, ca link: o vezi și o pui la rețetele tale */
export default function ImportRecipe() {
  const t = useTheme();
  const router = useRouter();
  const { r } = useLocalSearchParams<{ r?: string }>();
  const [text, setText] = useState('');
  const { saveRecipe, saveIngredient } = useStore();
  const got = useMemo(() => parseShared(r ? `?r=${r}` : text), [r, text]);
  const ingName = (id: string) => ING[id]?.name ?? got?.ingredients.find((x) => x.id === id)?.name ?? id;

  const per = useMemo(() => {
    if (!got) return null;
    let m = { ...ZERO };
    const all = { ...ING, ...Object.fromEntries(got.ingredients.map((x) => [x.id, x])) };
    for (const [id, g] of got.recipe.ing) if (all[id]) m = addMacros(m, all[id], g / 100);
    return Math.round(m.kcal / got.recipe.servings);
  }, [got]);

  const isAndroidWeb = Platform.OS === 'web' && typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const isIosWeb = Platform.OS === 'web' && typeof navigator !== 'undefined' && /iPhone|iPad/i.test(navigator.userAgent);
  const standalone = Platform.OS === 'web' && typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone);

  const save = () => {
    if (!got) return;
    got.ingredients.forEach(saveIngredient);
    saveRecipe(got.recipe);
    router.replace({ pathname: '/reteta/[id]', params: { id: got.recipe.id } });
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Rețetă primită' }} />
      {!r && (
        <Section title="Lipește linkul primit">
          <TextInput value={text} onChangeText={setText} placeholder="https://ionut43.github.io/nutritie/import?r=…" placeholderTextColor={t.muted} multiline
            style={{ minHeight: 80, backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, color: t.text, textAlignVertical: 'top' }} />
          {text.length > 10 && !got && <T v="small" color={t.danger}>Linkul nu pare o rețetă din aplicație. Verifică să fie copiat întreg.</T>}
        </Section>
      )}
      {r && !got && <Notice tone="danger" icon="alert-circle" text="Linkul e incomplet sau stricat. Cere-i persoanei să ți-l trimită din nou." />}
      {got && (
        <>
          <Card style={{ gap: 6 }}>
            <T v="h2">{got.recipe.name}</T>
            <T v="small">
              {got.recipe.author ? `Făcută de ${got.recipe.author} · ` : ''}{(got.recipe.moments ?? []).map((m) => MOMENT_LABEL[m].toLowerCase()).join(', ')}
              {' · '}{got.recipe.servings} porții · {got.recipe.prep} min{per ? ` · ~${per} kcal/porție` : ''}
            </T>
          </Card>
          <Section title="Ingrediente">
            <Card style={{ gap: 0, paddingVertical: 4 }}>
              {got.recipe.ing.map(([id, g], i) => (
                <View key={id}>
                  {i > 0 && <Divider />}
                  <Row style={{ justifyContent: 'space-between', paddingVertical: 8 }}>
                    <T style={{ flex: 1 }}>{ingName(id)}</T>
                    <T v="small">{ING[id] ? fmtQty(id, g) : `${Math.round(g)} g`}</T>
                  </Row>
                </View>
              ))}
            </Card>
          </Section>
          <Section title="Pași">
            {got.recipe.steps.map((s, i) => <T key={i}>{i + 1}. {s}</T>)}
          </Section>
          <Btn title="Pune-o la rețetele mele" icon="add-circle" onPress={save} />
          {isAndroidWeb && r && (
            <Btn title="Deschide în aplicația de pe telefon" icon="open-outline" variant="secondary"
              onPress={() => Linking.openURL(`intent://import?r=${r}#Intent;scheme=nutritie;package=ro.cosmin.nutritie;end`)} />
          )}
          {isIosWeb && !standalone && (
            <Notice tone="primary" icon="information-circle"
              text="Dacă folosești Nutriție de pe ecranul principal al iPhone-ului: copiază linkul, deschide aplicația și mergi la Rețete → + → Am primit o rețetă." />
          )}
        </>
      )}
    </Screen>
  );
}
