import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { useStore } from '../../store/useStore';
import { DISPLAY, useTheme } from '../../ui/kit';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const onboarded = useStore((s) => s.onboarded);
  const t = useTheme();
  if (!onboarded) return <Redirect href="/onboarding" />;
  const icon = (on: IconName, off: IconName) => ({ color, focused }: { color: unknown; focused: boolean }) =>
    <Ionicons name={focused ? on : off} color={String(color)} size={24} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: {
          backgroundColor: t.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border, height: Platform.OS === 'ios' ? 84 : 64, paddingTop: 6,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: DISPLAY, marginBottom: Platform.OS === 'ios' ? 0 : 8 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Azi', tabBarIcon: icon('sunny', 'sunny-outline') }} />
      <Tabs.Screen name="calorii" options={{ title: 'Calorii', tabBarIcon: icon('speedometer', 'speedometer-outline') }} />
      <Tabs.Screen name="plan" options={{ title: 'Săptămâna', tabBarIcon: icon('calendar', 'calendar-outline') }} />
      <Tabs.Screen name="retete" options={{ title: 'Rețete', tabBarIcon: icon('book', 'book-outline') }} />
      <Tabs.Screen name="lista" options={{ title: 'Acasă', tabBarIcon: icon('home', 'home-outline') }} />
    </Tabs>
  );
}
