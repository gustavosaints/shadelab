import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { AnatomyOverlay } from '@/components/AnatomyOverlay';
import type { AnatomyDef } from '@/lib/smile/anatomy';
import { toothShading } from '@/lib/smile/shading';
import { layoutTeeth, type SmileParams } from '@/lib/smile/teeth';

type Props = { params: SmileParams; width: number; height: number; hidden?: boolean; anatomy?: AnatomyDef };

/**
 * Desenha os seis anteriores sobre a foto, na área de `width` x `height` pixels.
 * Com `anatomy`, usa os sprites renderizados dos STLs; sem, os contornos SVG.
 */
export function SmileOverlay({ params, width, height, hidden, anatomy }: Props) {
  if (hidden || width <= 0 || height <= 0) return null;
  if (anatomy) return <AnatomyOverlay params={params} anatomy={anatomy} width={width} height={height} />;
  const teeth = layoutTeeth(params, width, height);
  return (
    <Svg width={width} height={height} pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
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
        return [
          <Path key={`${t.fdi}-1`} d={t.d} fill={`url(#body-${t.fdi})`} />,
          <Path key={`${t.fdi}-2`} d={t.d} fill={`url(#side-${t.fdi})`} />,
          <Path key={`${t.fdi}-3`} d={t.d} fill="none" stroke={s.stroke.color} strokeOpacity={s.stroke.opacity} strokeWidth={s.stroke.width} />,
        ];
      })}
      {/* reflexos por cima, recortados pela forma do dente via opacidade suave */}
      {teeth.map((t) => {
        const s = toothShading(params.tint, params.opacity, t);
        return (
          <Ellipse
            key={`${t.fdi}-hl`}
            cx={s.highlight.cx}
            cy={s.highlight.cy}
            rx={s.highlight.rx}
            ry={s.highlight.ry}
            fill={`url(#hl-${t.fdi})`}
          />
        );
      })}
    </Svg>
  );
}
