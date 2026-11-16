import React, { useState } from 'react';
import { Share, View } from 'react-native';
import { clearCrumbs, report } from '../ui/diag';
import { Btn, Card, Screen, T, useTheme } from '../ui/kit';

/** Ce s-a întâmplat pe telefon: îl trimiți și văd exact unde se oprește aplicația */
export default function Problem() {
  const t = useTheme();
  const [text, setText] = useState(() => report());
  return (
    <Screen edges={['bottom']}>
      <T color={t.muted}>Dacă aplicația s-a închis, deschide-o din nou, intră aici și apasă „Trimite”. Textul arată ultimii pași făcuți și motivul închiderii. Nu conține poze și nici datele tale.</T>
      <Btn title="Trimite" icon="share-outline" onPress={() => Share.share({ message: text })} />
      <Card style={{ gap: 6 }}>
        <View><T v="small" color={t.text} style={{ fontFamily: 'monospace' }}>{text}</T></View>
      </Card>
      <Btn title="Golește jurnalul" variant="ghost" small onPress={() => { clearCrumbs(); setText(report()); }} />
    </Screen>
  );
}
