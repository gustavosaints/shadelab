import { useRef } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

type Props = {
  x: number; // centro, em pixels de tela
  y: number;
  size: number;
  color: string;
  label: string;
  onMove: (dx: number, dy: number) => void;
  onRelease?: () => void;
};

/** Quadrado de amostragem arrastável sobre a foto. */
export function Marker({ x, y, size, color, label, onMove, onRelease }: Props) {
  const last = useRef({ x: 0, y: 0 });

  const grant = (e: GestureResponderEvent) => {
    last.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
  };
  const move = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    onMove(pageX - last.current.x, pageY - last.current.y);
    last.current = { x: pageX, y: pageY };
  };

  const hit = Math.max(size, 44);
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
      style={[styles.hit, { left: x - hit / 2, top: y - hit / 2, width: hit, height: hit }]}
    >
      <View style={[styles.box, { width: size, height: size, borderColor: color }]} />
      <View style={[styles.tag, { backgroundColor: color }]}>
        <Text style={styles.tagText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  box: { borderWidth: 2.5, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' },
  tag: {
    position: 'absolute',
    top: -22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
