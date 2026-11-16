import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RECIPE } from '../data/recipes';
import { todayISO } from '../logic/dates';
import { fmtRon } from '../logic/format';
import { perServing, proteinKind } from '../logic/nutrition';
import { BUDGET_SLACK, buildOnce, mainsNeeded, swipeDeck } from '../logic/planner';
import type { Recipe, WeekHousehold } from '../logic/types';
import { useStore } from '../store/useStore';
import { tap, success } from '../ui/haptics';
import { Btn, DISPLAY, DISPLAY_X, FoodImage, Icon, IconBtn, Progress, Row, T, useTheme } from '../ui/kit';
import { CUISINE_LABEL, KIND_LABEL } from '../ui/visual';

/** Alegi felurile săptămânii prin swipe: dreapta vreau, stânga nu. Restul planului se face singur. */
export default function Choose() {
  const t = useTheme();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ start?: string; ids?: string; guests?: string; fast?: string }>();
  const s = useStore();
  const start = params.start ?? todayISO();
  const hh: WeekHousehold = useMemo(() => ({
    memberIds: params.ids ? params.ids.split(',') : s.members.map((m) => m.id),
    guests: Number(params.guests ?? 0) || 0,
    applyFasting: params.fast !== '0',
  }), [params.ids, params.guests, params.fast]);
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const input = useMemo(() => s.planInput(start, hh, seed), [start, hh, seed]);
  const deck = useMemo(() => swipeDeck(input, 40), [input]);
  const need = useMemo(() => Math.min(8, mainsNeeded(input)), [input]);

  const [idx, setIdx] = useState(0);
  const [wanted, setWanted] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [hist, setHist] = useState<('w' | 's')[]>([]);
  const [done, setDone] = useState(false);
  const pos = useRef(new Animated.ValueXY()).current;
  const budget = s.settings.budgetRon;

  // cât ar costa săptămâna cu ce ai ales până acum (planul complet: mic dejun, gustări, tot)
  const costCache = useRef(new Map<string, number>()).current;
  const estimate = (ids: string[]) => {
    const k = ids.join(',');
    if (!costCache.has(k)) costCache.set(k, buildOnce({ ...input, wanted: ids, skipped }, 3.5).cost);
    return costCache.get(k)!;
  };
  const base = useMemo(() => estimate(wanted), [wanted]);
  const [withCur, setWithCur] = useState<number | null>(null);
  const [noFit, setNoFit] = useState(0);
  // o carte care ar trece planul peste buget nu ți-o mai arăt (las un pic de loc: marja de 50 lei e pentru restul planului)
  useEffect(() => {
    const r = deck[idx];
    if (!r || done) return;
    const h = setTimeout(() => {
      const c = estimate([...wanted, r.id]);
      if (c > budget + BUDGET_SLACK * 0.3) { setNoFit((n) => n + 1); setIdx((i) => i + 1); }
      else setWithCur(c);
    }, 0);
    return () => clearTimeout(h);
  }, [idx, wanted, done]);

  const cardW = Math.min(width - 32, 440);
  const cardH = Math.min(height * 0.62, cardW * 1.38);
  const finished = done || idx >= deck.length;

  const decide = (like: boolean) => {
    const r = deck[idx];
    if (!r) return;
    tap();
    if (like) {
      const w = [...wanted, r.id];
      setWanted(w);
      if (w.length >= need) { success(); setDone(true); }
    } else setSkipped((x) => [...x, r.id]);
    setHist((h) => [...h, like ? 'w' : 's']);
    setIdx((i) => i + 1);
    setWithCur(null);
    pos.setValue({ x: 0, y: 0 });
  };
  const fling = (like: boolean) => {
    Animated.timing(pos, { toValue: { x: (like ? 1 : -1) * width * 1.3, y: 0 }, duration: 220, useNativeDriver: false }).start(() => decide(like));
  };
  const undo = () => {
    const last = hist[hist.length - 1];
    if (!last) return;
    tap();
    setHist((h) => h.slice(0, -1));
    setIdx((i) => i - 1);
    setDone(false);
    if (last === 'w') setWanted((w) => w.slice(0, -1));
    else setSkipped((x) => x.slice(0, -1));
  };

  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8,
    onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      if (g.dx > 110 || g.vx > 0.8) fling(true);
      else if (g.dx < -110 || g.vx < -0.8) fling(false);
      else Animated.spring(pos, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: false }).start();
    },
  }), [idx, wanted, need, width]);

  const finish = () => {
    const swipes: Record<string, 1 | -1> = {};
    for (const id of wanted) swipes[id] = 1;
    for (const id of skipped) swipes[id] = -1;
    s.recordSwipes(swipes);
    s.generate(start, hh, seed, undefined, { wanted, skipped });
    success();
    router.back();
    router.navigate('/plan');
  };

  const rotate = pos.x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-14deg', '0deg', '14deg'] });
  const yes = pos.x.interpolate({ inputRange: [20, 110], outputRange: [0, 1], extrapolate: 'clamp' });
  const no = pos.x.interpolate({ inputRange: [-110, -20], outputRange: [1, 0], extrapolate: 'clamp' });
  const nextScale = pos.x.interpolate({ inputRange: [-width, 0, width], outputRange: [1, 0.94, 1], extrapolate: 'clamp' });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 6, gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <IconBtn icon="close" onPress={() => router.back()} />
          <View style={{ alignItems: 'center' }}>
            <T v="h3">{finished ? 'Săptămâna ta' : 'Ce-ți face poftă?'}</T>
            <T v="small">{wanted.length === 0 ? `Alege ${need} feluri, bugetul e ${fmtRon(budget)}` : `${wanted.length} din ${need} alese, săptămâna ar costa ${fmtRon(base)} din ${fmtRon(budget)}`}</T>
          </View>
          <IconBtn icon="arrow-undo" onPress={undo} color={hist.length ? t.text : t.muted} />
        </Row>
        <Progress value={wanted.length ? base : 0} max={budget} height={5} color={base > budget ? t.warn : t.accent} />
      </View>

      {!finished ? (
        <>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {deck[idx + 1] && (
              <Animated.View style={{ position: 'absolute', transform: [{ scale: nextScale }] }}>
                <SwipeCard r={deck[idx + 1]} w={cardW} h={cardH} delta={null} />
              </Animated.View>
            )}
            <Animated.View {...responder.panHandlers}
              style={{ transform: [{ translateX: pos.x }, { translateY: Animated.multiply(pos.y, 0.25) }, { rotate }] }}>
              <SwipeCard r={deck[idx]} w={cardW} h={cardH} delta={withCur == null ? null : withCur - base}
                onInfo={() => router.push({ pathname: '/reteta/[id]', params: { id: deck[idx].id } })} />
              <Animated.View style={{ position: 'absolute', top: 28, left: 22, opacity: yes, transform: [{ rotate: '-12deg' }] }}>
                <Stamp text="Da!" color={t.accent} />
              </Animated.View>
              <Animated.View style={{ position: 'absolute', top: 28, right: 22, opacity: no, transform: [{ rotate: '12deg' }] }}>
                <Stamp text="Nu" color={t.danger} />
              </Animated.View>
            </Animated.View>
          </View>
          <Row style={{ justifyContent: 'center', gap: 28, paddingBottom: 6 }}>
            <RoundBtn icon="close" color={t.danger} size={66} onPress={() => fling(false)} />
            <RoundBtn icon="heart" color="#fff" bg={t.primary} size={78} onPress={() => fling(true)} />
          </Row>
          <View style={{ paddingHorizontal: 16, paddingBottom: 10, alignItems: 'center' }}>
            {wanted.length > 0 ? (
              <Pressable onPress={() => setDone(true)} hitSlop={8}>
                <T v="small" color={t.primary} style={{ fontFamily: DISPLAY }}>Ajunge, completează tu restul</T>
              </Pressable>
            ) : <T v="small">Trage la dreapta ce vrei, la stânga ce nu.</T>}
          </View>
        </>
      ) : (
        <Summary wanted={wanted} need={need} cost={base} budget={budget} noFit={noFit} onMore={() => setDone(false)} canMore={idx < deck.length} onFinish={finish} />
      )}
    </SafeAreaView>
  );
}

function SwipeCard({ r, w, h, delta, onInfo }: { r: Recipe; w: number; h: number; delta: number | null; onInfo?: () => void }) {
  const t = useTheme();
  const ps = perServing(r);
  return (
    <View style={{ width: w, height: h, borderRadius: 30, overflow: 'hidden', backgroundColor: t.card,
      shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
      <FoodImage recipe={r} width="100%" height={h} radius={0} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h * 0.5, backgroundColor: 'rgba(0,0,0,0.0)' }}>
        {[0.0, 0.12, 0.28, 0.45, 0.6].map((o, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: `rgba(12,12,14,${o})` }} />
        ))}
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, gap: 8 }}>
        <T v="label" color="rgba(255,255,255,0.85)">{r.cuisine ? `${CUISINE_LABEL[r.cuisine]}, cu ` : 'Cu '}{KIND_LABEL[proteinKind(r)]}</T>
        <T v="h1" color="#fff" style={{ fontSize: 28, lineHeight: 33 }} numberOfLines={3}>{r.name}</T>
        <Row gap={8} wrap>
          <Tag icon="flame" text={`${Math.round(ps.kcal)} kcal`} />
          <Tag icon="barbell" text={`${Math.round(ps.p)} g proteine`} />
          <Tag icon="time" text={`${r.prep} min`} />
          {delta != null && <Tag icon="wallet" text={delta <= 0.5 ? 'nu crește costul' : `+${fmtRon(delta)} la săptămână`} />}
        </Row>
      </View>
      {onInfo && (
        <Pressable onPress={onInfo} hitSlop={10} style={{ position: 'absolute', top: 16, right: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="information" color="#fff" size={22} />
        </Pressable>
      )}
    </View>
  );
}

function Tag({ icon, text }: { icon: 'flame' | 'barbell' | 'time' | 'wallet'; text: string }) {
  return (
    <Row gap={5} style={{ backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
      <Icon name={icon} size={13} color="#fff" />
      <T v="small" color="#fff" style={{ fontWeight: '700' }}>{text}</T>
    </Row>
  );
}

function Stamp({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ borderWidth: 4, borderColor: color, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.85)' }}>
      <T style={{ color, fontSize: 30, fontFamily: DISPLAY_X }}>{text}</T>
    </View>
  );
}

function RoundBtn({ icon, color, bg, size, onPress }: { icon: 'close' | 'heart'; color: string; bg?: string; size: number; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={icon === 'heart' ? 'Vreau' : 'Nu'}
      style={({ pressed }) => ({
        width: size, height: size, borderRadius: size / 2, backgroundColor: bg ?? t.card, alignItems: 'center', justifyContent: 'center',
        transform: [{ scale: pressed ? 0.9 : 1 }], shadowColor: bg ?? '#000', shadowOpacity: bg ? 0.35 : 0.1, shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 }, elevation: 6,
      })}>
      <Icon name={icon} size={size * 0.46} color={color} />
    </Pressable>
  );
}

function Summary({ wanted, need, cost, budget, noFit, onMore, canMore, onFinish }: {
  wanted: string[]; need: number; cost: number; budget: number; noFit: number; onMore: () => void; canMore: boolean; onFinish: () => void;
}) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const tile = (Math.min(width, 472) - 32 - 10) / 2;
  const missing = Math.max(0, need - wanted.length);
  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 20 }}>
        <T v="h1">{wanted.length === 0 ? 'Nimic nu ți-a făcut poftă?' : missing === 0 ? 'Arată bine!' : 'Bună alegere'}</T>
        <T color={t.muted}>
          {wanted.length === 0
            ? 'Fac eu planul după gusturile tale. Poți schimba orice masă după aceea.'
            : missing === 0
              ? 'Pun felurile astea în zilele potrivite, adaug micul dejun și gustările și fac lista pentru magazinul tău.'
              : `Pun felurile alese în plan și mai adaug ${missing === 1 ? 'unul' : missing} după gusturile tale.`}
          {' '}Toată săptămâna, cu mic dejun și gustări, iese cam {fmtRon(cost)} din {fmtRon(budget)}.
          {noFit > 0 ? ' Ți-am arătat doar mâncăruri care încap în buget.' : ''}
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {wanted.map((id) => RECIPE[id] && (
            <View key={id} style={{ width: tile, gap: 6 }}>
              <FoodImage recipe={RECIPE[id]} width={tile} height={tile} radius={18} />
              <T v="small" color={t.text} style={{ fontWeight: '600' }} numberOfLines={2}>{RECIPE[id].name}</T>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={{ padding: 16, gap: 10 }}>
        <Btn title="Fă planul și lista" icon="checkmark" onPress={onFinish} />
        {canMore && <Btn title="Mai aleg" variant="secondary" onPress={onMore} />}
      </View>
    </>
  );
}
