import { Image, StyleSheet, View } from 'react-native';
import { layoutAnatomy, Z_ORDER, type AnatomyDef } from '@/lib/smile/anatomy';
import type { SmileParams } from '@/lib/smile/teeth';

type Props = { params: SmileParams; anatomy: AnatomyDef; width: number; height: number };

/**
 * Desenha os seis anteriores com sprites de anatomia real. Cada dente são três
 * imagens esticadas na mesma caixa: silhueta tingida pela cor-alvo, sombra e brilho.
 * Os dentes do lado esquerdo do paciente são o espelho dos sprites.
 */
export function AnatomyOverlay({ params, anatomy, width, height }: Props) {
  const teeth = layoutAnatomy(params, anatomy, width, height).sort((a, b) => Z_ORDER[a.kind] - Z_ORDER[b.kind]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {teeth.map((t) => (
        <View
          key={t.fdi}
          style={{
            position: 'absolute',
            left: t.x,
            top: t.y,
            width: t.w,
            height: t.h,
            opacity: params.opacity,
            transform: t.side === 'left' ? [{ scaleX: -1 }] : undefined,
          }}
        >
          <Image source={t.tooth.fill} style={[StyleSheet.absoluteFill, { tintColor: params.tint }]} resizeMode="stretch" />
          <Image source={t.tooth.shade} style={StyleSheet.absoluteFill} resizeMode="stretch" />
          <Image source={t.tooth.gloss} style={StyleSheet.absoluteFill} resizeMode="stretch" />
        </View>
      ))}
    </View>
  );
}
