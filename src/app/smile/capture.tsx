import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse, Rect } from 'react-native-svg';
import { Button } from '@/components/Button';
import { FaceLandmarker, type FaceLandmarkerHandle } from '@/components/FaceLandmarker';
import { detectFace } from '@/lib/face/detect';
import { checkFraming, DEFAULT_GUIDE, type FramingCheck } from '@/lib/face/landmarks';
import { setPendingPhoto } from '@/lib/smile/pendingPhoto';
import { colors, spacing } from '@/theme';

type Shot = { uri: string; width: number; height: number; mirrored: boolean };

/**
 * Câmera guiada do Smile Design: silhueta de rosto e faixa da boca para enquadrar
 * sempre igual. Depois do clique, o detector confere o enquadramento e a moldura
 * fica verde (ou vermelha, com o que corrigir). Selfie sai espelhada como no espelho.
 */
export default function SmileCapture() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const [check, setCheck] = useState<FramingCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [detectorError, setDetectorError] = useState<string | null>(null);
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
      if (!det) {
        setCheck({ ok: false, issues: ['Nenhum rosto encontrado'] });
        return;
      }
      setCheck(checkFraming(det.box, DEFAULT_GUIDE));
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

  const g = DEFAULT_GUIDE;
  const frameColor = check ? (check.ok ? '#00E676' : '#FF5252') : 'rgba(255,255,255,0.85)';

  return (
    <View style={styles.root} onLayout={(e) => setSize(e.nativeEvent.layout)}>
      <FaceLandmarker ref={landmarker} onReady={(ok, err) => setDetectorError(ok ? null : (err ?? 'sem internet'))} />
      {shot ? (
        <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mirror={facing === 'front'}
          flash="off"
          animateShutter={false}
          onCameraReady={() => setReady(true)}
        />
      )}

      {/* Silhueta: elipse do rosto e faixa da boca */}
      {size.width > 0 && (
        <Svg pointerEvents="none" width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
          <Ellipse
            cx={g.cx * size.width}
            cy={g.cy * size.height}
            rx={g.rx * size.width}
            ry={g.ry * size.height}
            stroke={frameColor}
            strokeWidth={check?.ok ? 5 : 3}
            strokeDasharray={check ? undefined : '10 8'}
            fill="none"
          />
          <Rect
            x={(g.cx - g.rx * 0.55) * size.width}
            y={(g.mouthCy - g.mouthH / 2) * size.height}
            width={g.rx * 1.1 * size.width}
            height={g.mouthH * size.height}
            rx={12}
            stroke={frameColor}
            strokeWidth={2}
            strokeDasharray="6 5"
            fill="none"
          />
        </Svg>
      )}

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.topBtn}>Fechar</Text>
        </Pressable>
        <Text style={styles.topTitle}>Foto do sorriso</Text>
        {!shot ? (
          <Pressable onPress={() => setFacing(facing === 'front' ? 'back' : 'front')} hitSlop={12}>
            <Text style={styles.topBtn}>{facing === 'front' ? 'Traseira' : 'Frontal'}</Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {!shot ? (
          <>
            <Text style={styles.tip}>
              Encaixe o rosto na silhueta e a boca na faixa. Sorriso amplo mostrando os dentes, câmera na altura da
              boca, boa luz.{detectorError ? ' (Sem internet: a conferência automática fica desligada.)' : ''}
            </Text>
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
              {checking
                ? 'Conferindo o enquadramento…'
                : check
                  ? check.ok
                    ? 'Enquadramento OK.'
                    : check.issues.join(' · ')
                  : ''}
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
  topBtn: { color: '#fff', fontWeight: '600', width: 60 },
  topTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingTop: 12,
    paddingHorizontal: spacing.md,
  },
  tip: { color: '#E6ECF5', fontSize: 12, textAlign: 'center', lineHeight: 17, marginBottom: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideBtn: { width: 70, alignItems: 'center' },
  sideText: { color: '#fff', fontWeight: '600' },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
});
