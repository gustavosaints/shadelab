import { Image, StyleSheet, View } from 'react-native';
import { layoutAnatomy, Z_ORDER, type AnatomyDef } from '@/lib/smile/anatomy';
import type { SmileParams } from '@/lib/smile/teeth';

type Props = { params: SmileParams; anatomy: AnatomyDef; width: number; height: number };

/**
 * Seis anteriores com sprites de anatomia real, desenhados com imagens nativas
 * (funciona no Expo Go em iOS e Android). Por dente, três imagens esticadas na
 * mesma caixa: silhueta tingida pela cor-alvo (`tintColor`), sombra e brilho.
 * Dentes 21–23 são o espelho dos sprites; a rotação do ajuste individual gira a
 * caixa em torno do centro. O recorte pela boca é feito fora, pelo SmileOverlay.
 */
export function AnatomyLayer({ params, anatomy, width, height }: Props) {
  const teeth = layoutAnatomy(params, anatomy, width, height).sort((a, b) => Z_ORDER[a.kind] - Z_ORDER[b.kind]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {teeth.map((t) => {
        const transform: ({ rotate: string } | { scaleX: number })[] = [];
        if (t.rot) transform.push({ rotate: `${t.rot}deg` });
        if (t.side === 'left') transform.push({ scaleX: -1 });
        return (
          <View
            key={t.fdi}
            style={{
              position: 'absolute',
              left: t.x,
              top: t.y,
              width: t.w,
              height: t.h,
              opacity: params.opacity,
              transform: transform.length ? transform : undefined,
            }}
          >
            <Image source={t.tooth.fill} style={[StyleSheet.absoluteFill, { tintColor: params.tint }]} resizeMode="stretch" />
            <Image source={t.tooth.shade} style={StyleSheet.absoluteFill} resizeMode="stretch" />
            <Image source={t.tooth.gloss} style={StyleSheet.absoluteFill} resizeMode="stretch" />
          </View>
        );
      })}
    </View>
  );
}
