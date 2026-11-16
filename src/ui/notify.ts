import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { expirySchedule } from '../logic/expiry';
import type { PantryItem } from '../logic/types';

let ready = false;

export function setupNotifications() {
  if (ready || Platform.OS === 'web') return;
  ready = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('expirare', { name: 'Alimente care expiră', importance: Notifications.AndroidImportance.DEFAULT }).catch(() => {});
    Notifications.setNotificationChannelAsync('gatit', { name: 'Cronometre de gătit', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 400, 200, 400] }).catch(() => {});
  }
}

export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted || cur.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true;
    if (!cur.canAskAgain) return false;
    const r = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    return r.granted || r.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

/** Reprogramează notificările de expirare după ce se schimbă cămara */
export async function rescheduleExpiry(pantry: PantryItem[], enabled: boolean) {
  if (Platform.OS === 'web') return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(all.filter((n) => n.content.data?.kind === 'expiry').map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    if (!enabled) return;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) return;
    for (const n of expirySchedule(pantry)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: n.title, body: n.body, data: { kind: 'expiry', url: '/lista?tab=camara' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at, channelId: 'expirare' },
      });
    }
  } catch {
    // notificările sunt opționale; aplicația merge și fără ele
  }
}

/** Notificare la finalul unui cronometru de gătit (merge și cu telefonul blocat) */
export async function scheduleTimer(seconds: number, body: string): Promise<string | undefined> {
  if (Platform.OS === 'web') return undefined;
  try {
    if (!(await ensurePermission())) return undefined;
    return await Notifications.scheduleNotificationAsync({
      content: { title: '⏰ Gata!', body, data: { kind: 'timer' }, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(seconds)), channelId: 'gatit' },
    });
  } catch {
    return undefined;
  }
}

export async function cancelNotification(id?: string) {
  if (!id || Platform.OS === 'web') return;
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* deja anulată */ }
}
