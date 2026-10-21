import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ArchEntry } from '@/lib/smile/archCatalog';

/** Parâmetros do visualizador (ver viewer/src/main.js — DEFAULTS). Frações da vista, graus e mm. */
export type Viewer3DParams = {
  midlineX: number;
  incisalY: number;
  centralWidth: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  color: string;
  opacity: number;
  gloss: number;
  showLower: boolean;
  lowerGap: number;
  lipShadow: number;
  lipShadowSize: number;
  crownMm: number;
  gumFadeMm: number;
  mouth: { x: number; y: number }[] | null;
};

export type Smile3DHandle = {
  /** Captura o canvas 3D (PNG em data URL, fundo transparente). */
  snapshot: () => Promise<string>;
};

type Props = {
  arch: ArchEntry;
  params: Viewer3DParams;
  /** Avisa quando o arco terminou de carregar (largura real do central em mm). */
  onLoaded?: (info: { centralWidthMm: number }) => void;
  onError?: (message: string) => void;
};

let htmlCache: string | null = null;
const binCache = new Map<string, string>();

async function viewerHtml(): Promise<string> {
  if (htmlCache) return htmlCache;
  const asset = Asset.fromModule(require('../../assets/viewer/smile3d.html'));
  await asset.downloadAsync();
  htmlCache = await new File(asset.localUri ?? asset.uri).text();
  return htmlCache;
}
async function archBase64(entry: ArchEntry): Promise<string> {
  const hit = binCache.get(entry.id);
  if (hit) return hit;
  const asset = Asset.fromModule(entry.bin);
  await asset.downloadAsync();
  const b64 = await new File(asset.localUri ?? asset.uri).base64();
  binCache.set(entry.id, b64);
  return b64;
}

/**
 * Anatomia 3D ao vivo: um WebView transparente com three.js (viewer/src/main.js empacotado em
 * assets/viewer/smile3d.html) desenha o arco completo por cima da foto. Não recebe toques: os gestos
 * continuam no canvas do app, que só manda parâmetros novos.
 */
export const Smile3D = forwardRef<Smile3DHandle, Props>(function Smile3D({ arch, params, onLoaded, onError }, ref) {
  const web = useRef<WebView>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const snapshotWaiters = useRef<((url: string) => void)[]>([]);
  const paramsJson = JSON.stringify(params);

  useEffect(() => {
    viewerHtml()
      .then(setHtml)
      .catch((e) => onError?.(String((e as Error).message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // arco: carrega quando o visualizador estiver pronto ou quando a biblioteca mudar
  useEffect(() => {
    if (!ready || loadedId === arch.id) return;
    let cancelled = false;
    archBase64(arch)
      .then((b64) => {
        if (cancelled) return;
        web.current?.injectJavaScript(`window.ShadeLab3D.loadArch("${b64}"); true;`);
      })
      .catch((e) => onError?.(String((e as Error).message ?? e)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, arch.id]);

  // parâmetros: sempre que mudarem (depois de pronto)
  useEffect(() => {
    if (!ready) return;
    web.current?.injectJavaScript(`window.ShadeLab3D.setParams(${paramsJson}); true;`);
  }, [ready, paramsJson]);

  useImperativeHandle(ref, () => ({
    snapshot: () =>
      new Promise<string>((resolve, reject) => {
        if (!ready) return reject(new Error('visualizador 3D ainda não está pronto'));
        snapshotWaiters.current.push(resolve);
        web.current?.injectJavaScript('window.ShadeLab3D.snapshot(); true;');
      }),
  }));

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type: string; [k: string]: unknown };
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.type === 'ready') setReady(true);
    else if (m.type === 'loaded') {
      setLoadedId(String(m.id));
      onLoaded?.({ centralWidthMm: Number(m.centralWidthMm) });
    } else if (m.type === 'snapshot') {
      const url = String(m.dataUrl);
      const waiters = snapshotWaiters.current;
      snapshotWaiters.current = [];
      waiters.forEach((w) => w(url));
    } else if (m.type === 'error') onError?.(String(m.message));
  };

  if (!html) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <WebView
        ref={web}
        source={{ html, baseUrl: 'https://shadelab.app/' }}
        onMessage={onMessage}
        originWhitelist={['*']}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        style={styles.web}
        containerStyle={styles.web}
        androidLayerType="hardware"
        onError={(ev) => onError?.(ev.nativeEvent.description)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: 'transparent' },
});
