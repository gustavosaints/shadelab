import { useRef, useState } from 'react';
import { Image, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { mouthCrop, mouthPath } from '@/lib/smile/mouth';
import type { MouthPoint } from '@/lib/smile/teeth';
import { fonts, radius } from '@/theme';

type Photo = { uri: string; width: number; height: number };

type Props = {
  photo: Photo;
  /** Altura da vista (px); a largura é a do pai. */
  height: number;
  mouth: MouthPoint[];
  onChange: (mouth: MouthPoint[]) => void;
  /** Avisam a tela para travar a rolagem enquanto arrasta um ponto. */
  onDragStart?: () => void;
  onDragEnd?: () => void;
};

const GLOW = '#F3C9BE';
const HIT = 44;
const LABELS = ['C', 'S', 'S', 'S', 'C', 'I', 'I', 'I'];

/**
 * Delimitar a boca à mão (volta do módulo antigo, pedido do Gustavo em 2026-10-22, para fotos em que o detector
 * automático não acha o rosto — sorriso fotografado de perto): 8 pontos na borda dos lábios (C = cantos,
 * S = lábio superior, I = lábio inferior). A vista se aproxima da boca a cada ponto solto, para dar precisão.
 */
export function MouthEditor({ photo, height, mouth, onChange, onDragStart, onDragEnd }: Props) {
  const [width, setWidth] = useState(0);
  // o recorte só acompanha o contorno quando solta o ponto (senão a vista "fugiria" do dedo)
  const [focus, setFocus] = useState(mouth);
  const drag = useRef<{ i: number; x: number; y: number } | null>(null);

  const crop = mouthCrop(focus, photo.width, photo.height, width && height ? width / height : 2);
  const s = width / crop.w;
  const toView = (p: MouthPoint) => ({ x: (p.x * photo.width - crop.x) * s, y: (p.y * photo.height - crop.y) * s });
  const pts = mouth.map(toView);

  const grant = (i: number) => (e: GestureResponderEvent) => {
    drag.current = { i, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    onDragStart?.();
  };
  const move = (e: GestureResponderEvent) => {
    const d = drag.current;
    if (!d || !s) return;
    const dx = (e.nativeEvent.pageX - d.x) / s / photo.width;
    const dy = (e.nativeEvent.pageY - d.y) / s / photo.height;
    drag.current = { ...d, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    const c = (v: number) => Math.min(1, Math.max(0, v));
    onChange(mouth.map((p, k) => (k === d.i ? { x: c(p.x + dx), y: c(p.y + dy) } : p)));
  };
  const release = () => {
    drag.current = null;
    onDragEnd?.();
    setFocus(mouth);
  };

  return (
    <View style={[styles.box, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <>
          <Image
            source={{ uri: photo.uri }}
            style={{ position: 'absolute', left: -crop.x * s, top: -crop.y * s, width: photo.width * s, height: photo.height * s }}
            resizeMode="cover"
          />
          <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Path
              d={mouthPath(
                pts.map((p) => ({ x: p.x / width, y: p.y / height })),
                width,
                height,
              )}
              fill="rgba(243,201,190,0.12)"
              stroke={GLOW}
              strokeWidth={2}
            />
          </Svg>
          {pts.map((p, i) => (
            <View
              key={i}
              style={[styles.hit, { left: p.x - HIT / 2, top: p.y - HIT / 2 }]}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}
              onResponderGrant={grant(i)}
              onResponderMove={move}
              onResponderRelease={release}
              onResponderTerminate={release}
              accessibilityLabel={`Ponto ${i + 1} do contorno da boca`}
            >
              <View style={[styles.dot, (i === 0 || i === 4) && styles.dotCorner]}>
                <Text style={styles.dotText}>{LABELS[i]}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000' },
  hit: { position: 'absolute', width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(31,34,43,0.75)',
    borderWidth: 2,
    borderColor: GLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCorner: { borderColor: '#FFFFFF' },
  dotText: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 9 },
});
