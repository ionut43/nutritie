import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ING } from '../data/ingredients';
import { GENERIC } from '../data/generic_foods';
import { RECIPE, RECIPES } from '../data/recipes';
import { todayISO } from '../logic/dates';
import { fmtRon } from '../logic/format';
import { parseNutritionLabel, type LabelValues } from '../logic/labelParser';
import { norm } from '../logic/ocr';
import { perServing } from '../logic/nutrition';
import { fetchProduct, offToIngredient, suggestIngredient, type OffProduct } from '../logic/products';
import { itemKind, parseReceipt, pricePerPackage, splitReceipt, type ReceiptItem } from '../logic/receiptParser';
import type { Ingredient } from '../logic/types';
import type { StoreId } from '../logic/stores';
import { eatenKey, planForDate, useMain, useStore } from '../store/useStore';
import { mealLabel, SLOT_ORDER } from '../logic/planner';
import { IngredientPicker } from '../ui/forms';
import { Btn, Card, Chip, DISPLAY, Divider, Empty, Field, FoodImage, Icon, type IconName, Notice, NumberField, Progress, Row, Segmented, T, useIsDark, useTheme } from '../ui/kit';
import { ocrAvailable, recognizeRows } from '../ui/ocrNative';
import { detectStore, STORE } from '../logic/stores';
import { receiptTotal } from '../logic/receiptParser';
import { CameraSheet } from '../ui/CameraSheet';
import { crumb } from '../ui/diag';
import { downloadModel, downloadSizeMB, modelReady, recognizePlate, resetVisionGuard, visionCrashedBefore, visionSupported } from '../ui/visionNative';

type Mode = 'farfurie' | 'cod' | 'eticheta' | 'bon';

export default function Scan() {
  const t = useTheme();
  const router = useRouter();
  const { mode: m0, pending } = useLocalSearchParams<{ mode?: Mode; pending?: string }>();
  const [mode, setMode] = useState<Mode>(m0 ?? 'farfurie');
  const tabs: { v: Mode; e: IconName; l: string; title: string }[] = [
    { v: 'farfurie', e: 'camera', l: 'Farfurie', title: 'Poză la farfurie' }, { v: 'cod', e: 'barcode', l: 'Cod de bare', title: 'Cod de bare' },
    { v: 'eticheta', e: 'document-text', l: 'Etichetă', title: 'Eticheta produsului' }, { v: 'bon', e: 'receipt', l: 'Bon', title: 'Bonul de la casă' },
  ];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: m0 ? 8 : 0 }}>
        <T v="h1">{m0 ? tabs.find((x) => x.v === m0)?.title : 'Scanează'}</T>
        <Pressable hitSlop={10} onPress={() => router.back()}><Icon name="close" size={28} /></Pressable>
      </Row>
      {!m0 && <Row style={{ paddingHorizontal: 16, paddingVertical: 10 }} gap={8}>
        {tabs.map((x) => (
          <Pressable key={x.v} onPress={() => setMode(x.v)} style={{
            flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, gap: 4,
            backgroundColor: mode === x.v ? t.primary : t.card,
          }}>
            <Icon name={x.e} size={22} color={mode === x.v ? '#fff' : t.muted} />
            <T v="small" color={mode === x.v ? '#fff' : t.muted} style={{ fontWeight: '700', fontSize: 11 }}>{x.l}</T>
          </Pressable>
        ))}
      </Row>}
      <View style={{ flex: 1 }}>
        {mode === 'farfurie' && <PlateMode pending={pending} />}
        {mode === 'cod' && <BarcodeMode />}
        {mode === 'eticheta' && <LabelMode />}
        {mode === 'bon' && <ReceiptMode />}
      </View>
    </SafeAreaView>
  );
}

// ───────── utilitare comune ─────────

async function pickFromGallery() {
  crumb('galerie: deschid');
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false });
  crumb(res.canceled ? 'galerie: renunțat' : `galerie: aleasă ${res.assets[0].width}x${res.assets[0].height} ${res.assets[0].uri.slice(0, 40)}`);
  return res.canceled ? null : { uri: res.assets[0].uri };
}

type Photo = { uri: string };

function PhotoButtons({ onPhoto, label, hint }: { onPhoto: (a: Photo) => void; label: string; hint?: string }) {
  const [cam, setCam] = useState(false);
  return (
    <>
      <Row>
        <Btn title={label} icon="camera" onPress={() => setCam(true)} style={{ flex: 2 }} />
        <Btn title="Galerie" icon="images" variant="secondary" onPress={async () => { const a = await pickFromGallery(); if (a) onPhoto(a); }} style={{ flex: 1 }} />
      </Row>
      <CameraSheet visible={cam} hint={hint ?? label} onClose={() => setCam(false)} onPhoto={onPhoto} />
    </>
  );
}

function Scroll({ children }: { children: React.ReactNode }) {
  return <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
}

const PORTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// ───────── FARFURIE ─────────

interface Candidate { id: string; ref: string; name: string; kcal: number; p: number; c: number; f: number; fib: number; sug: number; salt: number; desc: string }

function candidateOf(id: string, _dark?: boolean): Candidate | null {
  const r = RECIPE[id];
  if (r) {
    const ps = perServing(r);
    return { id, ref: `r:${id}`, name: r.name, ...ps, desc: 'o porție din rețetă' };
  }
  const g = GENERIC[id];
  if (g) {
    const k = g.portion / 100;
    return { id, ref: `g:${id}`, name: g.name, kcal: g.kcal * k, p: g.p * k, c: g.c * k, f: g.f * k, fib: g.fib * k, sug: g.sug * k, salt: g.salt * k, desc: `porție obișnuită, ~${g.portion} g` };
  }
  return null;
}

function CandImage({ id, size, width, height }: { id: string; size?: number; width?: number | `${number}%`; height?: number }) {
  const t = useTheme();
  const r = RECIPE[id];
  if (r) return <FoodImage recipe={r} size={size} width={width} height={height} radius={16} />;
  return (
    <View style={{ width: width ?? size, height: height ?? size, borderRadius: 16, backgroundColor: t.warnSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="fast-food" size={30} color={t.warn} />
    </View>
  );
}

function PlateMode({ pending }: { pending?: string }) {
  const t = useTheme();
  const dark = useIsDark();
  const router = useRouter();
  const { addFood, plans, toggleEaten } = useStore();
  const main = useMain();
  const [ready, setReady] = useState(modelReady());
  const [crashed, setCrashed] = useState(visionCrashedBefore());
  const [dl, setDl] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ id: string; p: number }[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [portion, setPortion] = useState(1);
  const [q, setQ] = useState('');
  const supported = visionSupported();
  const auto = supported && ready && !crashed;
  const strong = (results[0]?.p ?? 0) >= 0.5;

  // ce era de mâncat azi: de cele mai multe ori poza e chiar masa din plan
  const found = planForDate(plans, todayISO());
  const planned = found && main ? found.plan.meals
    .filter((m) => m.day === found.day && !found.plan.eaten.includes(eatenKey(main.id, m.day, m.slot)))
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)) : [];

  const analyze = (a: Photo) => {
    crumb('farfurie: poză primită');
    setPhoto(a); setResults([]); setChosen(null); setErr('');
    // recunoașterea rulează separat de aplicație (WebView), deci pornește singură
    if (auto) recognize(a);
  };
  const recognize = async (given?: Photo) => {
    const a = given ?? photo;
    if (!a || !auto) return;
    setBusy(true);
    try {
      const r = await recognizePlate(a.uri);
      crumb(`farfurie: recunoaștere gata (${r.length})`);
      const rest = r.filter((x) => !planned.some((m) => m.recipeId === x.id));
      setResults(rest);
      // dacă e aproape sigur, îl aleg deja: rămâne doar porția și „Adaugă”
      if (rest[0] && rest[0].p >= 0.6) { setChosen(rest[0].id); setPortion(1); }
    } catch (e) {
      crumb(`farfurie: eroare ${e instanceof Error ? e.message : String(e)}`);
      setErr(e instanceof Error ? e.message : 'Nu am recunoscut poza. Alege din plan sau caută.');
    } finally {
      setBusy(false);
    }
  };

  const search = useMemo(() => {
    if (q.trim().length < 2) return [];
    const n = norm(q);
    return [...RECIPES.map((r) => r.id), ...Object.keys(GENERIC)]
      .map((id) => candidateOf(id, dark)!).filter((c) => c && norm(c.name).includes(n)).slice(0, 8);
  }, [q, dark]);

  // Android a închis aplicația cât era deschisă galeria/camera: poza aleasă vine înapoi de aici
  useEffect(() => { if (pending) { crumb('farfurie: reiau poza după repornire'); analyze({ uri: pending }); } }, [pending]);

  const c = chosen ? candidateOf(chosen, dark) : null;

  return (
    <Scroll>
      {pending && !photo ? <T v="small">Telefonul a închis aplicația cât erai în galerie. Am păstrat poza aleasă.</T> : null}
      {!photo && <T color={t.muted}>Fă o poză la ce mănânci. Îți arăt întâi ce aveai în plan azi, apoi ce seamănă cu poza.</T>}
      <PhotoButtons label={photo ? 'Altă poză' : 'Fă poza'} hint="Farfuria, de sus, cu lumină bună" onPhoto={analyze} />
      {photo && <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 220, borderRadius: 18 }} />}

      {results.length > 0 && strong === true && (
        <View style={{ gap: 10 }}>
          <T v="h3">{true ? 'Seamănă cu' : planned.length ? 'Sau poate e' : 'Seamănă cu'}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {results.map((r) => {
              const x = candidateOf(r.id, dark);
              if (!x) return null;
              const sel = chosen === r.id;
              return (
                <Pressable key={r.id} onPress={() => setChosen(r.id)} style={{
                  width: '48%', borderRadius: 16, overflow: 'hidden', backgroundColor: t.card, borderWidth: 2, borderColor: sel ? t.primary : t.border,
                }}>
                  <CandImage id={r.id} width="100%" height={110} />
                  <View style={{ padding: 8, gap: 2 }}>
                    <T style={{ fontWeight: '600', fontSize: 13 }} numberOfLines={2}>{x.name}</T>
                    <T v="small">{Math.round(x.kcal)} kcal</T>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {photo && planned.length > 0 && (
        <View style={{ gap: 8 }}>
          <T v="h3">{strong ? 'Sau e din planul de azi?' : 'E din planul de azi?'}</T>
          {planned.map((m) => {
            const r = RECIPE[m.recipeId];
            return (
              <Pressable key={m.slot} onPress={() => { if (found) { toggleEaten(found.plan.id, m.day, m.slot); router.back(); } }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, opacity: pressed ? 0.7 : 1 })}>
                <FoodImage recipe={r} size={56} radius={12} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '600' }} numberOfLines={2}>{r?.name}</T>
                  <T v="small">{mealLabel(m.slot)}, porția din plan</T>
                </View>
                <T style={{ fontFamily: DISPLAY, color: t.primary }}>Da</T>
              </Pressable>
            );
          })}
        </View>
      )}

      {photo && auto && !busy && results.length === 0 && (
        <Btn title="Recunoaște automat ce e în poză" icon="sparkles" variant="secondary" small onPress={() => recognize()} />
      )}
      {results.length > 0 && strong === false && (
        <View style={{ gap: 10 }}>
          <T v="h3">{false ? 'Seamănă cu' : planned.length ? 'Sau poate e' : 'Seamănă cu'}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {results.map((r) => {
              const x = candidateOf(r.id, dark);
              if (!x) return null;
              const sel = chosen === r.id;
              return (
                <Pressable key={r.id} onPress={() => setChosen(r.id)} style={{
                  width: '48%', borderRadius: 16, overflow: 'hidden', backgroundColor: t.card, borderWidth: 2, borderColor: sel ? t.primary : t.border,
                }}>
                  <CandImage id={r.id} width="100%" height={110} />
                  <View style={{ padding: 8, gap: 2 }}>
                    <T style={{ fontWeight: '600', fontSize: 13 }} numberOfLines={2}>{x.name}</T>
                    <T v="small">{Math.round(x.kcal)} kcal</T>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {busy && <Row style={{ justifyContent: 'center', padding: 12 }}><ActivityIndicator color={t.primary} /><T v="small">  Mă uit la poză</T></Row>}
      {err ? <T v="small" color={t.warn}>{err}</T> : null}

      {photo && (
        <View style={{ gap: 8 }}>
          <Field value={q} onChangeText={setQ} placeholder="Nu e aici? Scrie ce e (ex. sarmale)" icon="search" />
          {search.map((x) => (
            <Pressable key={x.id} onPress={() => { setChosen(x.id); setQ(''); }} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 6 }}>
              <CandImage id={x.id} size={40} /><T style={{ flex: 1 }}>{x.name}</T><T v="small">{Math.round(x.kcal)} kcal</T>
            </Pressable>
          ))}
        </View>
      )}

      {c && (
        <Card tone="primary" style={{ gap: 10 }}>
          <T v="h3">{c.name}</T>
          <T v="small">Cât ai mâncat față de {c.desc}?</T>
          <Segmented options={PORTIONS.map((v) => ({ label: v === 1 ? '1×' : `${String(v).replace('.', ',')}×`, value: v }))} value={portion} onChange={setPortion} />
          <T v="h2">{Math.round(c.kcal * portion)} kcal</T>
          <Btn title="Adaugă" icon="checkmark" onPress={() => {
            addFood({
              memberId: main?.id, dateISO: todayISO(), label: `${c.name}${portion !== 1 ? ` (${String(portion).replace('.', ',')}×)` : ''}`,
              kcal: c.kcal * portion, p: c.p * portion, c: c.c * portion, f: c.f * portion, fib: c.fib * portion, sug: c.sug * portion, salt: c.salt * portion,
              ref: c.ref, g: portion, approx: true,
            });
            router.back();
          }} />
        </Card>
      )}

      {/* recunoașterea automată e opțională și stă la final, ca să nu încurce */}
      {supported && crashed && (
        <View style={{ gap: 6, marginTop: 10 }}>
          <T v="small">Data trecută recunoașterea s-a oprit în timp ce lucra, așa că am oprit-o. Alegerea din plan și căutarea merg normal.</T>
          <Btn title="Încearcă din nou recunoașterea" variant="ghost" small onPress={() => { resetVisionGuard(); setCrashed(false); }} />
        </View>
      )}
      {supported && !ready && !crashed && (
        <View style={{ gap: 8, marginTop: 10 }}>
          <T v="small">Opțional: recunoașterea automată a mâncării din poză merge pe telefon, fără internet, după o descărcare de {downloadSizeMB()} MB (o singură dată, pe Wi-Fi).</T>
          {dl !== null ? <Progress value={dl} max={1} height={6} /> : null}
          <Btn title={dl !== null ? `Se descarcă ${Math.round(dl * 100)}%` : 'Descarcă recunoașterea'} icon="download" variant="secondary" small disabled={dl !== null}
            onPress={async () => {
              setDl(0); setErr('');
              try { await downloadModel(setDl); setReady(true); } catch (e) { setErr(e instanceof Error ? e.message : 'Descărcarea nu s-a terminat. Încearcă din nou pe Wi-Fi.'); }
              setDl(null);
            }} />
        </View>
      )}
    </Scroll>
  );
}

// ───────── COD DE BARE ─────────

function BarcodeMode() {
  const t = useTheme();
  const [perm, requestPerm] = useCameraPermissions();
  const [code, setCode] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<OffProduct | null>(null);
  const [notFound, setNotFound] = useState(false);
  const lock = useRef(false);

  const lookup = async (c: string) => {
    if (lock.current) return;
    lock.current = true;
    setCode(c); setLoading(true); setNotFound(false); setProduct(null);
    try {
      const p = await fetchProduct(c);
      if (p) setProduct(p); else setNotFound(true);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };
  const reset = () => { lock.current = false; setCode(null); setProduct(null); setNotFound(false); };

  if (code) {
    return (
      <Scroll>
        {loading && <Row style={{ justifyContent: 'center', padding: 20 }}><ActivityIndicator color={t.primary} /><T v="small">  Caut produsul {code}…</T></Row>}
        {notFound && (
          <Card style={{ gap: 10 }}>
            <T v="h3">Produsul {code} nu e în baza Open Food Facts</T>
            <T v="small">Fotografiază eticheta cu valorile nutriționale din tabul „Etichetă” și îl salvez eu.</T>
            <Btn title="Scanează alt produs" variant="secondary" onPress={reset} />
          </Card>
        )}
        {product && <ProductActions code={code} product={product} onDone={reset} />}
      </Scroll>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      {!perm ? null : !perm.granted ? (
        <Empty icon="camera-outline" title="Am nevoie de cameră" text="Pentru a citi codul de bare de pe produs."
          action={<Btn title="Permite camera" onPress={requestPerm} />} />
      ) : (
        <View style={{ flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' }}>
          <CameraView style={{ flex: 1 }} facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={(r) => { if (r.data) lookup(r.data); }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: '12%', right: '12%', top: '38%', height: 110, borderWidth: 3, borderColor: '#fff', borderRadius: 16 }} />
        </View>
      )}
      <T v="small" style={{ textAlign: 'center' }}>Ține codul de bare în chenar. Datele vin gratuit din Open Food Facts.</T>
      <Row>
        <View style={{ flex: 1 }}><Field value={manual} onChangeText={setManual} placeholder="sau scrie codul" keyboardType="decimal-pad" /></View>
        <Btn title="Caută" small disabled={manual.length < 8} onPress={() => lookup(manual.trim())} />
      </Row>
    </View>
  );
}

function ProductActions({ code, product, onDone }: { code: string; product: OffProduct; onDone: () => void }) {
  const ing = useMemo(() => offToIngredient(code, product), [code, product]);
  const suggestion = useMemo(() => suggestIngredient(product), [product]);
  if (!ing) {
    return (
      <Card style={{ gap: 10 }}>
        <T v="h3">{product.product_name ?? code}</T>
        <T v="small">Produsul nu are valori nutriționale în baza de date. Fotografiază eticheta din tabul „Etichetă”.</T>
        <Btn title="Scanează alt produs" variant="secondary" onPress={onDone} />
      </Card>
    );
  }
  return <SaveProduct ing={ing} suggestion={suggestion} onDone={onDone} />;
}

/** Comun pentru cod de bare și etichetă: produs → jurnal și/sau cămară */
function SaveProduct({ ing: ing0, suggestion, onDone }: { ing: Ingredient; suggestion?: string; onDone: () => void }) {
  const router = useRouter();
  const { saveIngredient, addFood, addPantry, setPrice } = useStore();
  const main = useMain();
  const [ing, setIng] = useState(ing0);
  const [grams, setGrams] = useState(Math.min(ing0.pkg || 100, 100));
  const [asIng, setAsIng] = useState<string | undefined>(suggestion);
  const [price, setPriceTxt] = useState('');
  const [saved, setSaved] = useState('');
  const k = grams / 100;

  const persist = () => { const x = { ...ing, custom: true, price: parseFloat(price.replace(',', '.')) || ing.price }; saveIngredient(x); return x; };

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 8 }}>
        <Field label="Nume" value={ing.name} onChangeText={(name) => setIng({ ...ing, name })} />
        <T v="label">La 100 g</T>
        <Row wrap gap={6}>
          <Chip label={`${ing.kcal} kcal`} /><Chip label={`P ${ing.p} g`} /><Chip label={`C ${ing.c} g`} /><Chip label={`G ${ing.f} g`} />
          <Chip label={`fibre ${ing.fib} g`} /><Chip label={`zaharuri ${ing.sug} g`} /><Chip label={`sare ${ing.salt} g`} />
        </Row>
        {ing.pkg ? <T v="small">Ambalaj: {ing.pkg} {ing.unit === 'ml' ? 'ml' : 'g'}</T> : null}
      </Card>

      <Card style={{ gap: 10 }}>
        <T v="h3">🍴 Am mâncat</T>
        <NumberField value={grams} step={10} min={1} max={5000} suffix="g" onChange={setGrams} />
        <T v="small">{Math.round(ing.kcal * k)} kcal · P {Math.round(ing.p * k)} g · C {Math.round(ing.c * k)} g · G {Math.round(ing.f * k)} g</T>
        <Btn title="Adaugă în jurnalul de azi" icon="add-circle" onPress={() => {
          persist();
          addFood({ memberId: main?.id, dateISO: todayISO(), label: `${ing.name} (${grams} g)`, kcal: ing.kcal * k, p: ing.p * k, c: ing.c * k, f: ing.f * k, fib: ing.fib * k, sug: ing.sug * k, salt: ing.salt * k });
          setSaved('Adăugat în jurnal.');
        }} />
      </Card>

      <Card style={{ gap: 10 }}>
        <T v="h3">🥫 Pune în cămară</T>
        <T v="small">Ca să-l folosească planul și lista de cumpărături, spune-mi ce ingredient din rețete e:</T>
        <Row wrap>
          {suggestion && <Chip label={`Ca ${ING[suggestion]?.name}`} selected={asIng === suggestion} onPress={() => setAsIng(suggestion)} />}
          <Chip label="Produs separat" selected={!asIng} onPress={() => setAsIng(undefined)} />
        </Row>
        <Field label="Preț plătit (opțional)" value={price} onChangeText={setPriceTxt} placeholder="ex. 7,49" keyboardType="decimal-pad" />
        <Btn title="Pune în cămară" icon="file-tray-stacked-outline" variant="secondary" onPress={() => {
          const p = persist();
          const target = asIng ?? p.id;
          const g = ing.pkg || 100;
          addPantry(target, g);
          const pr = parseFloat(price.replace(',', '.'));
          if (asIng && pr > 0) setPrice(asIng, Math.round((pr / g) * ING[asIng].pkg * 10) / 10);
          setSaved(`Pus în cămară${pr > 0 ? `, preț ${fmtRon(pr)}` : ''}.`);
        }} />
      </Card>
      {saved ? <Notice tone="primary" icon="checkmark-circle-outline" text={saved} /> : null}
      <Row>
        <Btn title="Alt produs" variant="secondary" onPress={onDone} style={{ flex: 1 }} />
        <Btn title="Gata" onPress={() => router.back()} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}

// ───────── ETICHETĂ ─────────

function LabelMode() {
  const [lid] = useState(`l_${Date.now().toString(36)}`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [vals, setVals] = useState<LabelValues | null>(null);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const run = async (a: Photo) => {
    setPhoto(a.uri); setErr(''); setBusy(true); setVals(null);
    try {
      const rows = await recognizeRows(a.uri);
      const v = parseNutritionLabel(rows);
      if (v.found < 3) setErr('Nu am găsit tabelul nutrițional. Fotografiază-l mai de aproape, drept și cu lumină bună.');
      setVals(v);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Nu am putut citi eticheta.');
    } finally {
      setBusy(false);
    }
  };

  const edit = (k: keyof LabelValues, v: number) => vals && setVals({ ...vals, [k]: v });
  const ing: Ingredient | null = vals && vals.kcal !== undefined ? {
    id: lid, name: name.trim() || 'Produs', aisle: 'altele', kcal: Math.round(vals.kcal), p: vals.p ?? 0, c: vals.c ?? 0, f: vals.f ?? 0,
    fib: vals.fib ?? 0, sug: vals.sug ?? 0, salt: vals.salt ?? 0, allergens: [], unit: 'g', pkg: vals.netG ?? 100, price: 0, shelfDays: 30, custom: true,
  } : null;

  return (
    <Scroll>
      <Notice tone="primary" icon="text-outline" text="Fotografiază tabelul cu valori nutriționale. Textul se citește pe telefon, fără internet." />
      {!ocrAvailable && <Notice tone="warn" text="Citirea etichetelor merge în aplicația instalată (nu în Expo Go sau în browser)." />}
      <PhotoButtons label="Fotografiază eticheta" onPhoto={run} />
      {photo && <Image source={{ uri: photo }} style={{ width: '100%', height: 180, borderRadius: 16 }} resizeMode="cover" />}
      {busy && <Row style={{ justifyContent: 'center', padding: 12 }}><ActivityIndicator /><T v="small">  Citesc eticheta…</T></Row>}
      {err ? <Notice tone="accent" icon="alert-circle" text={err} /> : null}
      {vals && (
        <Card style={{ gap: 10 }}>
          <T v="h3">Am citit (la 100 g){vals.confident ? ' ✓' : ''}</T>
          {!vals.confident && <T v="small">Verifică valorile: caloriile nu se potrivesc perfect cu proteinele, carbohidrații și grăsimile.</T>}
          <Field label="Numele produsului" value={name} onChangeText={setName} placeholder="ex. Fulgi de ovăz X" />
          {([['kcal', 'Calorii (kcal)'], ['p', 'Proteine (g)'], ['c', 'Carbohidrați (g)'], ['f', 'Grăsimi (g)'], ['fib', 'Fibre (g)'], ['sug', 'Zaharuri (g)'], ['salt', 'Sare (g)'], ['netG', 'Cantitate în ambalaj (g)']] as const).map(([k, l]) => (
            <NumberField key={k} label={l} value={Number(vals[k] ?? 0)} step={k === 'salt' ? 0.1 : 1} decimals={1} min={0} max={k === 'kcal' ? 900 : k === 'netG' ? 20000 : 100} onChange={(v) => edit(k, v)} />
          ))}
        </Card>
      )}
      {ing && name.trim().length > 1 && <SaveProduct ing={ing} onDone={() => { setVals(null); setPhoto(null); setName(''); }} />}
    </Scroll>
  );
}

// ───────── BON ─────────

function ReceiptMode() {
  const t = useTheme();
  const router = useRouter();
  const { applyReceipt, receiptAliases, settings } = useStore();
  const [store, setStore] = useState<StoreId | undefined>();
  const [paid, setPaid] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [items, setItems] = useState<(ReceiptItem & { on: boolean })[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  const [updatePrices, setUpdatePrices] = useState(true);
  const [done, setDone] = useState(false);

  const run = async (a: Photo) => {
    setErr(''); setBusy(true); setDone(false);
    try {
      const rows = await recognizeRows(a.uri);
      const st = detectStore(rows.join('\n'));
      if (st) setStore(st);
      const tot = receiptTotal(rows);
      if (tot) setPaid(tot);
      const parsed = parseReceipt(rows).map((it) => {
        const alias = receiptAliases[it.name];
        const ingId = it.kind === 'nealimentar' ? undefined : alias ?? it.ingId;
        const grams = it.grams ?? (ingId ? ING[ingId].pkg * (it.qty ?? 1) : undefined);
        return { ...it, ingId, grams, kind: itemKind(it.name, ingId), on: !!ingId };
      });
      if (!parsed.length) setErr('Nu am găsit produse pe bon. Fotografiază-l întins, de aproape, cu lumină bună.');
      setItems((prev) => [...prev, ...parsed]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Nu am putut citi bonul.');
    } finally {
      setBusy(false);
    }
  };

  const chosen = items.filter((i) => i.on && i.ingId && i.grams);
  const total = items.reduce((a, i) => a + i.total, 0);
  const split = splitReceipt(items, paid);

  return (
    <Scroll>
      <Notice tone="primary" icon="receipt" text="Fotografiază bonul (poți face mai multe poze pentru bonuri lungi). Produsele intră în cămară și prețurile se actualizează după ce ai plătit." />
      {!ocrAvailable && <Notice tone="warn" text="Citirea bonurilor merge în aplicația instalată (nu în Expo Go sau în browser)." />}
      <PhotoButtons label={items.length ? 'Încă o poză' : 'Fotografiază bonul'} onPhoto={run} />
      {busy && <Row style={{ justifyContent: 'center', padding: 12 }}><ActivityIndicator /><T v="small">  Citesc bonul…</T></Row>}
      {err ? <Notice tone="accent" icon="alert-circle" text={err} /> : null}

      {items.length > 0 && (
        <>
          <Card style={{ gap: 10 }}>
            <T v="small" style={{ fontWeight: '700' }}>Magazinul</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(settings.stores ?? []).concat(store && !(settings.stores ?? []).includes(store) ? [store] : []).concat(['altul']).map((s) => (
                <Chip key={s} label={STORE[s].name} selected={store === s} color={STORE[s].color} onPress={() => setStore(s)} />
              ))}
            </ScrollView>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="small">{items.length} produse găsite · suma lor ~{fmtRon(total)}</T>
              {paid ? <T style={{ fontFamily: DISPLAY }}>Total bon {fmtRon(paid)}</T> : null}
            </Row>
            <T v="small" color={t.text}>
              Mâncare {fmtRon(split.food)}{split.nonFood > 0 ? `, altele (nu se mănâncă) ${fmtRon(split.nonFood)}` : ''}. La cheltuielile pe mâncare intră doar {fmtRon(split.food)}.
            </T>
          </Card>
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            {items.map((it, i) => (
              <View key={`${it.raw}${i}`}>
                {i > 0 && <Divider />}
                <View style={{ paddingVertical: 10, gap: 6, opacity: it.on ? 1 : 0.5 }}>
                  <Row>
                    <Pressable hitSlop={8} onPress={() => setItems(items.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}>
                      <Icon name={it.on ? 'checkbox' : 'square-outline'} size={24} color={it.on ? t.primary : t.muted} />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <T v="small">{it.name}</T>
                      {it.kind === 'nealimentar' ? (
                        <Pressable onPress={() => setItems(items.map((x, j) => (j === i ? { ...x, kind: 'altele' } : x)))}>
                          <T v="small" color={t.muted}>Nu e mâncare: nu intră în cămară și nici la cheltuielile pe mâncare. E mâncare? Atinge aici.</T>
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => setPick(i)}>
                          <T style={{ fontWeight: '700' }} color={it.ingId ? t.text : t.accent}>{it.ingId ? ING[it.ingId].name : 'Alege ingredientul (sau lasă, dacă e dulce, suc etc.)'} ›</T>
                        </Pressable>
                      )}
                    </View>
                    <T style={{ fontWeight: '700' }}>{fmtRon(it.total)}</T>
                  </Row>
                  {it.on && it.ingId && (
                    <NumberField value={it.grams ?? 0} step={ING[it.ingId].gPerPiece ?? 50} min={1} max={20000} suffix="g"
                      onChange={(g) => setItems(items.map((x, j) => (j === i ? { ...x, grams: g } : x)))} />
                  )}
                </View>
              </View>
            ))}
          </Card>
          <Pressable onPress={() => setUpdatePrices(!updatePrices)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name={updatePrices ? 'checkbox' : 'square-outline'} size={22} color={t.primary} />
            <T v="small" color={t.text}>Salvează prețurile ca prețuri reale{store ? ` la ${STORE[store].name}` : ''}</T>
          </Pressable>
          <Btn title={`Pune ${chosen.length} produse în cămară`} icon="file-tray-stacked" disabled={!chosen.length} onPress={() => {
            applyReceipt(chosen.map((it) => ({
              ingId: it.ingId!, g: it.grams!, name: it.name,
              price: updatePrices ? pricePerPackage({ ...it, grams: it.grams }) : undefined,
            })), store ?? settings.mainStore, paid ?? total, split.nonFood);
            setDone(true);
            setItems([]);
          }} />
        </>
      )}
      {done && (
        <Card tone="primary" style={{ gap: 8 }}>
          <T v="h3">Gata, sunt în cămară</T>
          <T v="small">Lista și cheltuielile s-au actualizat, iar prețurile magazinului sunt acum cele reale. Am ținut minte corecturile tale pentru bonurile următoare.</T>
          <Btn title="Vezi cămara" onPress={() => router.replace({ pathname: '/lista', params: { tab: 'camara' } })} />
        </Card>
      )}
      <IngredientPicker visible={pick !== null} onClose={() => setPick(null)}
        onPick={(id) => {
          if (pick === null) return;
          setItems(items.map((x, j) => (j === pick ? { ...x, ingId: id, kind: 'aliment', on: true, grams: x.unit === 'kg' && x.qty ? x.qty * 1000 : ING[id].pkg * (x.qty ?? 1) } : x)));
          setPick(null);
        }} />
    </Scroll>
  );
}
