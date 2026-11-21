import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold, useFonts } from '@expo-google-fonts/bricolage-grotesque';
import { CabinSketch_700Bold } from '@expo-google-fonts/cabin-sketch/700Bold';
import { Kalam_700Bold } from '@expo-google-fonts/kalam/700Bold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { Fraunces_800ExtraBold } from '@expo-google-fonts/fraunces/800ExtraBold';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { VisionHost } from '../ui/VisionHost';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { DISPLAY, useTheme } from '../ui/kit';
import { crumb, installErrorLog } from '../ui/diag';
import { LockGate } from '../ui/LockGate';
import { autoBackup } from '../ui/backup';
import { installWebShims } from '../ui/webShims';
import { rescheduleExpiry, setupNotifications } from '../ui/notify';
import { useEffect } from 'react';

installWebShims();

export default function RootLayout() {
  const hydrated = useStore((s) => s.hydrated);
  const [fontsOk, fontErr] = useFonts({
    'Bricolage-700': BricolageGrotesque_700Bold, 'Bricolage-800': BricolageGrotesque_800ExtraBold,
    'Fraunces-700': Fraunces_700Bold, 'Fraunces-800': Fraunces_800ExtraBold, 'CabinSketch-700': CabinSketch_700Bold, 'Kalam-700': Kalam_700Bold,
  });
  const themeId = useStore((s) => s.settings.theme ?? 'email');
  const pantry = useStore((s) => s.pantry);
  const notifyExpiry = useStore((s) => s.notifyExpiry);
  const router = useRouter();
  useEffect(() => { setupNotifications(); installErrorLog(); crumb('aplicația pornește'); }, []);
  // pe Android, sistemul poate închide aplicația cât e deschisă galeria; poza aleasă o primim aici
  useEffect(() => {
    if (!hydrated || Platform.OS !== 'android') return;
    ImagePicker.getPendingResultAsync().then((r) => {
      if (r && 'assets' in r && r.assets?.[0]?.uri) {
        crumb('poză recuperată după ce Android a închis aplicația');
        setTimeout(() => router.push({ pathname: '/scanare', params: { mode: 'farfurie', pending: r.assets![0].uri } }), 400);
      }
    }).catch(() => {});
  }, [hydrated]);
  // o copie automată pe telefon, o dată pe săptămână
  useEffect(() => {
    if (!hydrated) return;
    const h = setTimeout(() => { autoBackup(); }, 4000);
    return () => clearTimeout(h);
  }, [hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    const h = setTimeout(() => { rescheduleExpiry(pantry, notifyExpiry); }, 1500);
    return () => clearTimeout(h);
  }, [hydrated, pantry, notifyExpiry]);
  const t = useTheme();
  if (!hydrated || (!fontsOk && !fontErr)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <LockGate key={themeId}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerTitleStyle: { color: t.text, fontFamily: DISPLAY },
          headerShadowVisible: false,
          headerBackTitle: 'Înapoi',
          contentStyle: { backgroundColor: t.bg },
          headerTransparent: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="reteta/[id]" options={{ title: 'Rețetă' }} />
        <Stack.Screen name="membru/[id]" options={{ title: 'Membru' }} />
        <Stack.Screen name="schimba" options={{ title: 'Schimbă rețeta', presentation: 'modal' }} />
        <Stack.Screen name="setari" options={{ title: 'Setări plan' }} />
        <Stack.Screen name="preturi" options={{ title: 'Prețuri ingrediente' }} />
        <Stack.Screen name="reteta-noua" options={{ title: 'Rețetă nouă' }} />
        <Stack.Screen name="import" options={{ title: 'Rețetă primită' }} />
        <Stack.Screen name="gatit/[id]" options={{ title: 'Mod de gătit', presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="scanare" options={{ title: 'Scanează', headerShown: false }} />
        <Stack.Screen name="adauga" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="recap" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="cheltuieli" options={{ title: 'Cheltuieli' }} />
        <Stack.Screen name="magazine" options={{ title: 'Magazinele tale' }} />
        <Stack.Screen name="preferinte" options={{ title: 'Ce mănânc' }} />
        <Stack.Screen name="profil" options={{ headerShown: false }} />
        <Stack.Screen name="problema" options={{ title: 'Raportează o problemă' }} />
        <Stack.Screen name="bucatarii" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="alege" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack>
      </LockGate>
      <VisionHost />
    </SafeAreaProvider>
  );
}
