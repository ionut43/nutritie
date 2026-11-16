import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Recipe } from '../logic/types';
import { DISPLAY_X, FoodImage, Icon, T, useTheme } from './kit';

const APath = Animated.createAnimatedComponent(Path);

export interface ArcPiece {
  kcal: number;
  /** culoarea bucății (masă din plan, masă notată de tine) */
  color?: string;
  /** poza de pe arc */
  recipe?: Recipe;
}

/**
 * Semicercul caloriilor, pe bucăți: fiecare masă mâncată e o bucată din arc, cu poza ei.
 * `ghost` = ce urmează din plan (mai deschis); `preview` = masa pe care o adaugi acum (se vede înainte să confirmi).
 */
export function MealArc({ target, pieces, ghost = 0, preview = 0, size = 300, stroke = 22, center = true, onPiece }: {
  target: number; pieces: ArcPiece[]; ghost?: number; preview?: number; size?: number; stroke?: number; center?: boolean;
  onPiece?: (i: number) => void;
}) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const h = size / 2 + stroke / 2;
  const len = Math.PI * r;
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const frac = (k: number) => (target > 0 ? Math.max(0, Math.min(1, k / target)) : 0);

  const eaten = pieces.reduce((a, p) => a + p.kcal, 0);
  const cum: number[] = [];
  pieces.reduce((a, p, i) => { cum[i] = a + p.kcal; return cum[i]; }, 0);
  const left = Math.round(target - eaten - preview);
  const over = left < 0;

  // bucățile pentru poze: mijlocul fiecărei bucăți destul de mari
  const badge = Math.round(stroke * 1.75);
  const badges = pieces.map((p, i) => {
    const a = frac(cum[i] - p.kcal);
    const b = frac(cum[i]);
    if (b - a < 0.07) return null;
    const th = Math.PI * (1 - (a + b) / 2);
    return { i, x: cx + r * Math.cos(th) - badge / 2, y: cy - r * Math.sin(th) - badge / 2, recipe: p.recipe, color: p.color ?? t.primary };
  });

  return (
    <View style={{ width: size, height: h + 4, alignItems: 'center' }}>
      <Svg width={size} height={h}>
        <Path d={d} stroke={t.arcTrack} strokeWidth={stroke} strokeLinecap="round" fill="none" />
        {preview > 0 && <Grow d={d} len={len} stroke={stroke} frac={frac(eaten + preview)} color={over ? t.warn : t.arcPreview} />}
        {ghost > 0 && <Grow d={d} len={len} stroke={stroke} frac={frac(eaten + ghost)} color={t.arcGhost} />}
        {pieces.map((_, k) => {
          const i = pieces.length - 1 - k; // de la ultima la prima, ca fiecare bucată să stea peste următoarea
          return <Grow key={i} d={d} len={len} stroke={stroke} frac={frac(cum[i])} color={pieces[i].color ?? t.primary} />;
        })}
      </Svg>
      {badges.map((b) => b && (
        <Pressable key={b.i} onPress={onPiece ? () => onPiece(b.i) : undefined} disabled={!onPiece} hitSlop={6}
          accessibilityLabel={b.recipe?.name ?? 'Masă notată'}
          style={{ position: 'absolute', left: b.x, top: b.y, width: badge, height: badge, borderRadius: badge / 2, borderWidth: 3, borderColor: t.card, overflow: 'hidden', backgroundColor: b.color, alignItems: 'center', justifyContent: 'center' }}>
          {b.recipe ? <FoodImage recipe={b.recipe} size={badge - 6} radius={(badge - 6) / 2} /> : <Icon name="restaurant" size={badge * 0.42} color="#fff" />}
        </Pressable>
      ))}
      {center && (
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' }}>
          <Count value={Math.abs(left)} size={size * 0.165} color={over ? t.warn : t.text} />
          <T v="small" color={t.muted}>{over ? 'kcal peste ținta de azi' : preview > 0 ? 'kcal îți mai rămân azi' : `kcal rămase din ${target.toLocaleString('ro-RO')}`}</T>
        </View>
      )}
    </View>
  );
}

/** o bucată de arc care crește animat până la `frac` */
function Grow({ d, len, stroke, frac, color }: { d: string; len: number; stroke: number; frac: number; color: string }) {
  const v = useState(() => new Animated.Value(len))[0];
  useEffect(() => {
    Animated.timing(v, { toValue: len * (1 - frac), duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [frac, len]);
  return (
    <APath d={d} stroke={color} strokeWidth={stroke} strokeLinecap="round" fill="none"
      strokeDasharray={`${len} ${len}`} strokeDashoffset={v} opacity={frac > 0.004 ? 1 : 0} />
  );
}

/** cifra din mijloc, care urcă sau coboară animat */
export function Count({ value, size, color }: { value: number; size: number; color?: string }) {
  const v = useState(() => new Animated.Value(value))[0];
  const [shown, setShown] = useState(Math.round(value));
  useEffect(() => {
    const id = v.addListener(({ value: x }) => setShown(Math.round(x)));
    return () => v.removeListener(id);
  }, []);
  useEffect(() => {
    Animated.timing(v, { toValue: value, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value]);
  return (
    <T color={color} style={{ fontFamily: DISPLAY_X, fontSize: size, lineHeight: size * 1.08, letterSpacing: -1.5, fontVariant: ['tabular-nums'] }}>
      {shown.toLocaleString('ro-RO')}
    </T>
  );
}

/** un semicerc mic (macro, zilele săptămânii) */
export function MiniArc({ value, max, color, size = 96, stroke = 9, dashed }: { value: number; max: number; color: string; size?: number; stroke?: number; dashed?: boolean }) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const len = Math.PI * r;
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const f = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <Svg width={size} height={size / 2 + stroke / 2}>
      <Path d={d} stroke={t.arcTrack} strokeWidth={stroke} strokeLinecap="round" fill="none" strokeDasharray={dashed ? `${stroke * 0.6} ${stroke * 0.9}` : undefined} />
      {!dashed && <Grow d={d} len={len} stroke={stroke} frac={f} color={color} />}
    </Svg>
  );
}
