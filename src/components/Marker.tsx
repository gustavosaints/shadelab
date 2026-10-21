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
  /** Mudança de largura/altura em px de tela (alça do canto ou pinça com dois dedos sobre o quadro). */
  onResize?: (dw: number, dh: number) => void;
  onRelease?: () => void;
  /** Linhas que dividem o quadro em terços (dente inteiro: cervical / médio / incisal). */
  thirds?: boolean;
};

/** Alça redonda no canto inferior direito, meio para fora do quadro, com área de toque generosa. */
const HANDLE = 26;
const HANDLE_HIT = 44;

type Touch = { pageX: number; pageY: number };
const touchesOf = (e: GestureResponderEvent): Touch[] => (e.nativeEvent.touches ?? []).map((t) => ({ pageX: t.pageX, pageY: t.pageY }));
const dist = (t: Touch[]) => (t.length >= 2 ? Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY) : 0);

/** Retângulo de amostragem arrastável e redimensionável sobre a foto. */
export function Marker({ x, y, width, height, color, label, onMove, onResize, onRelease, thirds }: Props) {
  const last = useRef({ x: 0, y: 0 });
  const mode = useRef<'move' | 'resize' | 'pinch'>('move');
  const pinch = useRef({ dist: 0, w: 0, h: 0 });

  // área de toque: o quadro + margem para a alça (que fica meio para fora do canto)
  const pad = HANDLE_HIT / 2;
  const hitW = Math.max(width, 44) + pad * 2;
  const hitH = Math.max(height, 44) + pad * 2;
  const boxLeft = (hitW - width) / 2;
  const boxTop = (hitH - height) / 2;

  // A alça é um responder próprio (abaixo): o toque que começa nela redimensiona; no resto do quadro, move.
  // (locationX/Y não servem para distinguir: vêm relativos ao filho tocado, e com zoom o quadro cresce.)
  const grant = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    last.current = { x: pageX, y: pageY };
    const t = touchesOf(e);
    if (t.length >= 2 && onResize) {
      mode.current = 'pinch';
      pinch.current = { dist: dist(t), w: width, h: height };
      return;
    }
    mode.current = 'move';
  };
  const grantHandle = (e: GestureResponderEvent) => {
    last.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    mode.current = 'resize';
  };
  const move = (e: GestureResponderEvent) => {
    const t = touchesOf(e);
    if (t.length >= 2 && onResize) {
      if (mode.current !== 'pinch') {
        mode.current = 'pinch';
        pinch.current = { dist: dist(t), w: width, h: height };
        return;
      }
      const k = pinch.current.dist > 10 ? dist(t) / pinch.current.dist : 1;
      onResize(pinch.current.w * k - width, pinch.current.h * k - height);
      return;
    }
    const { pageX, pageY } = e.nativeEvent;
    const dx = pageX - last.current.x;
    const dy = pageY - last.current.y;
    if (mode.current === 'resize') onResize?.(dx, dy);
    else if (mode.current === 'move') onMove(dx, dy);
    last.current = { x: pageX, y: pageY };
  };

  return (
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={grant}
      onResponderMove={move}
      onResponderRelease={() => onRelease?.()}
      onResponderTerminate={() => onRelease?.()}
      style={[styles.hit, { left: x - hitW / 2, top: y - hitH / 2, width: hitW, height: hitH }]}
    >
      <View style={[styles.box, { left: boxLeft, top: boxTop, width, height, borderColor: color }]}>
        {thirds && (
          <>
            <View style={[styles.third, { top: '33.3%', borderColor: color }]} />
            <View style={[styles.third, { top: '66.6%', borderColor: color }]} />
          </>
        )}
      </View>
      {onResize && (
        <View
          hitSlop={12}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={grantHandle}
          onResponderMove={move}
          onResponderRelease={() => onRelease?.()}
          onResponderTerminate={() => onRelease?.()}
          style={[styles.handle, { left: boxLeft + width - HANDLE / 2, top: boxTop + height - HANDLE / 2, backgroundColor: color }]}
        >
          <Text style={styles.handleGlyph}>⤡</Text>
        </View>
      )}
      <View style={[styles.tag, { backgroundColor: color, left: boxLeft, top: boxTop - 22 }]}>
        <Text style={styles.tagText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { position: 'absolute' },
  box: { position: 'absolute', borderWidth: 2.5, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  third: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', opacity: 0.8 },
  handle: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  handleGlyph: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: -1 },
  tag: { position: 'absolute', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
