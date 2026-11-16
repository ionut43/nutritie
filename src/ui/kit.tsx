import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { ING } from '../data/ingredients';
import { RECIPE_PHOTO } from '../data/photos';
import type { Aisle, Recipe } from '../logic/types';
import { tick } from './haptics';
import { Illo, type IlloName } from './illustrations';
import { DISPLAY, DISPLAY_X, getThemeId, subscribeTheme, type ThemeId } from './themeState';

/*
 * Design „oala emailată”: alb rece ca smalțul, albastru-cobalt ca marginea oalei pentru acțiuni,
 * verde de murături pentru ce e gata, roșu de roșie doar pentru „de gătit”. Fără roșu de avertizare
 * pentru calorii: cifrele arată ce ai mâncat, nu te judecă. Titlurile în Bricolage Grotesque.
 */
const light = {
  bg: '#F7F8F6', card: '#FFFFFF', text: '#142033', muted: '#647084', border: '#E3E6EB',
  primary: '#1E4FD8', primarySoft: '#E7EDFC', onPrimary: '#FFFFFF', rim: '#163FB0',
  accent: '#3E7B3A', accentSoft: '#E5F0E2', warn: '#A86A12', warnSoft: '#FAF0DC', danger: '#C8361F', dangerSoft: '#FBE6E1',
  heat: '#E5462E', heatSoft: '#FDE9E4',
  chip: '#EDEFF2', protein: '#1E4FD8', carbs: '#D9A21B', fat: '#E5462E', fiber: '#3E7B3A', ink: '#142033',
  shadow: 'rgba(20,32,51,0.08)',
  /** semicercul caloriilor: masă notată de tine, ce urmează din plan, masa pe care o adaugi acum */
  arcMid: '#7D9BEA', arcGhost: '#C9D6F7', arcPreview: '#9DB4F2', arcTrack: '#E7EAE6',
};
const dark: typeof light = {
  bg: '#0E1420', card: '#172031', text: '#EEF1F6', muted: '#97A2B6', border: '#263149',
  primary: '#7096FF', primarySoft: '#1C2A4D', onPrimary: '#0E1420', rim: '#5279E8',
  accent: '#7DBB72', accentSoft: '#1B2E1C', warn: '#E2A84A', warnSoft: '#33291A', danger: '#FF7A63', dangerSoft: '#3A1D19',
  heat: '#FF7A5E', heatSoft: '#3A1F1A',
  chip: '#1F2A3F', protein: '#7096FF', carbs: '#E8C25A', fat: '#FF7A5E', fiber: '#7DBB72', ink: '#EEF1F6',
  shadow: 'rgba(0,0,0,0.4)',
  arcMid: '#4C68B8', arcGhost: '#26365E', arcPreview: '#3A5292', arcTrack: '#1F2A3F',
};
export type Theme = typeof light;

/*
 * Teme: aceeași așezare, alt material. Fiecare are paleta ei (zi și noapte) și fontul titlurilor.
 *  - email: oala emailată (cobalt pe alb rece)
 *  - horezu: lut ars, roșu-maro, ocru și verde, ca farfuriile de Horezu
 *  - piata: tabla verde de la piață, scris de cretă
 *  - caiet: hârtie cu linii, cerneală albastră, titluri scrise de mână
 *  - anotimp: oala emailată în culoarea anotimpului (leurdă, roșii, dovleac, sfeclă)
 */


const horezuLight: Theme = {
  bg: '#F3E9DA', card: '#FBF5EC', text: '#2B1D14', muted: '#715C4A', border: '#E3D3BD',
  primary: '#8C3B1F', primarySoft: '#F1DDCF', onPrimary: '#FFFFFF', rim: '#6E2C15',
  accent: '#3F6B35', accentSoft: '#E3EBD8', warn: '#9C6512', warnSoft: '#F6E7C8', danger: '#B3341E', dangerSoft: '#F6DED6',
  heat: '#B3341E', heatSoft: '#F6DED6',
  chip: '#EDE0CC', protein: '#8C3B1F', carbs: '#C9962B', fat: '#3F6B35', fiber: '#3F6B35', ink: '#2B1D14',
  shadow: 'rgba(43,29,20,0.08)',
  arcMid: '#C07A55', arcGhost: '#E8CDB8', arcPreview: '#D9A586', arcTrack: '#EADCC8',
};
const horezuDark: Theme = {
  bg: '#1E140E', card: '#2A1D15', text: '#F3E9DA', muted: '#BBA58E', border: '#3B2A1F',
  primary: '#E0875F', primarySoft: '#3A2418', onPrimary: '#1E140E', rim: '#B86A45',
  accent: '#8DBB7C', accentSoft: '#22301C', warn: '#E2AE5A', warnSoft: '#36281A', danger: '#F08A6E', dangerSoft: '#3A1F18',
  heat: '#F08A6E', heatSoft: '#3A1F18',
  chip: '#33251B', protein: '#E0875F', carbs: '#E2AE5A', fat: '#8DBB7C', fiber: '#8DBB7C', ink: '#F3E9DA',
  shadow: 'rgba(0,0,0,0.4)',
  arcMid: '#A86A4C', arcGhost: '#4A3022', arcPreview: '#7A4A33', arcTrack: '#33251B',
};
const board: Theme = {
  bg: '#1F3A2E', card: '#26463A', text: '#F1F1E6', muted: '#B9C8BC', border: '#355847',
  primary: '#F2D16B', primarySoft: '#3B5440', onPrimary: '#1F3A2E', rim: '#C9A945',
  accent: '#9FD8A0', accentSoft: '#2E5240', warn: '#F0A86A', warnSoft: '#4A4632', danger: '#F49A84', dangerSoft: '#4A3A32',
  heat: '#F49A84', heatSoft: '#4A3A32',
  chip: '#2C4E40', protein: '#F2D16B', carbs: '#F0A86A', fat: '#9FD8A0', fiber: '#9FD8A0', ink: '#F1F1E6',
  shadow: 'rgba(0,0,0,0.35)',
  arcMid: '#C9B45A', arcGhost: '#3F5E4A', arcPreview: '#A8954C', arcTrack: '#2C4E40',
};
const paperLight: Theme = {
  bg: '#FBFBF7', card: '#FFFFFF', text: '#1F2A44', muted: '#5E6780', border: '#D9E2F0',
  primary: '#2747A8', primarySoft: '#E4EAF8', onPrimary: '#FFFFFF', rim: '#1C3687',
  accent: '#2E7D4F', accentSoft: '#E1F0E6', warn: '#A9620D', warnSoft: '#F8EBD5', danger: '#C23A26', dangerSoft: '#FAE3DE',
  heat: '#C23A26', heatSoft: '#FAE3DE',
  chip: '#EEF1F7', protein: '#2747A8', carbs: '#C9962B', fat: '#C23A26', fiber: '#2E7D4F', ink: '#1F2A44',
  shadow: 'rgba(31,42,68,0.08)',
  arcMid: '#7E95D6', arcGhost: '#CBD6F0', arcPreview: '#9FB2E3', arcTrack: '#E6EBF3',
};
const paperDark: Theme = {
  bg: '#15192A', card: '#1D2338', text: '#E9EDF7', muted: '#A2ABC2', border: '#2A3352',
  primary: '#8EA6F2', primarySoft: '#25305A', onPrimary: '#15192A', rim: '#6F88D8',
  accent: '#7CC79A', accentSoft: '#1C3326', warn: '#E6AE5E', warnSoft: '#33291A', danger: '#F08B78', dangerSoft: '#3A1F1A',
  heat: '#F08B78', heatSoft: '#3A1F1A',
  chip: '#232B45', protein: '#8EA6F2', carbs: '#E6C262', fat: '#F08B78', fiber: '#7CC79A', ink: '#E9EDF7',
  shadow: 'rgba(0,0,0,0.4)',
  arcMid: '#5B70B8', arcGhost: '#2C3760', arcPreview: '#45579A', arcTrack: '#232B45',
};
/** anotimpul: culoarea principală e a legumei de sezon */
function seasonal(base: Theme, dark: boolean): Theme {
  const m = new Date().getMonth();
  const [p, soft, rim] = m <= 1 || m === 11
    ? (dark ? ['#E07AAE', '#3A1D2E', '#B85C8A'] : ['#8E2A5E', '#F4E1EB', '#6E1F48'])   // iarna: sfeclă, varză roșie
    : m <= 4
      ? (dark ? ['#8CCB78', '#1F3320', '#6FAE5C'] : ['#3E7B3A', '#E2F0DD', '#2F6030']) // primăvara: leurdă
      : m <= 7
        ? (dark ? ['#FF8A70', '#3D1F18', '#E06A50'] : ['#C93B26', '#FBE4DE', '#A12E1D']) // vara: roșii
        : (dark ? ['#F2A65A', '#3B2A17', '#D88A3C'] : ['#C2611A', '#FBE9D8', '#9C4C12']); // toamna: dovleac
  return { ...base, primary: p, primarySoft: soft, rim, protein: p, arcMid: base.arcMid, arcGhost: soft, arcPreview: soft };
}

const THEMES: Record<ThemeId, { light: Theme; dark: Theme }> = {
  email: { light, dark },
  horezu: { light: horezuLight, dark: horezuDark },
  piata: { light: board, dark: board },
  caiet: { light: paperLight, dark: paperDark },
  anotimp: { light: seasonal(light, false), dark: seasonal(dark, true) },
};
export const THEME_LIST: { id: ThemeId; name: string; desc: string }[] = [
  { id: 'email', name: 'Oala emailată', desc: 'Cobalt pe alb, curată' },
  { id: 'horezu', name: 'Horezu', desc: 'Lut ars, roșu-maro, ocru și verde' },
  { id: 'piata', name: 'Tablă de piață', desc: 'Verde de tablă, scris de cretă' },
  { id: 'caiet', name: 'Caiet de rețete', desc: 'Hârtie, cerneală, scris de mână' },
  { id: 'anotimp', name: 'Anotimpul', desc: 'Culoarea legumei de sezon' },
];
export const themePreview = (id: ThemeId, darkMode = false) => (darkMode ? THEMES[id].dark : THEMES[id].light);
export { DISPLAY, DISPLAY_X, setThemeId, themeFont, type ThemeId } from './themeState';

export function useTheme(): Theme {
  const id = useSyncExternalStore(subscribeTheme, getThemeId, getThemeId);
  const th = THEMES[id];
  return useColorScheme() === 'dark' ? th.dark : th.light;
}
export function useIsDark() {
  const id = useSyncExternalStore(subscribeTheme, getThemeId, getThemeId);
  const scheme = useColorScheme();
  return id === 'piata' || scheme === 'dark';
}

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const Icon = ({ name, size = 20, color, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<TextStyle> }) => {
  const t = useTheme();
  return <Ionicons name={name} size={size} color={color ?? t.text} style={style} />;
};

/** smalțul e plat: o margine fină în loc de umbră */
const shadow = (t: Theme, _k = 1): ViewStyle => ({ borderWidth: StyleSheet.hairlineWidth, borderColor: t.border });

export function Screen({ children, scroll = true, padded = true, edges, bottomInset = 40 }: {
  children: React.ReactNode; scroll?: boolean; padded?: boolean; edges?: ('top' | 'bottom')[]; bottomInset?: number;
}) {
  const t = useTheme();
  const inner = padded ? { padding: 16, paddingBottom: bottomInset, gap: 14 } : undefined;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={edges ?? ['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : <View style={[{ flex: 1 }, inner]}>{children}</View>}
    </SafeAreaView>
  );
}

export function T({ children, style, v = 'body', color, numberOfLines, onPress }: {
  children: React.ReactNode; style?: StyleProp<TextStyle>;
  v?: 'hero' | 'big' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'label' | 'num';
  color?: string; numberOfLines?: number; onPress?: () => void;
}) {
  const t = useTheme();
  const base: Record<string, TextStyle> = {
    hero: { fontSize: 46, lineHeight: 50, fontFamily: DISPLAY_X, letterSpacing: -1.4 },
    big: { fontSize: 34, lineHeight: 38, fontFamily: DISPLAY_X, letterSpacing: -1 },
    h1: { fontSize: 29, lineHeight: 33, fontFamily: DISPLAY_X, letterSpacing: -0.7 },
    h2: { fontSize: 21, lineHeight: 25, fontFamily: DISPLAY, letterSpacing: -0.3 },
    h3: { fontSize: 17, lineHeight: 22, fontFamily: DISPLAY, letterSpacing: -0.1 },
    body: { fontSize: 16, lineHeight: 23 },
    small: { fontSize: 14, lineHeight: 19 },
    label: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
    num: { fontSize: 18, fontFamily: DISPLAY, fontVariant: ['tabular-nums'] },
  };
  const c = color ?? (v === 'small' || v === 'label' ? t.muted : t.text);
  return <Text numberOfLines={numberOfLines} onPress={onPress} style={[base[v], { color: c }, style]}>{children}</Text>;
}

export function Card({ children, style, onPress, tone, flat }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void;
  tone?: 'primary' | 'accent' | 'warn' | 'danger' | 'ink'; flat?: boolean;
}) {
  const t = useTheme();
  const bg = tone === 'primary' ? t.primarySoft : tone === 'accent' ? t.accentSoft : tone === 'warn' ? t.warnSoft
    : tone === 'danger' ? t.dangerSoft : tone === 'ink' ? t.ink : t.card;
  const s = [{ backgroundColor: bg, borderRadius: 18, padding: 16, gap: 10 }, !tone && !flat ? shadow(t) : null, style];
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}>{children}</Pressable>;
  return <View style={s}>{children}</View>;
}

export function Row({ children, style, gap = 8, wrap }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Btn({ title, onPress, variant = 'primary', icon, small, disabled, style }: {
  title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'ink';
  icon?: IconName; small?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const map = {
    primary: { bg: t.primary, fg: t.onPrimary, rim: t.rim },
    accent: { bg: t.accent, fg: '#fff' },
    ink: { bg: t.ink, fg: t.bg },
    secondary: { bg: t.chip, fg: t.text },
    ghost: { bg: 'transparent', fg: t.primary },
    danger: { bg: t.dangerSoft, fg: t.danger },
  }[variant];
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress ? () => { tick(); onPress(); } : undefined}
      accessibilityRole="button"
      style={({ pressed }) => [{
        backgroundColor: map.bg, borderRadius: small ? 12 : 15, paddingVertical: small ? 10 : 16, paddingHorizontal: small ? 14 : 20,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        // marginea de jos, ca la o farfurie emailată: butonul principal pare „apăsabil”
        borderBottomWidth: 'rim' in map && !pressed ? 3 : 0, borderBottomColor: 'rim' in map ? (map as { rim: string }).rim : undefined,
        marginTop: 'rim' in map && pressed ? 3 : 0,
        opacity: disabled ? 0.4 : 1,
      }, style]}
    >
      {icon && <Ionicons name={icon} size={small ? 16 : 19} color={map.fg} />}
      <Text style={{ color: map.fg, fontFamily: DISPLAY, fontSize: small ? 15 : 17 }}>{title}</Text>
    </Pressable>
  );
}

export function IconBtn({ icon, onPress, tone = 'chip', size = 40, color }: {
  icon: IconName; onPress?: () => void; tone?: 'chip' | 'primary' | 'card' | 'clear'; size?: number; color?: string;
}) {
  const t = useTheme();
  const bg = tone === 'primary' ? t.primary : tone === 'card' ? t.card : tone === 'clear' ? 'transparent' : t.chip;
  const fg = color ?? (tone === 'primary' ? '#fff' : t.text);
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button"
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] }, tone === 'card' ? shadow(t) : null]}>
      <Ionicons name={icon} size={size * 0.5} color={fg} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon, tone, color }: {
  label: string; selected?: boolean; onPress?: () => void; icon?: IconName; tone?: 'accent' | 'warn' | 'primary' | 'danger'; color?: string;
}) {
  const t = useTheme();
  const toneBg = tone === 'accent' ? t.accentSoft : tone === 'warn' ? t.warnSoft : tone === 'primary' ? t.primarySoft : tone === 'danger' ? t.dangerSoft : t.chip;
  const toneFg = tone === 'accent' ? t.accent : tone === 'warn' ? t.warn : tone === 'primary' ? t.primary : tone === 'danger' ? t.danger : t.text;
  const bg = selected ? color ?? t.ink : toneBg;
  const fg = selected ? (color ? '#fff' : t.bg) : toneFg;
  return (
    <Pressable onPress={onPress ? () => { tick(); onPress(); } : undefined} disabled={!onPress}
      style={({ pressed }) => ({ backgroundColor: bg, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 5, opacity: pressed ? 0.8 : 1 })}>
      {icon && <Ionicons name={icon} size={15} color={fg} />}
      <Text style={{ color: fg, fontSize: 14, fontWeight: selected ? '700' : '600' }}>{label}</Text>
    </Pressable>
  );
}

/** etichetă mică, colorată (timp, kcal, proteine) */
export function Pill({ text, icon, color, bg }: { text: string; icon?: IconName; color?: string; bg?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg ?? t.chip, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 }}>
      {icon && <Ionicons name={icon} size={12} color={color ?? t.muted} />}
      <Text style={{ fontSize: 12, fontWeight: '700', color: color ?? t.muted }}>{text}</Text>
    </View>
  );
}

export function Segmented<V extends string | number>({ options, value, onChange }: {
  options: { label: string; value: V }[]; value: V; onChange: (v: V) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.chip, borderRadius: 14, padding: 4 }}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)}
            style={[{ flex: 1, paddingVertical: 10, borderRadius: 11, backgroundColor: sel ? t.card : 'transparent', alignItems: 'center' }, sel ? shadow(t, 0.6) : null]}>
            <Text style={{ color: sel ? t.text : t.muted, fontWeight: sel ? '800' : '600', fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** alegere mare, cu pictogramă (pentru întrebări) */
export function Option({ title, desc, selected, onPress, icon, right }: {
  title: string; desc?: string; selected: boolean; onPress: () => void; icon?: IconName; emoji?: string; right?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={() => { tick(); onPress(); }} style={({ pressed }) => [{
      flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16,
      backgroundColor: selected ? t.primarySoft : t.card, borderWidth: selected ? 2 : StyleSheet.hairlineWidth, borderColor: selected ? t.primary : t.border,
      transform: [{ scale: pressed ? 0.985 : 1 }],
    }]}>
      {icon && (
        <Ionicons name={icon} size={24} color={selected ? t.primary : t.muted} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.text, fontFamily: DISPLAY, fontSize: 17 }}>{title}</Text>
        {desc ? <Text style={{ color: t.muted, fontSize: 13, lineHeight: 18 }}>{desc}</Text> : null}
      </View>
      {right ?? <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selected ? t.primary : t.border} />}
    </Pressable>
  );
}

/** câmp numeric: scrii direct sau folosești + / − ; limitele sunt largi, nu blochează */
export function NumberField({ label, value, onChange, step = 1, min = 0, max = 99999, suffix, decimals = 0, hint }: {
  label?: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string; decimals?: number; hint?: string;
}) {
  const t = useTheme();
  const [txt, setTxt] = useState(String(value));
  useEffect(() => { setTxt(String(value)); }, [value]);
  const clamp = (v: number) => Math.min(max, Math.max(min, Number(v.toFixed(decimals))));
  const commit = (s: string) => {
    const v = parseFloat(s.replace(',', '.'));
    if (!Number.isNaN(v)) onChange(clamp(v)); else setTxt(String(value));
  };
  return (
    <View style={{ gap: 6 }}>
      {label ? <T v="small" style={{ fontWeight: '600' }}>{label}</T> : null}
      <Row>
        <Pressable onPress={() => onChange(clamp(value - step))} style={({ pressed }) => [sx.stepBtn, { backgroundColor: t.chip, opacity: pressed ? 0.6 : 1 }]}>
          <Ionicons name="remove" size={22} color={t.text} />
        </Pressable>
        <View style={[sx.numBox, { backgroundColor: t.card, borderColor: t.border }]}>
          <TextInput
            value={txt} onChangeText={setTxt} onEndEditing={(e) => commit(e.nativeEvent.text)} onBlur={() => commit(txt)}
            keyboardType="decimal-pad" style={{ color: t.text, fontSize: 22, fontFamily: 'Bricolage-700', minWidth: 56, textAlign: 'center', padding: 0 }}
            selectTextOnFocus
          />
          {suffix ? <Text style={{ color: t.muted, fontSize: 15, fontWeight: '600' }}>{suffix}</Text> : null}
        </View>
        <Pressable onPress={() => onChange(clamp(value + step))} style={({ pressed }) => [sx.stepBtn, { backgroundColor: t.chip, opacity: pressed ? 0.6 : 1 }]}>
          <Ionicons name="add" size={22} color={t.text} />
        </Pressable>
      </Row>
      {hint ? <T v="small">{hint}</T> : null}
    </View>
  );
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, icon, autoFocus }: {
  label?: string; value: string; onChangeText: (s: string) => void; placeholder?: string; keyboardType?: 'default' | 'decimal-pad';
  icon?: IconName; autoFocus?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <T v="small" style={{ fontWeight: '600' }}>{label}</T> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 }}>
        {icon && <Ionicons name={icon} size={18} color={t.muted} style={{ marginRight: 8 }} />}
        <TextInput
          value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={t.muted} keyboardType={keyboardType} autoFocus={autoFocus}
          style={{ flex: 1, paddingVertical: 13, fontSize: 16, color: t.text }}
        />
        {value.length > 0 && icon === 'search' && (
          <Pressable hitSlop={8} onPress={() => onChangeText('')}><Ionicons name="close-circle" size={18} color={t.muted} /></Pressable>
        )}
      </View>
    </View>
  );
}

export function Progress({ value, max, color, height = 8, bg }: { value: number; max: number; color?: string; height?: number; bg?: string }) {
  const t = useTheme();
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  // fără roșu când treci de țintă: cifra spune ce s-a întâmplat, culoarea nu judecă
  return (
    <View style={{ height, borderRadius: height, backgroundColor: bg ?? t.chip, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height, backgroundColor: color ?? t.primary }} />
    </View>
  );
}

export function Section({ title, right, children, sub }: { title: string; right?: React.ReactNode; children?: React.ReactNode; sub?: string }) {
  return (
    <View style={{ gap: 10, marginTop: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T v="h2">{title}</T>
          {sub ? <T v="small">{sub}</T> : null}
        </View>
        {right}
      </Row>
      {children}
    </View>
  );
}

/** titlul ecranului, cu butoane în dreapta */
export function Header({ title, sub, right, onBack }: { title: string; sub?: string; right?: React.ReactNode; onBack?: () => void }) {
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 2 }}>
      {onBack ? <IconBtn icon="chevron-back" tone="card" onPress={onBack} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        {sub ? <T v="label">{sub}</T> : null}
        <T v="h1">{title}</T>
      </View>
      {right ? <Row gap={8}>{right}</Row> : null}
    </Row>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border }} />;
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: 28, gap: 10 }}>
      <Ionicons name={icon} size={34} color={t.muted} />
      <T v="h3" style={{ textAlign: 'center' }}>{title}</T>
      {text ? <T v="small" style={{ textAlign: 'center' }}>{text}</T> : null}
      {action}
    </View>
  );
}

export function Notice({ text, tone = 'warn', icon = 'information-circle' }: { text: string; tone?: 'warn' | 'primary' | 'accent' | 'danger'; icon?: IconName }) {
  const t = useTheme();
  const fg = tone === 'warn' ? t.warn : tone === 'accent' ? t.accent : tone === 'danger' ? t.danger : t.primary;
  return (
    <Card tone={tone} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 16 }}>
      <Ionicons name={icon} size={18} color={fg} style={{ marginTop: 1 }} />
      <T v="small" color={t.text} style={{ flex: 1 }}>{text}</T>
    </Card>
  );
}

export function MacroBar({ p, c, f }: { p: number; c: number; f: number }) {
  const t = useTheme();
  const total = p * 4 + c * 4 + f * 9 || 1;
  return (
    <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2 }}>
      <View style={{ flex: (p * 4) / total, backgroundColor: t.protein }} />
      <View style={{ flex: (c * 4) / total, backgroundColor: t.carbs }} />
      <View style={{ flex: (f * 9) / total, backgroundColor: t.fat }} />
    </View>
  );
}

const sx = StyleSheet.create({
  stepBtn: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  numBox: { flex: 1, height: 50, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
});

// ───────── Elemente grafice ─────────

/** Plăcuță mare: gri când nu e selectată, colorată când e selectată */
export function Tile({ illo, icon, image, label, sub, selected, onPress, width = '31%', tone }: {
  illo?: IlloName; icon?: IconName; image?: number; emoji?: string; label: string; sub?: string; selected: boolean; onPress: () => void;
  width?: `${number}%` | number; tone?: 'danger';
}) {
  const t = useTheme();
  const on = tone === 'danger' ? t.danger : t.primary;
  const onSoft = tone === 'danger' ? t.dangerSoft : t.primarySoft;
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}
      style={({ pressed }) => [{
        width, alignItems: 'center', paddingVertical: image ? 0 : 14, paddingHorizontal: image ? 0 : 6, gap: 6, borderRadius: 16, overflow: 'hidden',
        backgroundColor: selected ? onSoft : t.card, borderWidth: selected ? 2 : StyleSheet.hairlineWidth, borderColor: selected ? on : t.border,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      }, selected ? null : shadow(t, 0.6)]}>
      {image ? (
        <View style={{ width: '100%', aspectRatio: 1.25, overflow: 'hidden', backgroundColor: '#fff' }}>
          <Image source={image} resizeMode="cover" style={{ width: '100%', height: '100%', opacity: selected ? 1 : 0.85 }} />
        </View>
      ) : illo ? <Illo name={illo} active={selected} size={52} /> : icon ? (
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: selected ? on : t.chip, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={26} color={selected ? '#fff' : t.muted} />
        </View>
      ) : null}
      <Text numberOfLines={2} style={{ color: selected ? t.text : t.muted, fontWeight: selected ? '700' : '600', fontSize: 14, textAlign: 'center', paddingHorizontal: 6, paddingBottom: image ? 8 : 0 }}>{label}</Text>
      {sub ? <Text numberOfLines={2} style={{ color: t.muted, fontSize: 11, textAlign: 'center', marginTop: -4 }}>{sub}</Text> : null}
      {selected && (
        <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: on, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={tone === 'danger' ? 'close' : 'checkmark'} size={15} color="#fff" />
        </View>
      )}
    </Pressable>
  );
}

export function TileGrid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start' }}>{children}</View>;
}

/** Inel de progres */
export function Ring({ value, max, size = 150, stroke = 14, color, track, children }: {
  value: number; max: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode;
}) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <SvgCircle cx={size / 2} cy={size / 2} r={r} stroke={track ?? t.chip} strokeWidth={stroke} fill="none" />
        {pct > 0 && (
          <SvgCircle cx={size / 2} cy={size / 2} r={r} stroke={color ?? t.primary} strokeWidth={stroke} fill="none"
            strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round" />
        )}
      </Svg>
      {children}
    </View>
  );
}

/** Poza rețetei (inclusă în aplicație sau făcută de tine); pentru rețete fără poză, o plăcuță simplă */
export function FoodImage({ recipe, size, width, height, radius = 18, style }: {
  recipe?: Recipe; size?: number; width?: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const w = width ?? size ?? 56;
  const h = height ?? size ?? 56;
  const src = recipe ? (recipe.photo ? { uri: recipe.photo } : RECIPE_PHOTO[recipe.id]) : undefined;
  if (src) return <Image source={src} style={[{ width: w, height: h, borderRadius: radius, backgroundColor: t.chip }, style as object]} />;
  // fără poză reală nu inventăm una: o plăcuță tipografică, colorată după felul mâncării
  const tones = [[t.primarySoft, t.primary], [t.accentSoft, t.accent], [t.heatSoft, t.heat], [t.warnSoft, t.warn]];
  const k = recipe ? [...recipe.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % tones.length : 0;
  const [bg, fg] = tones[k];
  const small = (typeof w === 'number' ? w : 200) < 90 || h < 90;
  const word = recipe?.name.split(/\s+/)[0] ?? '';
  return (
    <View style={[{ width: w, height: h, borderRadius: radius, backgroundColor: bg, justifyContent: 'flex-end', padding: small ? 0 : 14, alignItems: small ? 'center' : 'flex-start' }, small && { justifyContent: 'center' }, style]}>
      <Text numberOfLines={small ? 1 : 2} style={{ color: fg, fontFamily: DISPLAY_X, fontSize: small ? Math.min(h, typeof w === 'number' ? w : h) * 0.42 : Math.min(34, h * 0.16), letterSpacing: -0.5 }}>
        {small ? word.charAt(0) : recipe?.name}
      </Text>
    </View>
  );
}

const AISLE_ICON: Record<Aisle, IconName> = {
  legume: 'leaf', fructe: 'nutrition', carne: 'restaurant', peste: 'fish', lactate: 'water', oua: 'egg', panificatie: 'pizza',
  cereale: 'grid', conserve: 'cube', congelate: 'snow', condimente: 'flask', uleiuri: 'water', nuci: 'ellipse', altele: 'basket',
};
const AISLE_TINT: Record<Aisle, string> = {
  legume: '#16A06B', fructe: '#E9557A', carne: '#D9483B', peste: '#3F7BF0', lactate: '#5B8DEF', oua: '#E09A00', panificatie: '#C27C2C',
  cereale: '#B98A3A', conserve: '#7A6FD8', congelate: '#2BA8C9', condimente: '#8A6F5A', uleiuri: '#C9A227', nuci: '#9A6B3F', altele: '#6C7179',
};

/** Poza ingredientului sau o pictogramă după raion */
export function IngImage({ id, size = 40 }: { id: string; size?: number }) {
  const t = useTheme();
  const aisle = ING[id]?.aisle ?? 'altele';
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: AISLE_TINT[aisle] + '22', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={AISLE_ICON[aisle]} size={size * 0.48} color={AISLE_TINT[aisle]} />
    </View>
  );
}

/** compatibilitate: miniatura veche */
export function Thumb({ size = 48, photo }: { emoji?: string; bg?: string; size?: number; photo?: string }) {
  const t = useTheme();
  if (photo) return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size * 0.3 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="restaurant" size={size * 0.45} color={t.primary} />
    </View>
  );
}

/** Bara de jos, fixă, cu butoane (pentru formulare lungi) */
export function BottomBar({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 20, backgroundColor: t.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }}>
      {children}
    </View>
  );
}
