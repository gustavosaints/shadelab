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
            <Image source={t.tooth.fill} style={[styles.layer, { tintColor: params.tint }]} resizeMode="stretch" />
            <Image source={t.tooth.shade} style={styles.layer} resizeMode="stretch" />
            <Image source={t.tooth.gloss} style={styles.layer} resizeMode="stretch" />
          </View>
        );
      })}
    </View>
  );
}

/**
 * IMPORTANTE: `StyleSheet.absoluteFill` sozinho NÃO basta aqui. Para assets locais (`require`), o `Image` do
 * React Native põe a largura/altura ORIGINAL do PNG no estilo antes do nosso, e largura explícita vence
 * `left/right` no Yoga: cada dente era desenhado com 251 pt de largura (um central cobria a boca inteira,
 * 2026-10-15). Com `width/height: 100%` a imagem segue a caixa do dente.
 */
const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
});
