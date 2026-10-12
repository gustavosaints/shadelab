import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { colors, spacing } from '@/theme';

type Params = { mode?: 'shade' | 'calibrate'; shade?: string };

export default function Capture() {
  const { mode = 'shade', shade } = useLocalSearchParams<Params>();
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();

  const goAnalyze = (uri: string, width: number, height: number) =>
    router.push({
      pathname: '/shade/analyze',
      params: { uri, w: String(width), h: String(height), mode, shade: shade ?? '' },
    });

  const takePhoto = async () => {
    if (!cameraRef.current || !ready || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, shutterSound: false });
      goAnalyze(photo.uri, photo.width, photo.height);
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
    goAnalyze(a.uri, a.width, a.height);
  };

  if (!permission) return <View style={styles.center} />;

  if (!permission.granted) {
    return (
      <View style={[styles.center, { padding: spacing.lg }]}>
        <Text style={styles.permTitle}>Precisamos da câmera</Text>
        <Text style={styles.permText}>Para fotografar o dente e a referência de cor.</Text>
        <Button title="Permitir câmera" onPress={requestPermission} style={{ marginTop: spacing.md }} />
        <Button title="Usar foto da galeria" variant="ghost" onPress={pickPhoto} />
        <Button title="Voltar" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash="off"
        animateShutter={false}
        onCameraReady={() => setReady(true)}
      />

      {/* Guias de enquadramento */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.guideTooth}>
          <Text style={styles.guideLabel}>DENTE</Text>
        </View>
        <View style={styles.guideRef}>
          <Text style={styles.guideLabel}>REFERÊNCIA</Text>
        </View>
      </View>

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.topBtn}>Fechar</Text>
        </Pressable>
        <Text style={styles.topTitle}>{mode === 'calibrate' ? `Calibrar ${shade}` : 'Tirar cor'}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.tip}>
          Luz natural indireta, sem flash. Dente limpo e úmido. Referência encostada ao dente, no mesmo plano.
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
  topBtn: { color: '#fff', fontWeight: '600', width: 50 },
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
  guideTooth: {
    position: 'absolute',
    top: '38%',
    left: '30%',
    width: '40%',
    height: '14%',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  guideRef: {
    position: 'absolute',
    top: '55%',
    left: '30%',
    width: '40%',
    height: '10%',
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  guideLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: -16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    borderRadius: 4,
  },
});
