import { Defs, G, Image, Mask, Rect } from 'react-native-svg';
import { layoutAnatomy, Z_ORDER, type AnatomyDef } from '@/lib/smile/anatomy';
import type { SmileParams } from '@/lib/smile/teeth';

type Props = { params: SmileParams; anatomy: AnatomyDef; width: number; height: number };

/**
 * Seis anteriores com sprites de anatomia real, como fragmento SVG (para serem
 * recortados pelo contorno da boca junto com o resto do overlay). Por dente:
 * silhueta (máscara de luminância do PNG branco) preenchida com a cor-alvo,
 * depois sombra e brilho como imagens. Dentes 21–23 são o espelho dos sprites.
 */
export function AnatomyTeeth({ params, anatomy, width, height }: Props) {
  const teeth = layoutAnatomy(params, anatomy, width, height).sort((a, b) => Z_ORDER[a.kind] - Z_ORDER[b.kind]);
  return (
    <>
      <Defs>
        {teeth.map((t) => (
          <Mask key={`m-${t.fdi}`} id={`fill-${t.fdi}`} x={t.x} y={t.y} width={t.w} height={t.h} maskUnits="userSpaceOnUse">
            <Image href={t.tooth.fill} x={t.x} y={t.y} width={t.w} height={t.h} preserveAspectRatio="none" />
          </Mask>
        ))}
      </Defs>
      <G opacity={params.opacity}>
        {teeth.map((t) => {
          const mirror = t.side === 'left' ? `translate(${(2 * (t.x + t.w / 2)).toFixed(2)} 0) scale(-1 1)` : undefined;
          return (
            <G key={t.fdi} transform={mirror}>
              <Rect x={t.x} y={t.y} width={t.w} height={t.h} fill={params.tint} mask={`url(#fill-${t.fdi})`} />
              <Image href={t.tooth.shade} x={t.x} y={t.y} width={t.w} height={t.h} preserveAspectRatio="none" />
              <Image href={t.tooth.gloss} x={t.x} y={t.y} width={t.w} height={t.h} preserveAspectRatio="none" />
            </G>
          );
        })}
      </G>
    </>
  );
}
