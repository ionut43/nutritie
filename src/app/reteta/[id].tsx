import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ING } from '../../data/ingredients';
import { RECIPE } from '../../data/recipes';
import { fmtQty, fmtRon } from '../../logic/format';
import {
  ALLERGEN_LABEL, EQUIPMENT_LABEL, fastAllows, mergeRestrictions, perServing, recipeAllergens, recipeDiet, recipeFits,
} from '../../logic/nutrition';
import { pantryTotals } from '../../logic/pantry';
import { costPerPortion } from '../../logic/planner';
import { MOMENT_LABEL, shareLink, shareText } from '../../logic/recipeShare';
import type { Recipe } from '../../logic/types';
import { friendly } from '../../sync/family';
import { publishRecipe, unpublishRecipe } from '../../sync/publicRecipes';
import { STORE } from '../../logic/stores';
import { useStore } from '../../store/useStore';
import { Btn, Card, Chip, DISPLAY, Divider, FoodImage, Icon, IconBtn, MacroBar, Notice, NumberField, Pill, Row, Section, T, useTheme } from '../../ui/kit';
import { CUISINE_LABEL } from '../../ui/visual';

export default function RecipeDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id, portions: p0 } = useLocalSearchParams<{ id: string; portions?: string }>();
  const r = RECIPE[id];
  const { liked, disliked, toggleLike, toggleDislike, members, pantry, prices, storePrices, settings } = useStore();
  const [portions, setPortions] = useState(() => {
    const v = parseFloat(p0 ?? '');
    return Number.isFinite(v) && v > 0 ? Math.max(1, Math.ceil(v - 0.2)) : r?.servings ?? 1;
  });
  if (!r) return <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, padding: 16 }}><T>Rețeta nu există.</T></SafeAreaView>;
  const ps = perServing(r);
  const k = portions / r.servings;
  const allergens = recipeAllergens(r);
  const rs = mergeRestrictions(members);
  const conflict = !recipeFits(r, rs);
  const pan = pantryTotals(pantry);
  const diet = recipeDiet(r);
  const store = settings.mainStore;
  const isLiked = liked.includes(r.id);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        <View>
          <FoodImage recipe={r} width="100%" height={340} radius={0} />
          <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <Row style={{ justifyContent: 'space-between', padding: 12 }}>
              <IconBtn icon="chevron-back" tone="card" onPress={() => router.back()} />
              <Row>
                {r.custom && <IconBtn icon="create" tone="card" onPress={() => router.push({ pathname: '/reteta-noua', params: { id: r.id } })} />}
                <IconBtn icon={isLiked ? 'heart' : 'heart-outline'} tone="card" color={isLiked ? t.primary : undefined} onPress={() => toggleLike(r.id)} />
              </Row>
            </Row>
          </SafeAreaView>
        </View>
        <View style={{ marginTop: -26, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: t.bg, padding: 16, gap: 16 }}>
          <View style={{ gap: 8 }}>
            {r.cuisine ? <T v="label" color={t.primary}>{CUISINE_LABEL[r.cuisine]}</T> : null}
            <T v="h1">{r.name}</T>
            {r.custom && (r.author || r.moments?.length) ? (
              <T v="small">{r.author ? `Făcută de ${r.author}` : ''}{r.author && r.moments?.length ? ' · ' : ''}{r.moments?.map((m) => MOMENT_LABEL[m].toLowerCase()).join(', ')}</T>
            ) : null}
            <Row wrap gap={6}>
              <Pill text={`${r.prep} min`} icon="time" />
              <Pill text={`${Math.round(ps.kcal)} kcal/porție`} icon="flame" color={t.primary} bg={t.primarySoft} />
              {r.keepsDays > 0 && <Pill text={`ține ${r.keepsDays} ${r.keepsDays === 1 ? 'zi' : 'zile'}`} icon="snow" />}
              {r.freezable && <Pill text="se congelează" icon="cube" />}
              {fastAllows('strict', r) ? <Pill text="de post" icon="leaf" color={t.accent} bg={t.accentSoft} /> : fastAllows('fish_ok', r) ? <Pill text="post cu pește" icon="leaf" color={t.accent} bg={t.accentSoft} /> : null}
              {diet === 'vegetarian' && <Pill text="vegetarian" icon="leaf" />}
            </Row>
          </View>

          <Btn title="Gătește acum" icon="flame" onPress={() => router.push({ pathname: '/gatit/[id]', params: { id: r.id, portions: String(portions) } })} />
          {r.custom && (
            <Btn title="Trimite rețeta" icon="share-social-outline" variant="secondary"
              onPress={() => Share.share({ message: shareText(r, shareLink(r, useStore.getState().customIngredients)) }).catch(() => {})} />
          )}
          {r.custom && <PublishBlock r={r} />}
          {(r.video || r.source) && (
            <Row>
              {r.video && <Btn title="Video" icon="logo-youtube" variant="secondary" small style={{ flex: 1 }}
                onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${r.video}`)} />}
              {r.source && <Btn title={`Rețeta pe ${r.source.name}`} icon="open-outline" variant="secondary" small style={{ flex: 1 }}
                onPress={() => Linking.openURL(r.source!.url)} />}
            </Row>
          )}

          {conflict && <Notice tone="danger" icon="warning" text="Rețeta nu respectă dieta, alergiile sau ce nu mănâncă cineva din casă. Nu apare în planuri." />}

          <Card style={{ gap: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Stat label="kcal" v={Math.round(ps.kcal)} color={t.primary} />
              <Stat label="proteine" v={`${Math.round(ps.p)} g`} color={t.protein} />
              <Stat label="carbo" v={`${Math.round(ps.c)} g`} color={t.carbs} />
              <Stat label="grăsimi" v={`${Math.round(ps.f)} g`} color={t.fat} />
            </Row>
            <MacroBar p={ps.p} c={ps.c} f={ps.f} />
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="small">Fibre {ps.fib.toFixed(1).replace('.', ',')} g</T>
              <T v="small">Zaharuri {ps.sug.toFixed(1).replace('.', ',')} g</T>
              <T v="small">Sare {ps.salt.toFixed(1).replace('.', ',')} g</T>
            </Row>
            <T v="small">~{fmtRon(costPerPortion(r, prices, store, storePrices))} pe porție{store ? ` la ${STORE[store].name}` : ''}. Valori pe porție, din USDA FoodData Central.</T>
          </Card>

          <Section title="Ingrediente">
            <NumberField label={p0 ? 'Porții (din planul tău)' : 'Porții'} value={portions} step={1} min={1} max={40} onChange={setPortions} />
            <Card style={{ gap: 0, paddingVertical: 4 }}>
              {r.ing.map(([iid, g], i) => {
                const have = (pan[iid] ?? 0) >= g * k;
                const staple = ING[iid]?.staple;
                return (
                  <View key={iid}>
                    {i > 0 && <Divider />}
                    <Row style={{ paddingVertical: 11 }} gap={12}>
                      <T style={{ flex: 1 }} color={staple ? t.muted : t.text}>{ING[iid]?.name}</T>
                      {have && !staple ? <Icon name="checkmark-circle" size={18} color={t.accent} /> : null}
                      <T style={{ fontWeight: '700' }}>{fmtQty(iid, g * k)}</T>
                    </Row>
                  </View>
                );
              })}
            </Card>
            <Row gap={6}><Icon name="checkmark-circle" size={14} color={t.accent} /><T v="small">ai destul în cămară</T></Row>
          </Section>

          <Section title="Mod de preparare">
            {r.steps.map((s, i) => (
              <Row key={i} style={{ alignItems: 'flex-start' }} gap={12}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <T v="small" color={t.bg} style={{ fontFamily: DISPLAY }}>{i + 1}</T>
                </View>
                <T style={{ flex: 1, lineHeight: 22 }}>{s}</T>
              </Row>
            ))}
            {portions / r.servings > 1.6 && <T v="small">Cantitatea e mai mare decât rețeta de bază: folosește o oală sau tavă mai mare și adaugă câteva minute la gătit.</T>}
          </Section>

          <Section title="Ai nevoie de">
            <Row wrap>
              {r.equipment.length === 0 ? <Chip label="Nimic special" /> : r.equipment.map((g) => <Chip key={g.join()} label={g.map((e) => EQUIPMENT_LABEL[e]).join(' sau ')} />)}
            </Row>
          </Section>

          {allergens.length > 0 && (
            <Section title="Alergeni">
              <Row wrap>{allergens.map((a) => <Chip key={a} label={ALLERGEN_LABEL[a]} tone="warn" />)}</Row>
            </Section>
          )}

          <Pressable onPress={() => toggleDislike(r.id)}>
            <Row gap={8} style={{ justifyContent: 'center', padding: 10 }}>
              <Icon name="thumbs-down" size={16} color={disliked.includes(r.id) ? t.danger : t.muted} />
              <T v="small" color={disliked.includes(r.id) ? t.danger : t.muted} style={{ fontWeight: '700' }}>
                {disliked.includes(r.id) ? 'Nu apare în planuri (atinge ca s-o readuci)' : 'Nu-mi place, nu mi-o mai propune'}
              </T>
            </Row>
          </Pressable>
          {r.img && <T v="small" style={{ textAlign: 'center' }}>Foto: {r.credit ?? 'TheMealDB'}</T>}
          {r.source && <T v="small" style={{ textAlign: 'center' }}>Ingredientele: {r.source.name}. Pașii sunt rezumați; rețeta completă e la sursă.{r.video ? ' Imaginea e din video-ul rețetei.' : ''}</T>}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, v, color }: { label: string; v: string | number; color?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <T v="h2" color={color}>{v}</T>
      <T v="small">{label}</T>
    </View>
  );
}

/** rețeta ta la „Rețete de la alții”: o publici, o actualizezi sau o retragi */
function PublishBlock({ r }: { r: Recipe }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const author = r.author?.trim() || useStore.getState().members.find((m) => m.isMain)?.name.trim() || '';
  const run = async (f: () => Promise<string>) => {
    setBusy(true); setMsg(null);
    try { setMsg({ ok: true, text: await f() }); } catch (e) { setMsg({ ok: false, text: friendly(e) }); } finally { setBusy(false); }
  };
  const publish = () => run(async () => {
    const id = await publishRecipe(r, useStore.getState().customIngredients, author, r.publicId);
    useStore.getState().saveRecipe({ ...r, publicId: id });
    return r.publicId ? 'Am actualizat rețeta publicată.' : `Rețeta e la „Rețete de la alții”, cu „făcută de ${author || 'Anonim'}”.`;
  });
  const unpublish = () => run(async () => {
    if (r.publicId) await unpublishRecipe(r.publicId);
    const { publicId: _p, ...rest } = r;
    useStore.getState().saveRecipe(rest);
    return 'Am retras-o. Rămâne la rețetele tale.';
  });
  return (
    <View style={{ gap: 6 }}>
      <Row>
        <Btn title={r.publicId ? 'Actualizează rețeta publicată' : 'Publică pentru toți'} icon="globe-outline" variant="secondary" small style={{ flex: 1 }} disabled={busy} onPress={publish} />
        {r.publicId && <Btn title="Retrage" icon="eye-off-outline" variant="ghost" small disabled={busy} onPress={unpublish} />}
      </Row>
      {!r.publicId && <T v="small">O vede oricine are aplicația, cu numele „{author || 'Anonim'}”. Poza nu se trimite.</T>}
      {msg && <T v="small" color={msg.ok ? t.primary : t.danger}>{msg.text}</T>}
    </View>
  );
}
