import { Alert, Platform, type AlertButton } from 'react-native';

/*
 * În browser, Alert.alert din React Native nu face nimic. Îl înlocuiesc cu dialogurile Safari,
 * ca întrebările de tip „Ștergi?” și mesajele să apară și pe iPhone, în varianta web.
 */
export function installWebShims() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const bs = buttons ?? [];
    const act = bs.filter((b) => b.style !== 'cancel');
    const cancel = bs.find((b) => b.style === 'cancel');
    if (act.length <= 1 && !cancel) {
      window.alert(text);
      act[0]?.onPress?.();
      return;
    }
    for (const b of act) {
      if (window.confirm(act.length === 1 ? text : `${text}\n\n${b.text}?`)) { b.onPress?.(); return; }
    }
    cancel?.onPress?.();
  };
  // datele (în memoria Safari) să nu fie șterse când telefonul are puțin spațiu
  try { void navigator.storage?.persist?.(); } catch { /* nimic */ }
}
