import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, TextInput, View } from 'react-native';
import { ING } from '../data/ingredients';
import { RECIPE } from '../data/recipes';
import { fmtQty } from '../logic/format';
import { addMacros, recipeAllergens, recipeDiet, ZERO, ALLERGEN_LABEL, DIET_LABEL } from '../logic/nutrition';
import { uid } from '../logic/pantry';
import type { Equipment, Recipe, RecipeMeal } from '../logic/types';
import { useStore } from '../store/useStore';
import { EquipmentForm, IngredientPicker, ToggleRow } from '../ui/forms';
import { Btn, Card, Chip, Divider, Field, Icon, MacroBar, NumberField, Notice, Row, Screen, Section, T, useTheme } from '../ui/kit';


/** Editor pentru rețetele tale: caloriile, alergenii, dieta și postul se calculează automat */
export default function RecipeEditor() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { saveRecipe, deleteRecipe } = useStore();
  const existing = id ? RECIPE[id] : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [photo, setPhoto] = useState<string | undefined>(existing?.photo);
  const [meal, setMeal] = useState<RecipeMeal[]>(existing?.meal ?? ['principal']);
  const [servings, setServings] = useState(existing?.servings ?? 4);
  const [prep, setPrep] = useState(existing?.prep ?? 30);
  const [keepsDays, setKeeps] = useState(existing?.keepsDays ?? 2);
  const [freezable, setFreezable] = useState(!!existing?.freezable);
  const [equipment, setEquipment] = useState<Equipment[]>(existing?.equipment.map((g) => g[0]) ?? ['plita']);
  const [ing, setIng] = useState<[string, number][]>(existing?.ing ?? []);
  const [steps, setSteps] = useState(existing?.steps.join('\n') ?? '');
  const [picker, setPicker] = useState(false);
  const [rid] = useState(existing?.id ?? `u_${uid('r')}`);

  const draft: Recipe = {
    id: rid, name: name.trim(), photo, meal, servings, prep, keepsDays, freezable,
    equipment: equipment.map((e) => [e]), ing, steps: steps.split('\n').map((x) => x.trim()).filter(Boolean), custom: true,
    tags: ['rețeta mea'],
  };
  const per = useMemo(() => {
    let m = { ...ZERO };
    for (const [iid, g] of ing) if (ING[iid]) m = addMacros(m, ING[iid], g / 100);
    const k = 1 / Math.max(1, servings);
    return { kcal: m.kcal * k, p: m.p * k, c: m.c * k, f: m.f * k, fib: m.fib * k, sug: m.sug * k, salt: m.salt * k };
  }, [ing, servings]);

  const pickPhoto = async (camera: boolean) => {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 };
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;
    try {
      const src = new File(res.assets[0].uri);
      const dest = new File(Paths.document, `reteta_${draft.id}_${Date.now()}.jpg`);
      src.copy(dest);
      setPhoto(dest.uri);
    } catch {
      setPhoto(res.assets[0].uri);
    }
  };

  const save = () => {
    if (!draft.name) return Alert.alert('Scrie numele rețetei');
    if (!ing.length) return Alert.alert('Adaugă cel puțin un ingredient');
    if (!draft.steps.length) return Alert.alert('Scrie cel puțin un pas');
    saveRecipe(draft);
    router.replace({ pathname: '/reteta/[id]', params: { id: draft.id } });
  };

  const toggleMeal = (m: RecipeMeal) => setMeal((x) => (x.includes(m) ? (x.length > 1 ? x.filter((y) => y !== m) : x) : [...x, m]));

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: existing ? 'Editează rețeta' : 'Rețetă nouă', headerRight: () => <Btn title="Salvează" small variant="ghost" onPress={save} /> }} />
      <Notice tone="primary" icon="calculator" text="Scrii doar ingredientele în grame. Caloriile, proteinele, fibrele, sarea, alergenii, dieta și compatibilitatea cu postul se calculează automat." />
      <Field label="Nume" value={name} onChangeText={setName} placeholder="ex. Tocănița bunicii" />

      <Section title="Imagine">
        {photo ? (
          <View style={{ gap: 8 }}>
            <Image source={{ uri: photo }} style={{ width: '100%', height: 180, borderRadius: 16 }} />
            <Btn title="Scoate poza" small variant="ghost" onPress={() => setPhoto(undefined)} />
          </View>
        ) : null}
        <Row>
          <Btn title="Fă o poză" icon="camera" small variant="secondary" onPress={() => pickPhoto(true)} style={{ flex: 1 }} />
          <Btn title="Din galerie" icon="images" small variant="secondary" onPress={() => pickPhoto(false)} style={{ flex: 1 }} />
        </Row>
        {!photo && <T v="small">Fă o poză când o gătești: așa o recunoști ușor în plan și în jurnal.</T>}
      </Section>

      <Section title="Pentru ce masă">
        <Row wrap>
          <Chip label="Mic dejun" selected={meal.includes('mic_dejun')} onPress={() => toggleMeal('mic_dejun')} />
          <Chip label="Prânz / cină" selected={meal.includes('principal')} onPress={() => toggleMeal('principal')} />
          <Chip label="Gustare" selected={meal.includes('gustare')} onPress={() => toggleMeal('gustare')} />
        </Row>
      </Section>

      <Row>
        <View style={{ flex: 1 }}><NumberField label="Porții" value={servings} min={1} max={30} onChange={setServings} /></View>
        <View style={{ flex: 1 }}><NumberField label="Minute" value={prep} step={5} min={1} max={600} onChange={setPrep} /></View>
      </Row>
      <NumberField label="Câte zile ține la frigider" value={keepsDays} min={0} max={14} suffix="zile" onChange={setKeeps} />
      <ToggleRow title="Se poate congela" value={freezable} onChange={setFreezable} />

      <Section title="Ingrediente (pentru toate porțiile)">
        <Card style={{ gap: 0, paddingVertical: 4 }}>
          {ing.length === 0 && <T v="small" style={{ paddingVertical: 10 }}>Niciun ingredient încă.</T>}
          {ing.map(([iid, g], i) => (
            <View key={iid}>
              {i > 0 && <Divider />}
              <View style={{ paddingVertical: 8, gap: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T style={{ fontWeight: '600', flex: 1 }}>{ING[iid]?.name ?? iid}</T>
                  <T v="small">{fmtQty(iid, g)}</T>
                  <Pressable hitSlop={8} onPress={() => setIng(ing.filter((x) => x[0] !== iid))}><Icon name="close-circle-outline" size={20} color={t.muted} /></Pressable>
                </Row>
                <NumberField value={g} step={ING[iid]?.gPerPiece ?? (ING[iid]?.staple ? 1 : 25)} min={0.5} max={5000} decimals={1} suffix="g"
                  onChange={(v) => setIng(ing.map((x) => (x[0] === iid ? [iid, v] : x)))} />
              </View>
            </View>
          ))}
        </Card>
        <Btn title="Adaugă ingredient" icon="add" variant="secondary" onPress={() => setPicker(true)} />
      </Section>

      {ing.length > 0 && (
        <Card tone="primary" style={{ gap: 8 }}>
          <T v="label">Calculat automat, pe porție</T>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="h3">{Math.round(per.kcal)} kcal</T>
            <T v="small">P {Math.round(per.p)} g · C {Math.round(per.c)} g · G {Math.round(per.f)} g</T>
          </Row>
          <MacroBar p={per.p} c={per.c} f={per.f} />
          <T v="small">Fibre {per.fib.toFixed(1)} g · zaharuri {per.sug.toFixed(1)} g · sare {per.salt.toFixed(1)} g</T>
          <T v="small">{DIET_LABEL[recipeDiet(draft)]}{recipeAllergens(draft).length ? ` · alergeni: ${recipeAllergens(draft).map((a) => ALLERGEN_LABEL[a]).join(', ')}` : ''}</T>
        </Card>
      )}

      <Section title="Echipamente necesare">
        <EquipmentForm value={equipment} onChange={setEquipment} />
      </Section>

      <Section title="Pași (câte unul pe rând)">
        <TextInput multiline value={steps} onChangeText={setSteps} placeholder={'Călește ceapa 5 minute.\nAdaugă carnea și fierbe 30 de minute.'}
          placeholderTextColor={t.muted}
          style={{ minHeight: 140, backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, color: t.text, textAlignVertical: 'top' }} />
        <T v="small">Scrie timpii în minute („fierbe 20 de minute”) și modul de gătit îți pune automat cronometre.</T>
      </Section>

      <Btn title="Salvează rețeta" icon="checkmark" onPress={save} style={{ marginTop: 8 }} />
      {existing?.custom && (
        <Btn title="Șterge rețeta" variant="danger" icon="trash-outline" onPress={() => Alert.alert('Ștergi rețeta?', '', [
          { text: 'Nu', style: 'cancel' }, { text: 'Șterge', style: 'destructive', onPress: () => { deleteRecipe(existing.id); router.back(); } },
        ])} />
      )}
      <IngredientPicker visible={picker} onClose={() => setPicker(false)} exclude={ing.map((x) => x[0])}
        onPick={(iid) => { setPicker(false); setIng([...ing, [iid, ING[iid]?.staple ? 3 : ING[iid]?.gPerPiece ?? 100]]); }} />
    </Screen>
  );
}
