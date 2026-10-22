import { forwardRef, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { colors, radius } from '@/theme';

export type CompareMode = 'cortina' | 'transparencia';

type Props = {
  beforeUri: string;
  afterUri: string;
  /** largura / altura da foto */
  aspect: number;
  mode: CompareMode;
  /** Avisam a tela para travar a rolagem enquanto o dedo arrasta. */
  onDragStart?: () => void;
  onDragEnd?: () => void;
};

/**
 * Antes e depois sobre a mesma foto.
 * - Cortina: o DEPOIS ocupa a imagem e o ANTES aparece à esquerda da linha; arrastar em qualquer ponto da
 *   foto passa a linha de um lado para o outro.
 * - Transparência: o DEPOIS por cima do ANTES com opacidade ajustável na barra abaixo da foto (bom para
 *   ver o que mudou na gengiva, por exemplo numa plastia gengival).
 * O `ref` aponta para a área da foto (para capturar a imagem e compartilhar).
 */
export const BeforeAfter = forwardRef<View, Props>(function BeforeAfter({ beforeUri, afterUri, aspect, mode, onDragStart, onDragEnd }, ref) {
  const [width, setWidth] = useState(0);
  const [split, setSplit] = useState(0.5);
  const [opacity, setOpacity] = useState(1);
  const drag = useRef({ x: 0, value: 0 });
  const [trackW, setTrackW] = useState(0);

  const clamp = (v: number) => Math.min(1, Math.max(0, v));

  // ----- cortina: arrasto relativo na foto inteira -----
  const curtainGrant = (e: GestureResponderEvent) => {
    onDragStart?.();
    // toque direto: a linha vai para o dedo; depois acompanha o arrasto
    const v = width ? clamp(e.nativeEvent.locationX / width) : split;
    setSplit(v);
    drag.current = { x: e.nativeEvent.pageX, value: v };
  };
  const curtainMove = (e: GestureResponderEvent) => {
    if (!width) return;
    setSplit(clamp(drag.current.value + (e.nativeEvent.pageX - drag.current.x) / width));
  };

  // ----- transparência: barra abaixo da foto -----
  const barGrant = (e: GestureResponderEvent) => {
    onDragStart?.();
    const v = trackW ? clamp(e.nativeEvent.locationX / trackW) : opacity;
    setOpacity(v);
    drag.current = { x: e.nativeEvent.pageX, value: v };
  };
  const barMove = (e: GestureResponderEvent) => {
    if (!trackW) return;
    setOpacity(clamp(drag.current.value + (e.nativeEvent.pageX - drag.current.x) / trackW));
  };

  const end = () => onDragEnd?.();
  const H = width / aspect;

  return (
    <View>
      <View
        ref={ref}
        collapsable={false}
        style={[styles.frame, { aspectRatio: aspect }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => mode === 'cortina'}
        onMoveShouldSetResponder={() => mode === 'cortina'}
        onResponderTerminationRequest={() => false}
        onResponderGrant={curtainGrant}
        onResponderMove={curtainMove}
        onResponderRelease={end}
        onResponderTerminate={end}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {mode === 'cortina' ? (
            <>
              <Image source={{ uri: afterUri }} style={styles.full} resizeMode="cover" />
              <View style={[styles.clip, { width: split * width }]}>
                <Image source={{ uri: beforeUri }} style={{ width, height: H }} resizeMode="cover" />
              </View>
              <View style={[styles.line, { left: split * width - 1 }]} />
              <View style={[styles.knob, { left: split * width - 18, top: H / 2 - 18 }]}>
                <Text style={styles.knobText}>⇔</Text>
              </View>
            </>
          ) : (
            <>
              <Image source={{ uri: beforeUri }} style={styles.full} resizeMode="cover" />
              <Image source={{ uri: afterUri }} style={[styles.full, { opacity }]} resizeMode="cover" />
            </>
          )}
          <View style={[styles.tag, { left: 8 }]}>
            <Text style={styles.tagText}>ANTES</Text>
          </View>
          <View style={[styles.tag, { right: 8 }]}>
            <Text style={styles.tagText}>DEPOIS</Text>
          </View>
        </View>
      </View>

      {mode === 'transparencia' && (
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>Antes</Text>
          <View
            style={styles.track}
            onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onResponderGrant={barGrant}
            onResponderMove={barMove}
            onResponderRelease={end}
            onResponderTerminate={end}
            hitSlop={{ top: 14, bottom: 14 }}
          >
            <View pointerEvents="none" style={[styles.fill, { width: opacity * trackW }]} />
            <View pointerEvents="none" style={[styles.thumb, { left: opacity * trackW - 12 }]} />
          </View>
          <Text style={styles.barLabel}>Depois</Text>
        </View>
      )}
      {mode === 'transparencia' && <Text style={styles.pct}>{`${Math.round(opacity * 100)}% do depois`}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { width: '100%', backgroundColor: '#000', borderRadius: radius.md, overflow: 'hidden' },
  full: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  clip: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  line: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#fff' },
  knob: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tag: { position: 'absolute', top: 8, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingHorizontal: 4 },
  barLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.border, justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4, backgroundColor: colors.primary },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: colors.primary,
    top: -8,
  },
  pct: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 6 },
});
