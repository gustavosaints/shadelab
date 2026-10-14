import Svg, { Path } from 'react-native-svg';
import { layoutTeeth, type SmileParams } from '@/lib/smile/teeth';

type Props = { params: SmileParams; width: number; height: number; hidden?: boolean };

/** Desenha os seis anteriores sobre a foto, na área de `width` x `height` pixels. */
export function SmileOverlay({ params, width, height, hidden }: Props) {
  if (hidden || width <= 0 || height <= 0) return null;
  const teeth = layoutTeeth(params, width, height);
  return (
    <Svg width={width} height={height} pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
      {teeth.map((t) => (
        <Path
          key={t.fdi}
          d={t.d}
          fill={params.tint}
          fillOpacity={params.opacity}
          stroke="rgba(255,255,255,0.75)"
          strokeWidth={1}
          strokeOpacity={Math.min(1, params.opacity + 0.15)}
        />
      ))}
      {/* brilho suave no terço médio de cada dente */}
      {teeth.map((t) => (
        <Path
          key={`${t.fdi}-hl`}
          d={`M ${t.x + t.w * 0.3} ${t.y + t.h * 0.3} Q ${t.x + t.w * 0.5} ${t.y + t.h * 0.22} ${t.x + t.w * 0.7} ${t.y + t.h * 0.3} Q ${t.x + t.w * 0.5} ${t.y + t.h * 0.5} ${t.x + t.w * 0.3} ${t.y + t.h * 0.3} Z`}
          fill="#FFFFFF"
          fillOpacity={0.18 * params.opacity}
        />
      ))}
    </Svg>
  );
}
