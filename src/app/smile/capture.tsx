import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Button } from '@/components/Button';
import { faceGuide } from '@/lib/face/landmarks';
import { setPendingPhoto } from '@/lib/smile/pendingPhoto';
import { colors, spacing } from '@/theme';

const TIP = 'Encaixe o rosto no guia: olhos na linha, boca na faixa. Sorria mostrando os dentes.';

/**
 * Câmera guiada do Smile Design: janela 3:4 com um guia de rosto (contorno, olhos,
 * nariz, lábios, orelhas e cruz de alinhamento) para padronizar o enquadramento.
 * A prévia roda num WebView (getUserMedia) para a selfie sair espelhada e recortada
 * na janela; se o navegador não liberar a câmera, cai para a câmera nativa.
 */
export default function SmileCapture() {
  const [fallback, setFallback] = useState(false);
  return fallback ? <NativeCapture /> : <LiveCapture onFallback={() => setFallback(true)} />;
}

/** HTML da prévia para uma área de W×H px (guia desenhado em px, sem esticar). */
const liveHtml = (W: number, H: number) => {
  const G = faceGuide(W, H);
  const fr = G.frame;
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body{margin:0;height:100%;background:#000;overflow:hidden}
  #frame{position:absolute;left:${fr.x}px;top:${fr.y}px;width:${fr.w}px;height:${fr.h}px;background:#000;overflow:hidden}
  video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  svg{position:absolute;inset:0;width:100%;height:100%}
</style></head><body>
<div id="frame"><video id="v" autoplay playsinline muted></video></div>
<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
  <g stroke="rgba(235,235,235,0.9)" stroke-width="2.2" fill="none" stroke-linecap="round">
    <line x1="${G.cross.x}" y1="${fr.y}" x2="${G.cross.x}" y2="${fr.y + fr.h}" stroke="rgba(255,80,80,0.75)" stroke-width="1" stroke-dasharray="4 4"/>
    <line x1="${fr.x}" y1="${G.cross.eyeY}" x2="${fr.x + fr.w}" y2="${G.cross.eyeY}" stroke="rgba(255,80,80,0.75)" stroke-width="1" stroke-dasharray="4 4"/>
    <path d="${G.head}"/>
    <path d="${G.features}" stroke-width="1.8" opacity="0.9"/>
    <rect x="${G.mouth.x.toFixed(1)}" y="${G.mouth.y.toFixed(1)}" width="${G.mouth.w.toFixed(1)}" height="${G.mouth.h.toFixed(1)}" rx="10" stroke-width="1.2" stroke-dasharray="6 5" opacity="0.7"/>
  </g>
</svg>
<script>
  const post = (o) => window.ReactNativeWebView.postMessage(JSON.stringify(o));
  const v = document.getElementById('v');
  const FR = ${JSON.stringify(fr)};
  let facing = 'user', stream = null, mirrored = true;
  function stopStream(){ if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
  async function start(f){
    stopStream();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { post({ type:'camera', ok:false, error:'getUserMedia indisponível' }); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio:false, video:{ facingMode: f, width:{ ideal: 1920 }, height:{ ideal: 1440 } } });
    } catch (e) { post({ type:'camera', ok:false, error:String(e && e.message || e) }); return; }
    facing = f; mirrored = f === 'user';
    v.style.transform = mirrored ? 'scaleX(-1)' : '';
    v.srcObject = stream;
    try { await v.play(); } catch (e) {}
    post({ type:'camera', ok:true, facing, width: v.videoWidth, height: v.videoHeight });
  }
  window.__switch = () => start(facing === 'user' ? 'environment' : 'user');
  window.__capture = () => {
    try {
      // recorta o que aparece na janela 3:4 (object-fit: cover)
      const vw = v.videoWidth, vh = v.videoHeight;
      const s = Math.max(FR.w / vw, FR.h / vh);
      const cw = Math.round(FR.w / s), chh = Math.round(FR.h / s);
      const sx = Math.round((vw - cw) / 2), sy = Math.round((vh - chh) / 2);
      const c = document.createElement('canvas'); c.width = cw; c.height = chh;
      const ctx = c.getContext('2d');
      if (mirrored) { ctx.translate(cw, 0); ctx.scale(-1, 1); }
      ctx.drawImage(v, sx, sy, cw, chh, 0, 0, cw, chh);
      const data = c.toDataURL('image/jpeg', 0.92).split(',')[1];
      post({ type:'photo', data, width: cw, height: chh, mirrored });
    } catch (e) { post({ type:'error', error:'captura: ' + String(e && e.message || e) }); }
  };
  start('user');
</script></body></html>`;
};

function LiveCapture({ onFallback }: { onFallback: () => void }) {
  const web = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const [cameraOk, setCameraOk] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type: string; ok?: boolean; error?: string; data?: string; width?: number; height?: number; mirrored?: boolean };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'camera') {
      setCameraOk(!!msg.ok);
      if (!msg.ok) onFallback();
    } else if (msg.type === 'photo' && msg.data) {
      try {
        const f = new File(Paths.cache, `smile-${Date.now()}.jpg`);
        f.write(msg.data, { encoding: 'base64' });
        setPendingPhoto({ uri: f.uri, width: msg.width ?? 0, height: msg.height ?? 0, mirrored: !!msg.mirrored });
        router.back();
      } catch (err) {
        Alert.alert('Não foi possível guardar a foto', String(err));
      } finally {
        setSaving(false);
      }
    } else if (msg.type === 'error') {
      setSaving(false);
      Alert.alert('Erro na câmera', msg.error ?? '');
    }
  };

  const shoot = () => {
    setSaving(true);
    web.current?.injectJavaScript('window.__capture && window.__capture(); true;');
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setPendingPhoto({ uri: a.uri, width: a.width, height: a.height, mirrored: false });
    router.back();
  };

  return (
    <View style={styles.root}>
      <WebView
        ref={web}
        source={{ html: liveHtml(winW, winH), baseUrl: 'https://shadelab.app/' }}
        onMessage={onMessage}
        style={StyleSheet.absoluteFill}
        javaScriptEnabled
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        allowsProtectedMedia
        bounces={false}
        scrollEnabled={false}
      />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.topBtn}>Fechar</Text>
        </Pressable>
        <Text style={styles.topTitle}>Foto do sorriso</Text>
        <Pressable onPress={() => web.current?.injectJavaScript('window.__switch && window.__switch(); true;')} hitSlop={12}>
          <Text style={[styles.topBtn, { textAlign: 'right' }]}>Trocar câmera</Text>
        </Pressable>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.tip}>{cameraOk ? TIP : 'Abrindo a câmera…'}</Text>
        <View style={styles.controls}>
          <Pressable onPress={pickPhoto} style={styles.sideBtn}>
            <Text style={styles.sideText}>Galeria</Text>
          </Pressable>
          <Pressable onPress={shoot} disabled={saving || !cameraOk} style={styles.shutterOuter}>
            <View style={[styles.shutterInner, (saving || !cameraOk) && { opacity: 0.4 }]} />
          </Pressable>
          <Pressable onPress={onFallback} style={styles.sideBtn}>
            <Text style={styles.sideText}>Câmera nativa</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Fallback: câmera nativa com o mesmo guia
// ---------------------------------------------------------------------------------------------

type Shot = { uri: string; width: number; height: number; mirrored: boolean };

function NativeCapture() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();

  const takePhoto = async () => {
    if (!cameraRef.current || !ready || busy) return;
    setBusy(true);
    try {
      const p = await cameraRef.current.takePictureAsync({ quality: 1, shutterSound: false });
      setShot({ uri: p.uri, width: p.width, height: p.height, mirrored: facing === 'front' });
    } catch (e) {
      Alert.alert('Erro ao capturar', String(e));
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setShot({ uri: a.uri, width: a.width, height: a.height, mirrored: false });
  };

  const use = () => {
    if (!shot) return;
    setPendingPhoto(shot);
    router.back();
  };

  if (!permission) return <View style={styles.center} />;
  if (!permission.granted) {
    return (
      <View style={[styles.center, { padding: spacing.lg }]}>
        <Text style={styles.permTitle}>Precisamos da câmera</Text>
        <Text style={styles.permText}>Para fotografar o sorriso com o enquadramento padrão.</Text>
        <Button title="Permitir câmera" onPress={requestPermission} style={{ marginTop: spacing.md }} />
        <Button title="Usar foto da galeria" variant="ghost" onPress={pickPhoto} />
        <Button title="Voltar" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  const G = size.width > 0 ? faceGuide(size.width, size.height) : null;
  const stroke = 'rgba(235,235,235,0.9)';
  return (
    <View style={styles.root} onLayout={(e) => setSize(e.nativeEvent.layout)}>
      {shot ? (
        <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mirror={facing === 'front'} flash="off" animateShutter={false} onCameraReady={() => setReady(true)} />
      )}
      {G && !shot && (
        <Svg pointerEvents="none" width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
          <Line x1={G.cross.x} y1={G.frame.y} x2={G.cross.x} y2={G.frame.y + G.frame.h} stroke="rgba(255,80,80,0.75)" strokeWidth={1} strokeDasharray="4 4" />
          <Line x1={G.frame.x} y1={G.cross.eyeY} x2={G.frame.x + G.frame.w} y2={G.cross.eyeY} stroke="rgba(255,80,80,0.75)" strokeWidth={1} strokeDasharray="4 4" />
          <Path d={G.head} stroke={stroke} strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <Path d={G.features} stroke={stroke} strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.9} />
          <Rect x={G.mouth.x} y={G.mouth.y} width={G.mouth.w} height={G.mouth.h} rx={10} stroke={stroke} strokeWidth={1.2} strokeDasharray="6 5" fill="none" opacity={0.7} />
        </Svg>
      )}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.topBtn}>Fechar</Text>
        </Pressable>
        <Text style={styles.topTitle}>Foto do sorriso</Text>
        {!shot ? (
          <Pressable onPress={() => setFacing(facing === 'front' ? 'back' : 'front')} hitSlop={12}>
            <Text style={[styles.topBtn, { textAlign: 'right' }]}>{facing === 'front' ? 'Traseira' : 'Frontal'}</Text>
          </Pressable>
        ) : (
          <View style={{ width: 90 }} />
        )}
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {!shot ? (
          <>
            <Text style={styles.tip}>{TIP}</Text>
            <View style={styles.controls}>
              <Pressable onPress={pickPhoto} style={styles.sideBtn}>
                <Text style={styles.sideText}>Galeria</Text>
              </Pressable>
              <Pressable onPress={takePhoto} disabled={!ready || busy} style={styles.shutterOuter}>
                <View style={[styles.shutterInner, (!ready || busy) && { opacity: 0.4 }]} />
              </Pressable>
              <View style={styles.sideBtn} />
            </View>
          </>
        ) : (
          <View style={styles.controls}>
            <Button title="Repetir" variant="ghost" onPress={() => setShot(null)} />
            <Button title="Usar foto" onPress={use} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  permTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  permText: { color: colors.muted, textAlign: 'center', marginTop: 6 },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingBottom: 10,
  },
  topBtn: { color: '#fff', fontWeight: '600', width: 90 },
  topTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', paddingTop: 12, paddingHorizontal: spacing.md },
  tip: { color: '#E6ECF5', fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 12, fontWeight: '600' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideBtn: { width: 90, alignItems: 'center' },
  sideText: { color: '#fff', fontWeight: '600' },
  shutterOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
});
