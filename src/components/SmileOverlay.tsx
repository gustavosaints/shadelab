import MaskedView from '@react-native-masked-view/masked-view';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { AnatomyLayer } from '@/components/AnatomyOverlay';
import { layoutAnatomy, type AnatomyDef } from '@/lib/smile/anatomy';
import { mouthPath } from '@/lib/smile/mouth';
import { toothShading } from '@/lib/smile/shading';
import { layoutTeeth, type SmileParams } from '@/lib/smile/teeth';

type Props = {
  params: SmileParams;
  width: number;
  height: number;
  hidden?: boolean;
  anatomy?: AnatomyDef;
  /** FDI do dente selecionado para edição individual (desenha a caixa). */
  selected?: string;
};

/**
 * Desenha os seis anteriores sobre a foto, na área de `width` x `height` pixels.
 * Com `anatomy`, usa os sprites renderizados dos STLs (imagens nativas, recortadas pela
 * boca com MaskedView); sem, os contornos SVG (recortados com ClipPath). Se
 * `params.mouth` existir, tudo fica dentro do contorno da boca.
 */
export function SmileOverlay({ params, width, height, hidden, anatomy, selected }: Props) {
  if (hidden || width <= 0 || height <= 0) return null;
  const clip = params.mouth && params.mouth.length >= 3 ? mouthPath(params.mouth, width, height) : null;

  if (anatomy) {
    const layer = <AnatomyLayer params={params} anatomy={anatomy} width={width} height={height} />;
    const sel = selected ? layoutAnatomy(params, anatomy, width, height).find((t) => t.fdi === selected) : undefined;
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {clip && Platform.OS !== 'web' ? (
          <MaskedView
            style={StyleSheet.absoluteFill}
            maskElement={
              <Svg width={width} height={height}>
                <Path d={clip} fill="#000" />
              </Svg>
            }
          >
            {layer}
          </MaskedView>
        ) : (
          layer
        )}
        {sel && (
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Rect
              x={sel.x}
              y={sel.y}
              width={sel.w}
              height={sel.h}
              fill="none"
              stroke="#00E5FF"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              transform={sel.rot ? `rotate(${sel.rot.toFixed(2)} ${(sel.x + sel.w / 2).toFixed(2)} ${(sel.y + sel.h / 2).toFixed(2)})` : undefined}
            />
          </Svg>
        )}
      </View>
    );
  }

  return (
    <Svg width={width} height={height} pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
      {clip && (
        <Defs>
          <ClipPath id="mouth">
            <Path d={clip} />
          </ClipPath>
        </Defs>
      )}
      <G clipPath={clip ? 'url(#mouth)' : undefined}>
        <ContourTeeth params={params} width={width} height={height} selected={selected} />
      </G>
    </Svg>
  );
}

const rotateOf = (t: { x: number; y: number; w: number; h: number; rot: number }) =>
  t.rot ? `rotate(${t.rot.toFixed(2)} ${(t.x + t.w / 2).toFixed(2)} ${(t.y + t.h / 2).toFixed(2)})` : undefined;

/** Modo contorno: formas paramétricas com gradientes derivados da cor-alvo. */
function ContourTeeth({ params, width, height, selected }: { params: SmileParams; width: number; height: number; selected?: string }) {
  const teeth = layoutTeeth(params, width, height);
  return (
    <>
      <Defs>
        {teeth.map((t) => {
          const s = toothShading(params.tint, params.opacity, t);
          return [
            <LinearGradient key={`${t.fdi}-b`} id={`body-${t.fdi}`} x1="0" y1={t.y} x2="0" y2={t.y + t.h} gradientUnits="userSpaceOnUse">
              {s.body.map((st, i) => (
                <Stop key={i} offset={st.offset} stopColor={st.color} stopOpacity={st.opacity} />
              ))}
            </LinearGradient>,
            <LinearGradient key={`${t.fdi}-s`} id={`side-${t.fdi}`} x1={t.x} y1="0" x2={t.x + t.w} y2="0" gradientUnits="userSpaceOnUse">
              {s.sides.map((st, i) => (
                <Stop key={i} offset={st.offset} stopColor={st.color} stopOpacity={st.opacity} />
              ))}
            </LinearGradient>,
            <RadialGradient key={`${t.fdi}-h`} id={`hl-${t.fdi}`} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55 * params.opacity} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>,
          ];
        })}
      </Defs>
      {teeth.map((t) => {
        const s = toothShading(params.tint, params.opacity, t);
        return (
          <G key={t.fdi} transform={rotateOf(t)}>
            <Path d={t.d} fill={`url(#body-${t.fdi})`} />
            <Path d={t.d} fill={`url(#side-${t.fdi})`} />
            <Path d={t.d} fill="none" stroke={s.stroke.color} strokeOpacity={s.stroke.opacity} strokeWidth={s.stroke.width} />
            <Ellipse cx={s.highlight.cx} cy={s.highlight.cy} rx={s.highlight.rx} ry={s.highlight.ry} fill={`url(#hl-${t.fdi})`} />
            {selected === t.fdi && (
              <Rect x={t.x} y={t.y} width={t.w} height={t.h} fill="none" stroke="#00E5FF" strokeWidth={1.5} strokeDasharray="4 3" />
            )}
          </G>
        );
      })}
    </>
  );
}
