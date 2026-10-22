import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { fonts } from '@/theme';

/**
 * Animação da leitura de cor (pedido do Gustavo, inspirada na varredura do "Gerar HD" do SmileCloud): cartão escuro
 * no meio da tela com o contorno de um incisivo, grade de pontos, uma faixa de luz que varre o dente e os terços que
 * acendem quando ela passa. Quando chega o resultado, o dente se pinta com a cor medida e mostra o tab; depois fecha.
 * Fica pelo menos `MIN_SCAN_MS` na tela para o efeito ser visto (menos com "Reduzir movimento"). Toque pula.
 */
const MIN_SCAN_MS = 2000;
const REVEAL_MS = 1100;

// incisivo central superior (colo em cima) no viewBox 132×168
const VB_W = 132;
const VB_H = 168;
const TOOTH = 'M34 8 Q66 -2 98 8 C114 40 122 100 120 140 Q119 158 104 160 L28 160 Q13 158 12 140 C10 100 18 40 34 8 Z';
const TW = 112;
const TH = Math.round((TW * VB_H) / VB_W);
const RING = 214;
const BAND = 46; // altura da faixa de luz (viewBox)
const THIRDS = ['Cervical', 'Médio', 'Incisal'];
const GLOW = '#F3C9BE';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const DOTS: { x: number; y: number }[] = [];
for (let y = 10; y < VB_H; y += 11) for (let x = 10; x < VB_W; x += 11) DOTS.push({ x, y });

type Props = {
  visible: boolean;
  /** Nome da escala, para a legenda ("Comparando com a VITA 3D-Master"). */
  systemName: string;
  /** Resultado pronto: tab mais provável e a cor medida (hex). Enquanto não vem, a varredura continua. */
  result?: { id: string; hex: string };
  onDone: () => void;
};

export function ShadeScan({ visible, systemName, result, onDone }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDone}>
      {visible && <ScanCard systemName={systemName} result={result} onDone={onDone} />}
    </Modal>
  );
}

function ScanCard({ systemName, result, onDone }: Omit<Props, 'visible'>) {
  const [scan] = useState(() => new Animated.Value(0)); // 0 = colo, 1 = incisal
  const [spin] = useState(() => new Animated.Value(0));
  const [fill] = useState(() => new Animated.Value(0));
  const [minDone, setMinDone] = useState(false);
  const [step, setStep] = useState(0);
  const revealing = minDone && !!result;

  useEffect(() => {
    const sweep = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, { toValue: 1, duration: 1050, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(scan, { toValue: 0, duration: 1050, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    const turn = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }));
    sweep.start();
    turn.start();
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (alive) timer = setTimeout(() => setMinDone(true), reduce ? 300 : MIN_SCAN_MS);
      });
    const caption = setInterval(() => setStep((s) => Math.min(s + 1, 2)), 700);
    return () => {
      alive = false;
      sweep.stop();
      turn.stop();
      if (timer) clearTimeout(timer);
      clearInterval(caption);
    };
  }, [scan, spin]);

  useEffect(() => {
    if (!revealing) return;
    Animated.timing(fill, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const t = setTimeout(onDone, REVEAL_MS);
    return () => clearTimeout(t);
  }, [revealing, fill, onDone]);

  const captions = ['Lendo os três terços do dente', 'Convertendo a cor para CIELAB', `Comparando com a ${systemName}`];
  const bandY = scan.interpolate({ inputRange: [0, 1], outputRange: [-BAND * 0.6, VB_H - BAND * 0.4] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  // cada terço acende quando a faixa passa por ele
  const thirdGlow = (i: number) =>
    scan.interpolate({ inputRange: [0, (i + 0.1) / 3, (i + 0.5) / 3, (i + 0.9) / 3, 1].map((v) => Math.min(1, Math.max(0, v))), outputRange: [0.35, 0.35, 1, 0.35, 0.35], extrapolate: 'clamp' });
  const ringScale = fill.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.05, 1] });

  return (
    <Pressable
      style={styles.backdrop}
      onPress={() => result && onDone()}
      accessibilityLabel={revealing ? `Cor mais provável ${result?.id}` : 'Analisando a cor do dente'}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.card}>
        <Text style={styles.kicker}>ANÁLISE DE COR</Text>
        <Animated.View style={[styles.stage, { transform: [{ scale: ringScale }] }]}>
          {/* anel girando */}
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
            <Svg width={RING} height={RING}>
              <Circle cx={RING / 2} cy={RING / 2} r={RING / 2 - 3} stroke="rgba(255,255,255,0.10)" strokeWidth={1} fill="none" />
              <Circle cx={RING / 2} cy={RING / 2} r={RING / 2 - 3} stroke={GLOW} strokeWidth={2} fill="none" strokeDasharray="70 600" strokeLinecap="round" />
              <Circle cx={RING / 2} cy={RING / 2} r={RING / 2 - 12} stroke="rgba(243,201,190,0.35)" strokeWidth={1} fill="none" strokeDasharray="2 7" />
            </Svg>
          </Animated.View>

          {/* dente com grade, linhas dos terços e a faixa de luz */}
          <View style={styles.tooth}>
            <Svg width={TW} height={TH} viewBox={`0 0 ${VB_W} ${VB_H}`}>
              <Defs>
                <ClipPath id="tooth">
                  <Path d={TOOTH} />
                </ClipPath>
                <LinearGradient id="band" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={GLOW} stopOpacity="0" />
                  <Stop offset="0.75" stopColor={GLOW} stopOpacity="0.45" />
                  <Stop offset="0.97" stopColor="#FFFFFF" stopOpacity="0.95" />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Path d={TOOTH} fill="rgba(255,255,255,0.04)" />
              <G clipPath="url(#tooth)">
                {DOTS.map((d) => (
                  <Circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r={0.9} fill="rgba(255,255,255,0.28)" />
                ))}
                <Line x1={0} x2={VB_W} y1={8 + (152 * 1) / 3} y2={8 + (152 * 1) / 3} stroke="rgba(255,255,255,0.25)" strokeWidth={0.8} strokeDasharray="3 4" />
                <Line x1={0} x2={VB_W} y1={8 + (152 * 2) / 3} y2={8 + (152 * 2) / 3} stroke="rgba(255,255,255,0.25)" strokeWidth={0.8} strokeDasharray="3 4" />
                {!revealing && <AnimatedRect x={0} y={bandY} width={VB_W} height={BAND} fill="url(#band)" />}
              </G>
              <Path d={TOOTH} fill="none" stroke={GLOW} strokeWidth={1.6} />
            </Svg>
            {/* cor medida enchendo o dente */}
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: fill }]} pointerEvents="none">
              <Svg width={TW} height={TH} viewBox={`0 0 ${VB_W} ${VB_H}`}>
                <Path d={TOOTH} fill={result?.hex ?? 'transparent'} stroke="#FFFFFF" strokeWidth={1.6} />
              </Svg>
            </Animated.View>
          </View>

          {/* rótulos dos terços, à direita do dente */}
          {!revealing &&
            THIRDS.map((t, i) => (
              <Animated.View key={t} style={[styles.thirdTag, { top: (RING - TH) / 2 + ((8 + 152 * ((i + 0.5) / 3)) / VB_H) * TH - 7, opacity: thirdGlow(i) }]}>
                <View style={styles.thirdDot} />
                <Text style={styles.thirdText}>{t.toUpperCase()}</Text>
              </Animated.View>
            ))}
        </Animated.View>

        {revealing ? (
          <>
            <Text style={styles.resultId}>{result?.id}</Text>
            <Text style={styles.caption}>mais provável</Text>
          </>
        ) : (
          <>
            <View style={styles.dotsRow}>
              {captions.map((c, i) => (
                <View key={c} style={[styles.stepDot, i <= step && styles.stepDotOn]} />
              ))}
            </View>
            <Text style={styles.caption}>{captions[step]}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,32,40,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: 300,
    maxWidth: '100%',
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderRadius: 26,
    backgroundColor: '#1F222B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  kicker: { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.medium, fontSize: 11, letterSpacing: 3 },
  stage: { width: RING, height: RING, marginTop: 14, marginBottom: 6 },
  tooth: { position: 'absolute', left: (RING - TW) / 2, top: (RING - TH) / 2, width: TW, height: TH },
  thirdTag: { position: 'absolute', left: (RING + TW) / 2 + 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  thirdDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: GLOW },
  thirdText: { color: GLOW, fontFamily: fonts.medium, fontSize: 8, letterSpacing: 1.2 },
  dotsRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  stepDotOn: { backgroundColor: GLOW },
  caption: { color: 'rgba(255,255,255,0.82)', fontFamily: fonts.light, fontSize: 14, marginTop: 8, textAlign: 'center' },
  resultId: { color: '#FFFFFF', fontFamily: fonts.display, fontSize: 40, marginTop: 2, letterSpacing: 1 },
});
