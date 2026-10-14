import Svg, { Path } from 'react-native-svg';
import { Handle } from '@/components/Handle';
import { mouthPath } from '@/lib/smile/mouth';
import type { MouthPoint } from '@/lib/smile/teeth';

type Props = {
  mouth: MouthPoint[];
  width: number;
  height: number;
  onChange: (mouth: MouthPoint[]) => void;
  /** Só a linha, sem alças (ex.: na exportação). */
  readOnly?: boolean;
  /** Esconde também a linha (na exportação final). */
  hideLine?: boolean;
};

/** Contorno da boca com oito pontos arrastáveis: comissuras, lábio superior e inferior. */
export function MouthOutline({ mouth, width, height, onChange, readOnly, hideLine }: Props) {
  if (width <= 0 || height <= 0) return null;
  const move = (i: number) => (dx: number, dy: number) => {
    const next = mouth.map((p, k) =>
      k === i ? { x: Math.min(1, Math.max(0, p.x + dx / width)), y: Math.min(1, Math.max(0, p.y + dy / height)) } : p,
    );
    onChange(next);
  };
  return (
    <>
      {!hideLine && (
        <Svg width={width} height={height} pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
          <Path d={mouthPath(mouth, width, height)} stroke="#FF5252" strokeWidth={1.5} strokeDasharray="5 4" fill="none" />
        </Svg>
      )}
      {!readOnly &&
        mouth.map((p, i) => (
          <Handle
            key={i}
            x={p.x * width}
            y={p.y * height}
            glyph={i === 0 || i === 4 ? '◆' : '•'}
            size={18}
            color="#E53935"
            onMove={move(i)}
          />
        ))}
    </>
  );
}
