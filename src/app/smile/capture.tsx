import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Button } from '@/components/Button';
import { FaceLandmarker, type FaceLandmarkerHandle } from '@/components/FaceLandmarker';
import { detectFace } from '@/lib/face/detect';
import { checkFraming, DEFAULT_GUIDE, HEAD_SILHOUETTE, type FramingCheck } from '@/lib/face/landmarks';
import { setPendingPhoto } from '@/lib/smile/pendingPhoto';
import { colors, spacing } from '@/theme';

/**
 * Câmera guiada do Smile Design com conferência AO VIVO: a prévia roda dentro de um
 * WebView (getUserMedia) junto com o MediaPipe em modo vídeo; a silhueta de cabeça e
 * ombros fica verde quando o rosto está enquadrado, e só então vale clicar.
 * Se o navegador não liberar a câmera, cai para a câmera nativa com conferência após o clique.
 */
export default function SmileCapture() {
  const [fallback, setFallback] = useState(false);
  return fallback ? <NativeCapture /> : <LiveCapture onFallback={() => setFallback(true)} />;
}

// ---------------------------------------------------------------------------------------------
// Prévia ao vivo no WebView
// ---------------------------------------------------------------------------------------------

const G = DEFAULT_GUIDE;
const S = HEAD_SILHOUETTE;

const LIVE_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body{margin:0;height:100%;background:#000;overflow:hidden}
  video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  svg{position:absolute;inset:0;width:100%;height:100%}
  #shade{fill:rgba(0,0,0,0.28)}
</style></head><body>
<video id="v" autoplay playsinline muted></video>
<svg viewBox="0 0 100 100" preserveAspectRatio="none">
  <defs><mask id="m"><rect width="100" height="100" fill="#fff"/><path d="${S.head}" fill="#000"/></mask></defs>
  <rect id="shade" width="100" height="100" mask="url(#m)"/>
  <path id="head" d="${S.head}" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="0.8" vector-effect="non-scaling-stroke" stroke-dasharray="2 1.5"/>
  <path id="sh" d="${S.shoulders}" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="0.6" vector-effect="non-scaling-stroke" stroke-dasharray="2 1.5"/>
  <rect id="mouth" x="${S.mouth.x}" y="${S.mouth.y}" width="${S.mouth.w}" height="${S.mouth.h}" rx="2" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="0.5" vector-effect="non-scaling-stroke" stroke-dasharray="1.5 1.2"/>
</svg>
<script type="module">
  const post = (o) => window.ReactNativeWebView.postMessage(JSON.stringify(o));
  const v = document.getElementById('v');
  const head = document.getElementById('head'), sh = document.getElementById('sh'), mouth = document.getElementById('mouth');
  const GUIDE = ${JSON.stringify(G)};
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
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
      const ctx = c.getContext('2d');
      if (mirrored) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/jpeg', 0.92).split(',')[1];
      post({ type:'photo', data, width: c.width, height: c.height, mirrored });
    } catch (e) { post({ type:'error', error:'captura: ' + String(e && e.message || e) }); }
  };

  function setColor(state){
    const col = state === 'ok' ? '#00E676' : state === 'bad' ? '#FF5252' : 'rgba(255,255,255,0.9)';
    head.setAttribute('stroke', col); mouth.setAttribute('stroke', col); sh.setAttribute('stroke', col);
    head.setAttribute('stroke-width', state === 'ok' ? '1.4' : '0.8');
    if (state === 'ok') { head.removeAttribute('stroke-dasharray'); } else { head.setAttribute('stroke-dasharray', '2 1.5'); }
  }

  // posição do vídeo na tela com object-fit: cover
  function toDisplay(x, y){
    const W = innerWidth, H = innerHeight, vw = v.videoWidth, vh = v.videoHeight;
    const s = Math.max(W / vw, H / vh);
    const offX = (W - vw * s) / 2, offY = (H - vh * s) / 2;
    let dx = (x * vw * s + offX) / W; const dy = (y * vh * s + offY) / H;
    if (mirrored) dx = 1 - dx;
    return [dx, dy];
  }
  function check(lm){
    let minX=1,minY=1,maxX=0,maxY=0;
    for (const p of lm){ const [x,y]=toDisplay(p.x,p.y); if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; }
    const [uxm, uy] = toDisplay(lm[13].x, lm[13].y); const [lxm, ly] = toDisplay(lm[14].x, lm[14].y);
    const w = maxX-minX, h = maxY-minY, cx = minX + w/2, cy = minY + h/2;
    const issues = [];
    if (Math.abs(cx - GUIDE.cx) > 0.07) issues.push(cx < GUIDE.cx ? 'Mova o rosto para a direita' : 'Mova o rosto para a esquerda');
    if (Math.abs(cy - GUIDE.cy) > 0.09) issues.push(cy < GUIDE.cy ? 'Abaixe um pouco' : 'Suba um pouco');
    const ratio = w / (GUIDE.rx * 2);
    if (ratio < 0.8) issues.push('Aproxime');
    if (ratio > 1.25) issues.push('Afaste');
    const mouthCy = (uy + ly) / 2;
    if (Math.abs(mouthCy - GUIDE.mouthCy) > GUIDE.mouthH) issues.push('Boca fora da faixa');
    if (Math.abs(ly - uy) < 0.012) issues.push('Sorria mostrando os dentes');
    return issues;
  }

  async function loop(now){
    requestAnimationFrame(loop);
    if (!landmarker || !v.videoWidth || now - lastT < 120) return;
    lastT = now;
    let lm = null;
    try { const r = landmarker.detectForVideo(v, now); lm = r.faceLandmarks && r.faceLandmarks[0]; } catch (e) { return; }
    const issues = lm ? check(lm) : ['Nenhum rosto'];
    const ok = lm && issues.length === 0;
    setColor(lm ? (ok ? 'ok' : 'bad') : 'none');
    if (ok !== lastOk || now - lastPost > 400) { lastOk = ok; lastPost = now; post({ type:'framing', ok: !!ok, issues }); }
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

function LiveCapture({ onFallback }: { onFallback: () => void }) {
  const web = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
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
      ? 'Sem internet: a conferência automática está desligada. Enquadre pela silhueta.'
      : cameraOk
        ? 'Carregando o detector…'
        : 'Abrindo a câmera…';

  return (
    <View style={styles.root}>
      <WebView
        ref={web}
        source={{ html: LIVE_HTML, baseUrl: 'https://shadelab.app/' }}
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
// Fallback: câmera nativa com silhueta estática e conferência depois do clique
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
      setCheck(det ? checkFraming(det.box, DEFAULT_GUIDE) : { ok: false, issues: ['Nenhum rosto encontrado'] });
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

  const frameColor = check ? (check.ok ? '#00E676' : '#FF5252') : 'rgba(255,255,255,0.85)';
  return (
    <View style={styles.root} onLayout={(e) => setSize(e.nativeEvent.layout)}>
      <FaceLandmarker ref={landmarker} />
      {shot ? (
        <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mirror={facing === 'front'} flash="off" animateShutter={false} onCameraReady={() => setReady(true)} />
      )}
      {size.width > 0 && (
        <Svg pointerEvents="none" width={size.width} height={size.height} viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          <Path d={S.head} stroke={frameColor} strokeWidth={check?.ok ? 1.4 : 0.8} vectorEffect="non-scaling-stroke" strokeDasharray={check ? undefined : '2 1.5'} fill="none" />
          <Path d={S.shoulders} stroke={frameColor} strokeWidth={0.6} vectorEffect="non-scaling-stroke" strokeDasharray="2 1.5" fill="none" />
          <Rect x={S.mouth.x} y={S.mouth.y} width={S.mouth.w} height={S.mouth.h} rx={2} stroke={frameColor} strokeWidth={0.5} vectorEffect="non-scaling-stroke" strokeDasharray="1.5 1.2" fill="none" />
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
            <Text style={styles.tip}>Encaixe a cabeça na silhueta e a boca na faixa. Sorriso amplo mostrando os dentes.</Text>
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
