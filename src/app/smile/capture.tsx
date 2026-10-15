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
import { FaceLandmarker, type FaceLandmarkerHandle } from '@/components/FaceLandmarker';
import { detectFace } from '@/lib/face/detect';
import { checkFraming, faceGuide, type FramingCheck } from '@/lib/face/landmarks';
import { setPendingPhoto } from '@/lib/smile/pendingPhoto';
import { colors, spacing } from '@/theme';

/**
 * Câmera guiada do Smile Design com conferência AO VIVO: a prévia roda dentro de um
 * WebView (getUserMedia) junto com o MediaPipe em modo vídeo. O guia é uma "ficha de
 * foto": janela 3:4, rosto grande com traços de sobrancelhas, olhos, nariz, lábios e
 * orelhas, cruz de alinhamento com o ângulo de inclinação da cabeça. Fica verde quando
 * o rosto está no lugar, nivelado e sorrindo; só então vale clicar.
 * Se o navegador não liberar a câmera, cai para a câmera nativa com conferência após o clique.
 */
export default function SmileCapture() {
  const [fallback, setFallback] = useState(false);
  return fallback ? <NativeCapture /> : <LiveCapture onFallback={() => setFallback(true)} />;
}

// ---------------------------------------------------------------------------------------------
// Prévia ao vivo no WebView
// ---------------------------------------------------------------------------------------------

/** HTML da prévia ao vivo para uma área de W×H px (guia desenhado em px, sem esticar). */
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
  text{font-family:-apple-system,Helvetica,Arial;font-weight:700}
</style></head><body>
<div id="frame"><video id="v" autoplay playsinline muted></video></div>
<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
  <g id="guide" stroke="rgba(230,230,230,0.85)" stroke-width="2.2" fill="none" stroke-linecap="round">
    <line id="cv" x1="${G.cross.x}" y1="${fr.y}" x2="${G.cross.x}" y2="${fr.y + fr.h}" stroke="rgba(255,80,80,0.75)" stroke-width="1" stroke-dasharray="4 4"/>
    <line id="ch" x1="${fr.x}" y1="${G.cross.eyeY}" x2="${fr.x + fr.w}" y2="${G.cross.eyeY}" stroke="rgba(255,80,80,0.75)" stroke-width="1" stroke-dasharray="4 4"/>
    <path id="head" d="${G.head}"/>
    <path id="feat" d="${G.features}" stroke-width="1.8" opacity="0.9"/>
    <rect id="mouth" x="${G.mouth.x.toFixed(1)}" y="${G.mouth.y.toFixed(1)}" width="${G.mouth.w.toFixed(1)}" height="${G.mouth.h.toFixed(1)}" rx="10" stroke-width="1.2" stroke-dasharray="6 5" opacity="0.7"/>
  </g>
  <text id="angle" x="${(fr.x + fr.w - 8).toFixed(1)}" y="${(G.cross.eyeY - 8).toFixed(1)}" text-anchor="end" font-size="15" fill="rgba(255,80,80,0.95)"></text>
</svg>
<script type="module">
  const post = (o) => window.ReactNativeWebView.postMessage(JSON.stringify(o));
  const v = document.getElementById('v');
  const guide = document.getElementById('guide'), angleEl = document.getElementById('angle');
  const GUIDE = ${JSON.stringify(G.guide)};
  const FR = ${JSON.stringify(fr)};
  const W = ${W}, H = ${H};
  let facing = 'user', stream = null, mirrored = true, landmarker = null, lastPost = 0, lastOk = null, lastT = 0;

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

  function setColor(state){
    const col = state === 'ok' ? '#00E676' : state === 'bad' ? '#FF5252' : 'rgba(230,230,230,0.85)';
    guide.setAttribute('stroke', col);
    guide.setAttribute('stroke-width', state === 'ok' ? '3' : '2.2');
  }

  // marcos (0..1 do vídeo) → frações da área inteira W×H, considerando a janela e o object-fit: cover
  function toDisplay(x, y){
    const vw = v.videoWidth, vh = v.videoHeight;
    const s = Math.max(FR.w / vw, FR.h / vh);
    const offX = FR.x + (FR.w - vw * s) / 2, offY = FR.y + (FR.h - vh * s) / 2;
    let px = x * vw * s + offX; const py = y * vh * s + offY;
    if (mirrored) px = 2 * (FR.x + FR.w / 2) - px;
    return [px / W, py / H];
  }
  function check(lm){
    let minX=1,minY=1,maxX=0,maxY=0;
    for (const p of lm){ const [x,y]=toDisplay(p.x,p.y); if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; }
    const [, uy] = toDisplay(lm[13].x, lm[13].y); const [, ly] = toDisplay(lm[14].x, lm[14].y);
    const [rx, ry] = toDisplay(lm[468].x, lm[468].y); const [lx, lyy] = toDisplay(lm[473].x, lm[473].y);
    const roll = Math.atan2((lyy - ry) * H, (lx - rx) * W) * 180 / Math.PI;
    const w = maxX-minX, h = maxY-minY, cx = minX + w/2, cy = minY + h/2;
    const issues = [];
    if (Math.abs(cx - GUIDE.cx) > 0.06) issues.push(cx < GUIDE.cx ? 'Mova o rosto para a direita' : 'Mova o rosto para a esquerda');
    if (Math.abs(cy - GUIDE.cy) > 0.07) issues.push(cy < GUIDE.cy ? 'Abaixe um pouco' : 'Suba um pouco');
    const ratio = w / (GUIDE.rx * 2);
    if (ratio < 0.82) issues.push('Aproxime');
    if (ratio > 1.22) issues.push('Afaste');
    if (Math.abs(roll) > 4) issues.push('Nivele a cabeça');
    const mouthCy = (uy + ly) / 2;
    if (Math.abs(mouthCy - GUIDE.mouthCy) > GUIDE.mouthH) issues.push('Boca fora da faixa');
    if (Math.abs(ly - uy) < 0.012) issues.push('Sorria mostrando os dentes');
    return { issues, roll };
  }

  async function loop(now){
    requestAnimationFrame(loop);
    if (!landmarker || !v.videoWidth || now - lastT < 120) return;
    lastT = now;
    let lm = null;
    try { const r = landmarker.detectForVideo(v, now); lm = r.faceLandmarks && r.faceLandmarks[0]; } catch (e) { return; }
    let issues = ['Nenhum rosto'], roll = null;
    if (lm) { const c = check(lm); issues = c.issues; roll = c.roll; }
    const ok = lm && issues.length === 0;
    setColor(lm ? (ok ? 'ok' : 'bad') : 'none');
    if (roll === null) { angleEl.textContent = ''; }
    else { angleEl.textContent = (roll > 0 ? '+' : '') + roll.toFixed(0) + '°'; angleEl.setAttribute('fill', Math.abs(roll) <= 4 ? '#00E676' : '#FF5252'); }
    if (ok !== lastOk || now - lastPost > 400) { lastOk = ok; lastPost = now; post({ type:'framing', ok: !!ok, issues, roll }); }
  }

  (async () => {
    await start('user');
    try {
      const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
      const fileset = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
      landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' },
        runningMode: 'VIDEO', numFaces: 1,
      });
      post({ type:'detector', ok:true });
      requestAnimationFrame(loop);
    } catch (e) { post({ type:'detector', ok:false, error:String(e && e.message || e) }); }
  })();
</script></body></html>`;
};

function LiveCapture({ onFallback }: { onFallback: () => void }) {
  const web = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const [cameraOk, setCameraOk] = useState<boolean | null>(null);
  const [detectorOk, setDetectorOk] = useState<boolean | null>(null);
  const [framing, setFraming] = useState<{ ok: boolean; issues: string[] } | null>(null);
  const [saving, setSaving] = useState(false);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type: string; ok?: boolean; error?: string; issues?: string[]; data?: string; width?: number; height?: number; mirrored?: boolean };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'camera') {
      setCameraOk(!!msg.ok);
      if (!msg.ok) onFallback();
    } else if (msg.type === 'detector') {
      setDetectorOk(!!msg.ok);
    } else if (msg.type === 'framing') {
      setFraming({ ok: !!msg.ok, issues: msg.issues ?? [] });
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

  const status = framing
    ? framing.ok
      ? 'Enquadramento OK, pode fotografar.'
      : framing.issues.join(' · ')
    : detectorOk === false
      ? 'Sem internet: a conferência automática está desligada. Enquadre pelo guia.'
      : cameraOk
        ? 'Carregando o detector…'
        : 'Abrindo a câmera…';

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
        <Text style={[styles.tip, framing?.ok && { color: '#B9F6CA' }, framing && !framing.ok && { color: '#FFCDD2' }]}>{status}</Text>
        <View style={styles.controls}>
          <Pressable onPress={pickPhoto} style={styles.sideBtn}>
            <Text style={styles.sideText}>Galeria</Text>
          </Pressable>
          <Pressable onPress={shoot} disabled={saving || !cameraOk} style={[styles.shutterOuter, framing?.ok && { borderColor: '#00E676' }]}>
            <View style={[styles.shutterInner, framing?.ok && { backgroundColor: '#00E676' }, (saving || !cameraOk) && { opacity: 0.4 }]} />
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
// Fallback: câmera nativa com guia estático e conferência depois do clique
// ---------------------------------------------------------------------------------------------

type Shot = { uri: string; width: number; height: number; mirrored: boolean };

function NativeCapture() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const [check, setCheck] = useState<FramingCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const cameraRef = useRef<CameraView>(null);
  const landmarker = useRef<FaceLandmarkerHandle>(null);
  const insets = useSafeAreaInsets();

  const verify = async (s: Shot) => {
    setChecking(true);
    setCheck(null);
    try {
      if (!landmarker.current) throw new Error('detector indisponível');
      const det = await detectFace(landmarker.current, s.uri);
      setCheck(det ? checkFraming(det.box, faceGuide(size.width || 1, size.height || 1).guide) : { ok: false, issues: ['Nenhum rosto encontrado'] });
    } catch (e) {
      setCheck({ ok: false, issues: [`Não deu para conferir: ${String((e as Error).message ?? e)}`] });
    } finally {
      setChecking(false);
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current || !ready || busy) return;
    setBusy(true);
    try {
      const p = await cameraRef.current.takePictureAsync({ quality: 1, shutterSound: false });
      const s = { uri: p.uri, width: p.width, height: p.height, mirrored: facing === 'front' };
      setShot(s);
      verify(s);
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
    const s = { uri: a.uri, width: a.width, height: a.height, mirrored: false };
    setShot(s);
    verify(s);
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

  const frameColor = check ? (check.ok ? '#00E676' : '#FF5252') : 'rgba(230,230,230,0.85)';
  const G = size.width > 0 ? faceGuide(size.width, size.height) : null;
  return (
    <View style={styles.root} onLayout={(e) => setSize(e.nativeEvent.layout)}>
      <FaceLandmarker ref={landmarker} />
      {shot ? (
        <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mirror={facing === 'front'} flash="off" animateShutter={false} onCameraReady={() => setReady(true)} />
      )}
      {G && (
        <Svg pointerEvents="none" width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
          <Line x1={G.cross.x} y1={G.frame.y} x2={G.cross.x} y2={G.frame.y + G.frame.h} stroke="rgba(255,80,80,0.75)" strokeWidth={1} strokeDasharray="4 4" />
          <Line x1={G.frame.x} y1={G.cross.eyeY} x2={G.frame.x + G.frame.w} y2={G.cross.eyeY} stroke="rgba(255,80,80,0.75)" strokeWidth={1} strokeDasharray="4 4" />
          <Path d={G.head} stroke={frameColor} strokeWidth={check?.ok ? 3 : 2.2} fill="none" strokeLinecap="round" />
          <Path d={G.features} stroke={frameColor} strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.9} />
          <Rect x={G.mouth.x} y={G.mouth.y} width={G.mouth.w} height={G.mouth.h} rx={10} stroke={frameColor} strokeWidth={1.2} strokeDasharray="6 5" fill="none" opacity={0.7} />
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
            <Text style={styles.tip}>Encaixe o rosto no guia: olhos na linha, boca na faixa. Sorriso amplo mostrando os dentes.</Text>
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
          <>
            <Text style={[styles.tip, check?.ok && { color: '#B9F6CA' }, check && !check.ok && { color: '#FFCDD2' }]}>
              {checking ? 'Conferindo o enquadramento…' : check ? (check.ok ? 'Enquadramento OK.' : check.issues.join(' · ')) : ''}
            </Text>
            <View style={styles.controls}>
              <Button title="Repetir" variant="ghost" onPress={() => setShot(null)} />
              <Button title={check && !check.ok ? 'Usar mesmo assim' : 'Usar foto'} onPress={use} />
            </View>
          </>
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
