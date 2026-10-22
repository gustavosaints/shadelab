import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { coverScale, cropFromView } from '@/lib/smile/frameAspect';
import { colors, fonts, spacing } from '@/theme';

type Photo = { uri: string; width: number; height: number };

type Props = {
  photo: Photo | null;
  /** Largura / altura da moldura (a do quadro da foto no Smile Design). */
  aspect: number;
  onDone: (photo: Photo) => void;
  onCancel: () => void;
};

/**
 * Cortar a foto da galeria na proporção do quadro do Smile Design (pedido do Gustavo, 2026-10-22): a moldura fica
 * parada; um dedo arrasta a foto e a pinça aproxima. "Usar a foto inteira" pula o corte.
 */
export function PhotoCropper({ photo, aspect, onDone, onCancel }: Props) {
  return (
    <Modal visible={!!photo} animationType="slide" onRequestClose={onCancel}>
      {photo && <CropBody photo={photo} aspect={aspect} onDone={onDone} onCancel={onCancel} />}
    </Modal>
  );
}

function CropBody({ photo, aspect, onDone, onCancel }: { photo: Photo; aspect: number; onDone: Props['onDone']; onCancel: Props['onCancel'] }) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const frameW = winW - spacing.md * 2;
  const frameH = frameW / aspect;
  const minScale = coverScale(photo.width, photo.height, frameW, frameH);
  const [view, setView] = useState({ scale: minScale, tx: 0, ty: 0 });
  const [busy, setBusy] = useState(false);
  const gesture = useRef<{ x: number; y: number; dist: number; scale: number; tx: number; ty: number } | null>(null);

  const clamp = (v: { scale: number; tx: number; ty: number }) => {
    const scale = Math.max(minScale, Math.min(minScale * 6, v.scale));
    const mx = Math.max(0, (photo.width * scale - frameW) / 2);
    const my = Math.max(0, (photo.height * scale - frameH) / 2);
    return { scale, tx: Math.max(-mx, Math.min(mx, v.tx)), ty: Math.max(-my, Math.min(my, v.ty)) };
  };
  const spread = (e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches ?? [];
    return t.length >= 2 ? Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY) : 0;
  };
  const grant = (e: GestureResponderEvent) => {
    gesture.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, dist: spread(e), scale: view.scale, tx: view.tx, ty: view.ty };
  };
  const move = (e: GestureResponderEvent) => {
    const g = gesture.current;
    if (!g) return;
    const d = spread(e);
    if (d > 0) {
      if (!g.dist) {
        gesture.current = { ...g, dist: d, scale: view.scale };
        return;
      }
      setView(clamp({ scale: (g.scale * d) / g.dist, tx: view.tx, ty: view.ty }));
    } else if (!g.dist) {
      setView(clamp({ scale: view.scale, tx: g.tx + e.nativeEvent.pageX - g.x, ty: g.ty + e.nativeEvent.pageY - g.y }));
    }
  };

  const crop = async () => {
    setBusy(true);
    try {
      const r = cropFromView(photo.width, photo.height, frameW, frameH, view.scale, view.tx, view.ty);
      const ref = await ImageManipulator.manipulate(photo.uri).crop({ originX: r.x, originY: r.y, width: r.w, height: r.h }).renderAsync();
      const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
      onDone({ uri: out.uri, width: out.width, height: out.height });
    } catch (e) {
      Alert.alert('Não foi possível cortar', String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.top}>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Text style={styles.topBtn}>Cancelar</Text>
        </Pressable>
        <Text style={styles.title}>Ajustar a foto</Text>
        <View style={{ width: 70 }} />
      </View>
      <Text style={styles.tip}>Arraste e use a pinça para enquadrar o rosto. A moldura é exatamente o que aparece na tela do Smile Design.</Text>
      <View
        style={[styles.frame, { width: frameW, height: frameH }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={grant}
        onResponderMove={move}
        onResponderRelease={() => (gesture.current = null)}
        onResponderTerminate={() => (gesture.current = null)}
      >
        <Image
          source={{ uri: photo.uri }}
          style={{
            position: 'absolute',
            width: photo.width * view.scale,
            height: photo.height * view.scale,
            left: frameW / 2 - (photo.width * view.scale) / 2 + view.tx,
            top: frameH / 2 - (photo.height * view.scale) / 2 + view.ty,
          }}
        />
        <View style={[StyleSheet.absoluteFill, styles.thirdsV]} pointerEvents="none" />
        <View style={[StyleSheet.absoluteFill, styles.thirdsH]} pointerEvents="none" />
      </View>
      <View style={{ flex: 1 }} />
      <Button title="Cortar e usar" onPress={crop} loading={busy} />
      <Button title="Usar a foto inteira" variant="ghost" onPress={() => onDone(photo)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#15171D', paddingHorizontal: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  topBtn: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 15, width: 70 },
  title: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 16 },
  tip: { color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center', lineHeight: 18, marginVertical: 12 },
  frame: { alignSelf: 'center', overflow: 'hidden', backgroundColor: '#000', borderWidth: 2, borderColor: colors.rose, borderRadius: 4 },
  // linhas dos terços, para ajudar a centralizar o rosto
  thirdsV: { marginLeft: '33.3%', marginRight: '33.3%', borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)' },
  thirdsH: { marginTop: '33.3%', marginBottom: '33.3%', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)' },
});
