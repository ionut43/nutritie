import { File, Directory, Paths } from 'expo-file-system';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';

// tipurile clasei WebView nu se potrivesc cu tipurile React de acum; componenta e aceeași
const WV = WebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<WebView> }>;
import ortJs from '../data/ortWasmJs';
import { clipPageHtml } from '../logic/clipPage';
import { crumb } from './diag';

/*
 * Recunoașterea pozei rulează într-un WebView invizibil, cu onnxruntime-web (WebAssembly).
 * WebView-ul are procesul lui: dacă pagina cade, aplicația primește doar o eroare și refac pagina.
 * Componenta stă în rădăcina aplicației și nu încarcă nimic până nu ceri prima recunoaștere.
 */
type Req = { id: string; modelUri: string; wasmUri: string; dataUrl: string; resolve: (v: number[]) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };

const pending = new Map<string, Req>();
let queue: Req[] = [];
let wake: (() => void) | null = null;
let ready = false;
let send: ((r: Req) => void) | null = null;

const dir = () => new Directory(Paths.document, 'vision');
const pageFile = () => new File(dir(), 'clip.html');

/** embedding CLIP (512) al pozei, în WebView */
export function clipEmbedWeb(modelUri: string, wasmUri: string, dataUrl: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const id = `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const timer = setTimeout(() => fail(id, new Error('Recunoașterea durează prea mult. Încearcă din nou.')), 90_000);
    const r: Req = { id, modelUri, wasmUri, dataUrl, resolve, reject, timer };
    pending.set(id, r);
    if (ready && send) send(r);
    else { queue.push(r); wake?.(); }
  });
}

function fail(id: string, e: Error) {
  const r = pending.get(id);
  if (!r) return;
  clearTimeout(r.timer);
  pending.delete(id);
  queue = queue.filter((x) => x.id !== id);
  r.reject(e);
}

export function VisionHost() {
  const [on, setOn] = useState(false);
  const [gen, setGen] = useState(0);
  const [uri, setUri] = useState<string | null>(null);
  const ref = useRef<WebView>(null);

  useEffect(() => {
    wake = () => setOn(true);
    if (queue.length) setOn(true);
    return () => { wake = null; };
  }, []);

  useEffect(() => {
    if (!on || uri) return;
    try {
      const d = dir();
      if (!d.exists) d.create({ intermediates: true });
      const f = pageFile();
      if (f.exists) f.delete();
      f.create();
      f.write(clipPageHtml(ortJs));
      setUri(f.uri);
    } catch (e) {
      for (const r of [...pending.values()]) fail(r.id, new Error(`Nu pot pregăti recunoașterea: ${e instanceof Error ? e.message : String(e)}`));
    }
  }, [on, uri]);

  send = (r: Req) => {
    const call = `window.clipEmbed(${JSON.stringify(r.id)}, ${JSON.stringify(r.modelUri)}, ${JSON.stringify(r.wasmUri)}, ${JSON.stringify(r.dataUrl)}); true;`;
    ref.current?.injectJavaScript(call);
  };

  const onMessage = (ev: WebViewMessageEvent) => {
    let m: { ready?: boolean; id?: string; emb?: number[]; err?: string; ms?: number };
    try { m = JSON.parse(ev.nativeEvent.data); } catch { return; }
    if (m.ready) {
      ready = true;
      const q = queue; queue = [];
      q.forEach((r) => send?.(r));
      return;
    }
    if (!m.id) return;
    const r = pending.get(m.id);
    if (!r) return;
    clearTimeout(r.timer);
    pending.delete(m.id);
    if (m.emb) { crumb(`recunoaștere: gata în ${m.ms} ms`); r.resolve(m.emb); } else r.reject(new Error(m.err ? `Recunoașterea n-a mers: ${m.err}` : 'Recunoașterea n-a mers.'));
  };

  // pagina a căzut (memorie, motorul web): refac pagina, aplicația merge mai departe
  const crashed = () => {
    crumb('recunoaștere: pagina a căzut');
    ready = false;
    for (const r of [...pending.values()]) fail(r.id, new Error('Recunoașterea s-a oprit pe telefonul ăsta. Alege din plan sau caută.'));
    setGen((g) => g + 1);
  };

  if (!on || !uri) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 }}>
      <WV
        key={gen}
        ref={ref}
        source={{ uri }}
        originWhitelist={['*']}
        javaScriptEnabled
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        allowingReadAccessToURL={Platform.OS === 'ios' ? Paths.document.uri : undefined}
        onMessage={onMessage}
        onLoadStart={() => { ready = false; }}
        onRenderProcessGone={crashed}
        onContentProcessDidTerminate={crashed}
        onError={(e: { nativeEvent: { description?: string } }) => {
          crumb(`recunoaștere: pagina nu s-a încărcat (${e.nativeEvent.description})`);
          for (const r of [...pending.values()]) fail(r.id, new Error('Nu pot porni recunoașterea pe telefonul ăsta.'));
        }}
        style={{ width: 1, height: 1, backgroundColor: 'transparent' }}
      />
    </View>
  );
}
