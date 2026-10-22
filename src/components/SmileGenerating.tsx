import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';
import { fonts, radius } from '@/theme';

/**
 * Espera da geração por IA no Smile Design, no mesmo estilo da leitura de cor (`ShadeScan`) e inspirada no
 * "Gerar HD / Revelar HD" do SmileCloud: sobre a foto do paciente, grade de pontos e uma faixa de luz varrendo; no
 * meio, um cartão com os seis dentes anteriores acendendo um a um, a etapa atual, barra de progresso e os segundos.
 * Quando chega o resultado, o sorriso novo é revelado por uma varredura da esquerda para a direita e o `onDone` é
 * chamado (aí a tela mostra o antes e depois).
 */
const GLOW = '#F3C9BE';
const STEP_MS = 4500;
const EXPECTED_MS = 28000; // a barra anda até ~92 % nesse tempo e espera o resultado
const REVEAL_MS = 1100;

// seis dentes anteriores (13 → 23) no viewBox 150×56: largura, altura e topo seguindo a curva do sorriso
const TEETH = [
  { w: 17, h: 30, y: 8 },
  { w: 20, h: 33, y: 11 },
  { w: 25, h: 40, y: 12 },
  { w: 25, h: 40, y: 12 },
  { w: 20, h: 33, y: 11 },
  { w: 17, h: 30, y: 8 },
];
const GAP = 3;
const TEETH_X = (() => {
  const total = TEETH.reduce((s, t) => s + t.w, 0) + GAP * (TEETH.length - 1);
  let x = (150 - total) / 2;
  return TEETH.map((t) => {
    const at = x;
    x += t.w + GAP;
    return at;
  });
})();

const AnimatedRect = Animated.createAnimatedComponent(Rect);

type Props = {
  photoUri: string;
  /** Legendas das etapas, na ordem (a última fica até o resultado chegar). */
  steps: string[];
  /** Imagem gerada: dispara a revelação. */
  resultUri?: string;
  onDone: () => void;
};

export function SmileGenerating({ photoUri, steps, resultUri, onDone }: Props) {
  // ocupa a caixa da foto inteira (o pai define o tamanho); a imagem cobre a caixa
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const [sweep] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));
  const [reveal] = useState(() => new Animated.Value(0));
  const [elapsed, setElapsed] = useState(0);
  const revealing = !!resultUri;

  useEffect(() => {
    const loops = [
      Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true })),
      Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: false })),
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true })),
    ];
    loops.forEach((l) => l.start());
    Animated.timing(progress, { toValue: 0.92, duration: EXPECTED_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    const clock = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      loops.forEach((l) => l.stop());
      clearInterval(clock);
    };
  }, [sweep, pulse, spin, progress]);

  useEffect(() => {
    if (!revealing) return;
    let alive = true;
    Animated.timing(progress, { toValue: 1, duration: 250, useNativeDriver: false }).start();
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!alive) return;
        Animated.timing(reveal, { toValue: 1, duration: reduce ? 1 : REVEAL_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
          if (finished && alive) onDone();
        });
      });
    return () => {
      alive = false;
    };
  }, [revealing, progress, reveal, onDone]);

  const step = Math.min(steps.length - 1, Math.floor((elapsed * 1000) / STEP_MS));
  const bandX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-110, Math.max(width, 1)] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const revealW = reveal.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(width, 1)] });
  const hudOpacity = reveal.interpolate({ inputRange: [0, 0.35], outputRange: [1, 0], extrapolate: 'clamp' });
  // cada dente acende quando a "onda" passa por ele
  const toothGlow = (i: number) => {
    const c = (i + 0.5) / TEETH.length;
    return pulse.interpolate({ inputRange: [0, Math.max(0, c - 0.16), c, Math.min(1, c + 0.16), 1], outputRange: [0.08, 0.08, 0.85, 0.08, 0.08] });
  };

  return (
    <View
      style={styles.root}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      accessibilityLiveRegion="polite"
      accessibilityLabel={revealing ? 'Smile Design pronto' : `Gerando o Smile Design: ${steps[step]}`}
    >
      {width > 0 && (
        <>
          <Image source={{ uri: photoUri }} style={{ position: 'absolute', left: 0, top: 0, width, height }} resizeMode="cover" />
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: hudOpacity }]} pointerEvents="none">
            <View style={[StyleSheet.absoluteFill, styles.tint]} />
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
              <Defs>
                <Pattern id="dots" width={14} height={14} patternUnits="userSpaceOnUse">
                  <Circle cx={7} cy={7} r={0.9} fill="rgba(255,255,255,0.28)" />
                </Pattern>
              </Defs>
              <Rect x={0} y={0} width={width} height={height} fill="url(#dots)" />
            </Svg>
            <Animated.View style={[styles.band, { height, transform: [{ translateX: bandX }] }]}>
              <Svg width={110} height={height}>
                <Defs>
                  <LinearGradient id="band" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={GLOW} stopOpacity="0" />
                    <Stop offset="0.8" stopColor={GLOW} stopOpacity="0.3" />
                    <Stop offset="0.97" stopColor="#FFFFFF" stopOpacity="0.9" />
                    <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={110} height={height} fill="url(#band)" />
              </Svg>
            </Animated.View>
          </Animated.View>

          {/* revelação: o sorriso gerado entra da esquerda para a direita, com a borda iluminada */}
          {revealing && (
            <Animated.View style={[styles.revealClip, { width: revealW, height }]} pointerEvents="none">
              <Image source={{ uri: resultUri }} style={{ width, height }} resizeMode="cover" />
              <View style={styles.revealEdge} />
            </Animated.View>
          )}

          <Animated.View style={[StyleSheet.absoluteFill, styles.center, { opacity: hudOpacity }]} pointerEvents="none">
            <View style={styles.card}>
              <View style={styles.kickerRow}>
                <Animated.View style={{ transform: [{ rotate }] }}>
                  <Svg width={14} height={14}>
                    <Circle cx={7} cy={7} r={5.5} stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} fill="none" />
                    <Circle cx={7} cy={7} r={5.5} stroke={GLOW} strokeWidth={1.5} fill="none" strokeDasharray="9 40" strokeLinecap="round" />
                  </Svg>
                </Animated.View>
                <Text style={styles.kicker}>SMILE DESIGN · IA</Text>
              </View>
              <Svg width={150} height={56} viewBox="0 0 150 56" style={{ marginTop: 10 }}>
                {TEETH.map((t, i) => (
                  <AnimatedRect key={i} x={TEETH_X[i]} y={t.y} width={t.w} height={t.h} rx={7} fill={GLOW} fillOpacity={toothGlow(i)} stroke={GLOW} strokeWidth={1.2} />
                ))}
              </Svg>
              <Text style={styles.caption} numberOfLines={2}>
                {steps[step]}
              </Text>
              <View style={styles.bar}>
                <Animated.View style={[styles.barFill, { width: barWidth }]} />
              </View>
              <Text style={styles.time}>{`${elapsed} s · costuma levar 15 a 30 s`}</Text>
            </View>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000' },
  tint: { backgroundColor: 'rgba(22,24,32,0.5)' },
  band: { position: 'absolute', left: 0, top: 0, width: 110 },
  revealClip: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  revealEdge: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, backgroundColor: '#FFFFFF', shadowColor: GLOW, shadowOpacity: 1, shadowRadius: 8 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    width: 236,
    maxWidth: '100%',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(31,34,43,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.medium, fontSize: 10, letterSpacing: 2.5 },
  caption: { color: 'rgba(255,255,255,0.88)', fontFamily: fonts.light, fontSize: 14, marginTop: 10, textAlign: 'center', minHeight: 38 },
  bar: { alignSelf: 'stretch', height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 8, overflow: 'hidden' },
  barFill: { height: 3, borderRadius: 2, backgroundColor: GLOW },
  time: { color: 'rgba(255,255,255,0.45)', fontFamily: fonts.regular, fontSize: 11, marginTop: 8 },
});
