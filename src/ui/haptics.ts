import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const on = Platform.OS === 'ios' || Platform.OS === 'android';
const safe = (f: () => Promise<void>) => { if (on) f().catch(() => {}); };

/** atingere ușoară: bifat, ales */
export const tick = () => safe(() => Haptics.selectionAsync());
/** apăsare fermă: swipe, buton important */
export const tap = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
/** reușită: masă notată, cumpărături gata */
export const success = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
