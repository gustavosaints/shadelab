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
 * - Transparência: o DEPOIS por cima do ANTES com opacidade ajustável (bom para ver o que mudou na gengiva, por
 *   exemplo numa plastia gengival). A barra fica DENTRO da foto, embaixo: com a foto fixa no topo da tela, o que
 *   fica fora do quadro aparece mas não recebe toque no iPhone (era a barra "estática"). Tocar na barra leva a
 *   transparência para o ponto tocado; arrastar em qualquer lugar da foto ajusta para a esquerda/direita.
 * O `ref` aponta para a área da foto (para capturar a imagem e compartilhar).
 */
export const BeforeAfter = forwardRef<View, Props>(function BeforeAfter({ beforeUri, afterUri, aspect, mode, onDragStart, onDragEnd }, ref) {
  const [width, setWidth] = useState(0);
  const [split, setSplit] = useState(0.5);
  const [opacity, setOpacity] = useState(1);
  const drag = useRef({ x: 0, value: 0 });

  const clamp = (v: number) => Math.min(1, Math.max(0, v));

  const H = width / aspect;
  // barra da transparência (dentro da foto, embaixo)
  const BAR_PAD = 44;
  const trackW = Math.max(1, width - BAR_PAD * 2);
  const nearBar = (y: number) => y > H - 56;

  // ----- arrasto na foto: cortina move a linha; transparência muda a opacidade -----
  const grant = (e: GestureResponderEvent) => {
    onDragStart?.();
    const { locationX, locationY, pageX } = e.nativeEvent;
    if (mode === 'cortina') {
      // toque direto: a linha vai para o dedo; depois acompanha o arrasto
      const v = width ? clamp(locationX / width) : split;
      setSplit(v);
      drag.current = { x: pageX, value: v };
    } else {
      // na barra: vai para o ponto tocado; no resto da foto: só ajusta pelo arrasto
      const v = nearBar(locationY) ? clamp((locationX - BAR_PAD) / trackW) : opacity;
      setOpacity(v);
      drag.current = { x: pageX, value: v };
    }
  };
  const move = (e: GestureResponderEvent) => {
    if (!width) return;
    const dx = e.nativeEvent.pageX - drag.current.x;
    if (mode === 'cortina') setSplit(clamp(drag.current.value + dx / width));
    else setOpacity(clamp(drag.current.value + dx / trackW));
  };
  const end = () => onDragEnd?.();

  return (
    <View>
      <View
        ref={ref}
        collapsable={false}
        style={[styles.frame, { aspectRatio: aspect }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={grant}
        onResponderMove={move}
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
              <View style={styles.barWrap}>
                <Text style={styles.barLabel}>Antes</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: opacity * trackW }]} />
                  <View style={[styles.thumb, { left: opacity * trackW - 12 }]} />
                </View>
                <Text style={styles.barLabel}>Depois</Text>
              </View>
              <View style={styles.pctTag}>
                <Text style={styles.tagText}>{`${Math.round(opacity * 100)}% DEPOIS`}</Text>
              </View>
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
  barWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  barLabel: { width: 40, textAlign: 'center', color: '#fff', fontSize: 10, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.45)', justifyContent: 'center' },
  pctTag: { position: 'absolute', bottom: 50, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
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
});
