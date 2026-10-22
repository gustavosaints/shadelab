import { useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { dampen, isHorizontalSwipe, swipeAction } from '@/lib/swipe';
import { colors, fonts, radius } from '@/theme';

type Props = {
  children: ReactNode;
  enabled?: boolean;
  /** Arrastou para a direita: enviar. */
  onSend: () => void;
  /** Arrastou para a esquerda: excluir. Devolve true se excluiu (a linha some), false se a pessoa desistiu. */
  onDelete: () => Promise<boolean>;
  /** Avisam a lista para travar a rolagem enquanto arrasta. */
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
};

/**
 * Linha de caso com arrasto (pedido do Gustavo, 2026-10-22): para a direita aparece "Enviar" (verde), para a
 * esquerda "Excluir" (vermelho). Responder do próprio View (convenção do projeto): o gesto só é tomado quando é
 * claramente horizontal, assim a rolagem da lista e o toque na linha continuam funcionando.
 */
export function SwipeRow({ children, enabled = true, onSend, onDelete, onSwipeStart, onSwipeEnd }: Props) {
  const [tx] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(0);
  // posição do toque e deslocamento atual (só lidos nos eventos do gesto)
  const start = useRef<{ x: number; y: number } | null>(null);
  const dx = useRef(0);

  const springBack = () => Animated.spring(tx, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();

  const begin = (e: GestureResponderEvent) => {
    start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    return false; // só marca o início; quem decide é o move
  };
  const wantsMove = (e: GestureResponderEvent) => {
    if (!enabled || !start.current) return false;
    return isHorizontalSwipe(e.nativeEvent.pageX - start.current.x, e.nativeEvent.pageY - start.current.y);
  };
  const grant = () => onSwipeStart?.();
  const move = (e: GestureResponderEvent) => {
    if (!start.current) return;
    const d = dampen(e.nativeEvent.pageX - start.current.x, width);
    tx.setValue(d);
    dx.current = d;
  };
  const release = async () => {
    onSwipeEnd?.();
    const action = swipeAction(dx.current, width);
    start.current = null;
    dx.current = 0;
    if (action === 'send') {
      springBack();
      onSend();
    } else if (action === 'delete') {
      Animated.timing(tx, { toValue: -width, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      const removed = await onDelete();
      if (!removed) springBack();
    } else springBack();
  };

  const sendOpacity = tx.interpolate({ inputRange: [0, 24], outputRange: [0, 1], extrapolate: 'clamp' });
  const deleteOpacity = tx.interpolate({ inputRange: [-24, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponderCapture={begin}
      onMoveShouldSetResponderCapture={wantsMove}
      onResponderGrant={grant}
      onResponderMove={move}
      onResponderRelease={release}
      onResponderTerminate={release}
      onResponderTerminationRequest={() => false}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.under, styles.send, { opacity: sendOpacity }]}>
        <Text style={styles.underText}>Enviar  ›</Text>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.under, styles.delete, { opacity: deleteOpacity }]}>
        <Text style={styles.underText}>‹  Excluir</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: tx }] }}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10, borderRadius: radius.md, overflow: 'hidden' },
  under: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, borderRadius: radius.md },
  send: { backgroundColor: colors.accent, justifyContent: 'flex-start' },
  delete: { backgroundColor: colors.danger, justifyContent: 'flex-end' },
  underText: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 16 },
});
