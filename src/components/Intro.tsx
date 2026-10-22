import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Logo } from '@/components/Logo';
import { colors } from '@/theme';

/** Abertura: a logomarca aparece suave sobre o fundo pérola e some; depois vem o login. */
export function Intro({ onDone, ready }: { onDone: () => void; ready: boolean }) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [opacity]);

  // só sai quando as fontes e o acesso estiverem prontos, e depois de a logo ficar visível um instante
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 450, useNativeDriver: true }).start(() => onDone());
    }, 1300);
    return () => clearTimeout(t);
  }, [ready, fade, onDone]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents="none">
      <Animated.View style={{ opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
        <Logo size={64} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', zIndex: 30 },
});
