import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { crumb } from './diag';
import { tap } from './haptics';
import { Btn, Icon, T, useTheme } from './kit';

/**
 * Camera din aplicație. Nu deschid aplicația de cameră a telefonului: pe Android, sistemul
 * poate închide aplicația noastră cât timp e deschisă camera lui (așa „se închidea” după poză).
 */
export function CameraSheet({ visible, hint, onClose, onPhoto }: {
  visible: boolean; hint: string; onClose: () => void; onPhoto: (p: { uri: string }) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const cam = useRef<CameraView>(null);
  const [perm, requestPerm] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');

  const shoot = async () => {
    if (!cam.current || busy) return;
    tap();
    setBusy(true); setErr('');
    try {
      crumb('cameră: fac poza');
      const pic = await cam.current.takePictureAsync({ quality: 0.6, exif: false });
      crumb(`cameră: poză ${pic?.width}x${pic?.height}`);
      if (pic?.uri) { onPhoto({ uri: pic.uri }); onClose(); } else setErr('Poza n-a ieșit. Mai încearcă o dată.');
    } catch {
      setErr('Poza n-a ieșit. Mai încearcă o dată.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {perm?.granted ? (
          <CameraView ref={cam} style={{ flex: 1 }} facing="back" onCameraReady={() => setReady(true)} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 14 }}>
            <T color="#fff" style={{ textAlign: 'center' }}>Ca să faci poza din aplicație, am nevoie de acces la cameră.</T>
            <Btn title="Permite camera" onPress={requestPerm} />
          </View>
        )}
        <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Închide camera"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" color="#fff" size={24} />
          </Pressable>
          <T color="#fff" style={{ flex: 1, fontWeight: '600' }}>{hint}</T>
        </View>
        <View style={{ position: 'absolute', bottom: insets.bottom + 28, left: 0, right: 0, alignItems: 'center', gap: 12 }}>
          {err ? <T color="#fff">{err}</T> : null}
          {perm?.granted && (
            <Pressable onPress={shoot} disabled={!ready || busy} accessibilityLabel="Fă poza"
              style={({ pressed }) => ({ width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: ready ? 1 : 0.5, transform: [{ scale: pressed ? 0.92 : 1 }] })}>
              {busy ? <ActivityIndicator color="#fff" /> : <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: t.card }} />}
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
