/** Estilos de sorriso e montagem da instrução para o modelo de imagem (parte pura, testável). */
import { labToHex, type Lab } from '@/lib/color/convert';

export type SmileStyleId = 'natural' | 'hollywood' | 'youthful' | 'conservative' | 'aligned' | 'whitening';

export const SMILE_STYLES: { id: SmileStyleId; name: string; description: string; prompt: string }[] = [
  {
    id: 'natural',
    name: 'Natural',
    description: 'Dentes saudáveis e alinhados, com bordas suaves e pequenas variações naturais.',
    prompt:
      'natural, healthy, well-aligned teeth with softly rounded incisal edges, a gentle smile arc following the lower lip, and subtle individual character (not perfectly identical teeth)',
  },
  {
    id: 'hollywood',
    name: 'Hollywood',
    description: 'Sorriso amplo, dentes cheios e perfeitamente alinhados.',
    prompt: 'a Hollywood-style smile: perfectly aligned, fuller and slightly squarer anterior teeth, a broad arch, bright and uniform enamel',
  },
  {
    id: 'youthful',
    name: 'Jovem',
    description: 'Centrais um pouco mais longos, ameias arredondadas, curva do sorriso viva.',
    prompt: 'a youthful smile: slightly longer central incisors, rounded incisal embrasures, a lively smile arc, dominant centrals',
  },
  {
    id: 'conservative',
    name: 'Discreto',
    description: 'Mantém forma e alinhamento; só corrige lascas e uniformiza o esmalte.',
    prompt: 'minimal change: keep the current tooth shapes, sizes and alignment, only repair chips and worn edges and even out the enamel',
  },
  {
    id: 'aligned',
    name: 'Alinhado',
    description: 'Fecha espaços e corrige rotações, como um resultado ortodôntico.',
    prompt: 'orthodontically aligned teeth: close gaps, straighten rotated teeth, level the incisal edges, keeping the same tooth shapes and sizes',
  },
  {
    id: 'whitening',
    name: 'Clareamento',
    description: 'Mesmos dentes, só a cor muda para o tom escolhido.',
    prompt: 'the same teeth with the same shapes and alignment, only whitened to the target shade',
  },
];

/** Descreve a cor da escala em palavras para o modelo (que não entende Lab). */
export function describeShade(id: string, lab: Lab): string {
  const light = lab.L >= 80 ? 'very light' : lab.L >= 74 ? 'light' : lab.L >= 68 ? 'medium' : 'darker';
  const chroma = Math.hypot(lab.a, lab.b);
  const sat = chroma < 12 ? 'low-chroma, almost neutral' : chroma < 20 ? 'softly warm' : 'warm, more saturated';
  const hue = lab.a > 3 ? 'reddish-yellow (orange-ish)' : lab.b > 15 ? 'yellowish ivory' : lab.a < 0 ? 'greyish' : 'neutral ivory';
  return `VITA ${id}: ${light}, ${sat}, ${hue} tooth color, approximately sRGB ${labToHex(lab)} in the lit body of the tooth`;
}

/** Monta a instrução de edição. */
export function buildPrompt(style: SmileStyleId, shadeId: string, shadeLab: Lab): string {
  const s = SMILE_STYLES.find((x) => x.id === style) ?? SMILE_STYLES[0];
  return [
    'Edit this dental patient photo for a treatment simulation.',
    `Replace ONLY the visible teeth with ${s.prompt}.`,
    `Tooth shade: ${describeShade(shadeId, shadeLab)}. Slightly more saturated near the gums, slightly translucent at the incisal edges.`,
    'Keep absolutely everything else identical: face, skin, lips and lip line, gums, tongue, lighting, shadows, background, framing, camera angle and resolution.',
    'The new teeth must sit naturally under the lips and follow the lip line, with realistic enamel texture and reflections matching the scene light.',
    'Photorealistic. No text, no watermark, no other changes.',
  ].join(' ');
}
