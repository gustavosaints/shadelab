import MaskedView from '@react-native-masked-view/masked-view';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { libraryPlacement } from '@/lib/smile/library';
import { mouthBounds, mouthPath } from '@/lib/smile/mouth';
import type { SmileLibraryEntry } from '@/lib/smile/smileLibrary';
import type { SmileParams } from '@/lib/smile/teeth';

type Props = { params: SmileParams; entry: SmileLibraryEntry; width: number; height: number };

/** Intensidade da sombra do lábio superior sobre os dentes (0..1) e altura dela em fração da boca. */
const LIP_SHADOW = 0.45;
const LIP_SHADOW_H = 0.3;

/**
 * Arco 2D da biblioteca (foto/render recortado) sobre a foto do paciente: imagem nativa com tamanho
 * EXPLÍCITO (nunca só absoluteFill — ver CLAUDE.md), tingida levemente pela cor-alvo, recortada pela boca
 * com MaskedView e com a sombra do lábio superior por cima.
 */
export function SmileLibraryLayer({ params, entry, width, height }: Props) {
  const box = libraryPlacement(params, entry, width, height);
  const clip = params.mouth && params.mouth.length >= 3 ? mouthPath(params.mouth, width, height) : null;
  const b = params.mouth && params.mouth.length >= 3 ? mouthBounds(params.mouth, width, height) : null;
  const layer = (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={entry.image} style={[styles.img, box, { opacity: params.opacity }]} resizeMode="stretch" />
      {/* tingimento suave na cor-alvo (mantém textura e brilho do render) */}
      <Image source={entry.image} style={[styles.img, box, { opacity: 0.35 * params.opacity, tintColor: params.tint }]} resizeMode="stretch" />
      {b && (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="lip" x1="0" y1={b.upperMidY} x2="0" y2={b.upperMidY + (b.lowerMidY - b.upperMidY) * LIP_SHADOW_H} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#2D0C0C" stopOpacity={LIP_SHADOW * params.opacity} />
              <Stop offset="1" stopColor="#2D0C0C" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#lip)" />
        </Svg>
      )}
    </View>
  );
  if (!clip || Platform.OS === 'web') return layer;
  return (
    <MaskedView
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      maskElement={
        <Svg width={width} height={height}>
          <Path d={clip} fill="#000" />
        </Svg>
      }
    >
      {layer}
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  img: { position: 'absolute' },
});
