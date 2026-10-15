import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { Landmark } from '@/lib/face/landmarks';

export type FaceLandmarkerHandle = {
  /** Detecta os 478 marcos numa imagem JPEG em base64. Devolve null se não achar rosto. */
  detect: (jpegBase64: string) => Promise<Landmark[] | null>;
  ready: boolean;
};

/**
 * Detector de rosto/boca sem módulo nativo: um WebView invisível carrega o MediaPipe
 * Face Landmarker (WASM) da CDN e responde por postMessage. Funciona no Expo Go;
 * precisa de internet na primeira carga (modelo ~3 MB, depois fica no cache do WebView).
 */
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script type="module">
  const post = (o) => window.ReactNativeWebView.postMessage(JSON.stringify(o));
  let landmarker = null;
  try {
    const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
    const fileset = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
    landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' },
      runningMode: 'IMAGE',
      numFaces: 1,
    });
    post({ type: 'ready' });
  } catch (e) {
    post({ type: 'ready', error: String(e && e.message || e) });
  }
  window.__detect = async (id, b64) => {
    try {
      if (!landmarker) throw new Error('detector não carregou (sem internet?)');
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('imagem inválida')); img.src = 'data:image/jpeg;base64,' + b64; });
      const r = landmarker.detect(img);
      const lm = r.faceLandmarks && r.faceLandmarks[0];
      post({ type: 'result', id, landmarks: lm ? lm.map((p) => [Math.round(p.x * 10000) / 10000, Math.round(p.y * 10000) / 10000]) : null });
    } catch (e) {
      post({ type: 'result', id, error: String(e && e.message || e) });
    }
  };
</script></body></html>`;

type Pending = { resolve: (v: Landmark[] | null) => void; reject: (e: Error) => void };

export const FaceLandmarker = forwardRef<FaceLandmarkerHandle, { onReady?: (ok: boolean, error?: string) => void }>(function FaceLandmarker(
  { onReady },
  ref,
) {
  const web = useRef<WebView>(null);
  const pending = useRef(new Map<number, Pending>());
  const seq = useRef(0);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const readyWaiters = useRef<(() => void)[]>([]);

  useImperativeHandle(ref, () => ({
    get ready() {
      return ready;
    },
    detect: (b64: string) =>
      new Promise<Landmark[] | null>((resolve, reject) => {
        const run = () => {
          const id = ++seq.current;
          pending.current.set(id, { resolve, reject });
          const safe = b64.replace(/[^A-Za-z0-9+/=]/g, '');
          web.current?.injectJavaScript(`window.__detect(${id}, "${safe}"); true;`);
          setTimeout(() => {
            if (pending.current.has(id)) {
              pending.current.delete(id);
              reject(new Error('Tempo esgotado na detecção do rosto.'));
            }
          }, 60_000);
        };
        if (readyRef.current) run();
        else {
          readyWaiters.current.push(run);
          setTimeout(() => {
            const i = readyWaiters.current.indexOf(run);
            if (i >= 0) {
              readyWaiters.current.splice(i, 1);
              reject(new Error('O detector de rosto não carregou. Verifique a internet e tente de novo.'));
            }
          }, 45_000);
        }
      }),
  }));

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type: string; id?: number; landmarks?: number[][] | null; error?: string };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      const ok = !msg.error;
      readyRef.current = ok;
      setReady(ok);
      onReady?.(ok, msg.error);
      if (ok) {
        const waiters = readyWaiters.current.splice(0);
        waiters.forEach((w) => w());
      }
      return;
    }
    if (msg.type === 'result' && msg.id !== undefined) {
      const p = pending.current.get(msg.id);
      if (!p) return;
      pending.current.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error));
      else p.resolve(msg.landmarks ? msg.landmarks.map(([x, y]) => ({ x, y })) : null);
    }
  };

  return (
    <View style={{ width: 1, height: 1, opacity: 0, position: 'absolute', left: -2, top: -2 }} pointerEvents="none">
      <WebView
        ref={web}
        source={{ html: HTML, baseUrl: 'https://localhost/' }}
        onMessage={onMessage}
        javaScriptEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
        allowFileAccess
        style={{ width: 1, height: 1, backgroundColor: 'transparent' }}
      />
    </View>
  );
});
