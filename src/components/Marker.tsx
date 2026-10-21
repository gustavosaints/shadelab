import { useRef } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

type Props = {
  x: number; // centro, em pixels de tela
  y: number;
  width: number;
  height: number;
  color: string;
  label: string;
  onMove: (dx: number, dy: number) => void;
  /** Arrasto da alça do canto inferior direito: muda largura/altura (px de tela). */
  onResize?: (dw: number, dh: number) => void;
  onRelease?: () => void;
  /** Linhas que dividem o quadro em terços (dente inteiro: cervical / médio / incisal). */
  thirds?: boolean;
};

/** Retângulo de amostragem arrastável e redimensionável sobre a foto. */
export function Marker({ x, y, width, height, color, label, onMove, onResize, onRelease, thirds }: Props) {
  const last = useRef({ x: 0, y: 0 });
  const resizing = useRef(false);

  const HANDLE = 22;
  const hitW = Math.max(width, 44);
  const hitH = Math.max(height, 44);

  const grant = (e: GestureResponderEvent) => {
    const { pageX, pageY, locationX, locationY } = e.nativeEvent;
    last.current = { x: pageX, y: pageY };
    // toque no canto inferior direito = redimensionar
    const inX = locationX - (hitW - width) / 2;
    const inY = locationY - (hitH - height) / 2;
    resizing.current = !!onResize && inX > width - HANDLE - 6 && inY > height - HANDLE - 6;
  };
  const move = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    const dx = pageX - last.current.x;
    const dy = pageY - last.current.y;
    if (resizing.current) onResize?.(dx, dy);
    else onMove(dx, dy);
    last.current = { x: pageX, y: pageY };
  };

  return (
    <View
      onStartShouldSetResponder={() => true}
      onStartShouldSetResponderCapture={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={grant}
      onResponderMove={move}
      onResponderRelease={() => onRelease?.()}
      onResponderTerminate={() => onRelease?.()}
      style={[styles.hit, { left: x - hitW / 2, top: y - hitH / 2, width: hitW, height: hitH }]}
    >
      <View style={[styles.box, { width, height, borderColor: color }]}>
        {thirds && (
          <>
            <View style={[styles.third, { top: '33.3%', borderColor: color }]} />
            <View style={[styles.third, { top: '66.6%', borderColor: color }]} />
          </>
        )}
        {onResize && <View style={[styles.handle, { backgroundColor: color }]} />}
      </View>
      <View style={[styles.tag, { backgroundColor: color, top: (hitH - height) / 2 - 22 }]}>
        <Text style={styles.tagText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  box: { borderWidth: 2.5, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  third: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', opacity: 0.8 },
  handle: { position: 'absolute', right: -1, bottom: -1, width: 14, height: 14, borderTopLeftRadius: 6, opacity: 0.95 },
  tag: {
    position: 'absolute',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
