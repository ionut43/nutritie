import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Icon, T, THEME_LIST, themeFont, themePreview, type ThemeId, useIsDark, useTheme } from './kit';

/** temele, fiecare desenată în culorile și fontul ei: alegi văzând cum arată */
export function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (id: ThemeId) => void }) {
  const t = useTheme();
  const darkMode = useIsDark();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {THEME_LIST.map((th) => {
        const p = themePreview(th.id, darkMode && th.id !== 'piata');
        const on = value === th.id;
        return (
          <Pressable key={th.id} onPress={() => onChange(th.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={({ pressed }) => ({ width: '48%', borderRadius: 18, overflow: 'hidden', borderWidth: on ? 3 : StyleSheet.hairlineWidth * 2,
              borderColor: on ? t.primary : t.border, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
            <View style={{ backgroundColor: p.bg, padding: 12, gap: 6, minHeight: 128 }}>
              <Svg width={92} height={50} viewBox="0 0 92 50">
                <Path d="M 8 46 A 38 38 0 0 1 84 46" stroke={p.arcTrack} strokeWidth={10} strokeLinecap="round" fill="none" />
                <Path d="M 8 46 A 38 38 0 0 1 60 12" stroke={p.primary} strokeWidth={10} strokeLinecap="round" fill="none" />
              </Svg>
              <Text style={{ fontFamily: themeFont(th.id), fontSize: 20, color: p.text }}>{th.name}</Text>
              <Text style={{ fontSize: 12, color: p.muted }}>{th.desc}</Text>
              {on && (
                <View style={{ position: 'absolute', right: 10, top: 10, width: 26, height: 26, borderRadius: 13, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="checkmark" color={p.onPrimary} size={16} />
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
      <T v="small">Anotimpul își schimbă singur culoarea: leurdă primăvara, roșii vara, dovleac toamna, sfeclă iarna.</T>
    </View>
  );
}
