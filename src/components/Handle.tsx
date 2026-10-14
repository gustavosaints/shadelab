import { useRef } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { colors } from '@/theme';

type Props = {
  x: number;
  y: number;
  glyph: string;
  onMove: (dx: number, dy: number) => void;
};

/** Alça circular arrastável sobre a foto (um dedo). */
export function Handle({ x, y, glyph, onMove }: Props) {
  const last = useRef({ x: 0, y: 0 });
  const size = 30;
  const hit = 48;
  return (
    <View
      onStartShouldSetResponder={() => true}
      onStartShouldSetResponderCapture={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e: GestureResponderEvent) => {
        last.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      }}
      onResponderMove={(e: GestureResponderEvent) => {
        const { pageX, pageY } = e.nativeEvent;
        onMove(pageX - last.current.x, pageY - last.current.y);
        last.current = { x: pageX, y: pageY };
      }}
      style={[styles.hit, { left: x - hit / 2, top: y - hit / 2, width: hit, height: hit }]}
    >
      <View style={[styles.knob, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.glyph}>{glyph}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  knob: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  glyph: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
