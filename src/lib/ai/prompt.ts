/**
 * Smile Design por IA: opções que o dentista escolhe (forma, textura, cor da escala, gengiva) e a montagem da
 * instrução para o modelo de imagem (parte pura, testável). Formas: quadrado, arredondado e triangular (a
 * retangular saiu em 2026-10-22, a pedido do Gustavo; o id continua no tipo para abrir casos antigos).
 */
import { labToHex, type Lab } from '@/lib/color/convert';

export type ToothShapeId = 'retangular' | 'triangular' | 'arredondado' | 'quadrado';
export type TextureId = 'lisa' | 'natural' | 'caracterizada';
export type GumId = 'manter' | 'plastia';

export const TOOTH_SHAPES: { id: ToothShapeId; name: string; prompt: string; /** posição no contorno (0 quadrada … 1 triangular) */ mix: number }[] = [
  {
    id: 'quadrado',
    name: 'Quadrado',
    prompt: 'SQUARE teeth: width close to height, broad and flat incisal edges, square incisal angles and closed embrasures',
    mix: 0,
  },
  {
    id: 'arredondado',
    name: 'Arredondado',
    prompt: 'ROUNDED (oval) teeth: convex mesial and distal outlines, softly rounded incisal angles and gently open incisal embrasures',
    mix: 0.5,
  },
  {
    id: 'triangular',
    name: 'Triangular',
    prompt:
      'TRIANGULAR (tapered) teeth: wider at the incisal third and converging toward the gum line, pointed contact areas and more open incisal embrasures',
    mix: 1,
  },
];

export const TEXTURES: { id: TextureId; name: string; prompt: string }[] = [
  { id: 'lisa', name: 'Lisa', prompt: 'smooth, highly polished glossy enamel with minimal surface texture, like polished porcelain veneers' },
  {
    id: 'natural',
    name: 'Natural',
    prompt: 'natural enamel surface with subtle perikymata and soft vertical developmental grooves, satin gloss, like healthy young natural teeth',
  },
  {
    id: 'caracterizada',
    name: 'Caracterizada',
    prompt:
      'characterized natural teeth: visible surface texture, incisal translucency with a faint opalescent halo and a subtle mamelon effect, slightly more saturated cervical third',
  },
];

export const GUM_OPTIONS: { id: GumId; name: string; prompt: string }[] = [
  { id: 'manter', name: 'Manter gengiva', prompt: 'Keep the gums exactly as they are in the original photo (same margins and contour).' },
  {
    id: 'plastia',
    name: 'Plastia gengival',
    prompt:
      'Simulate a gingival contouring (gingivoplasty): harmonize the gingival margins of the upper teeth, symmetric zeniths, central incisors and canines at the same level and lateral incisors slightly lower, reduce excessive gum display; the clinical crowns become correspondingly longer. The gum must stay healthy, pink and natural.',
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

export type DesignOptions = {
  shape: ToothShapeId;
  texture: TextureId;
  gum: GumId;
  shadeId: string;
  shadeLab: Lab;
  /** Ajustes de comprimento já descritos (`describeLengths`), quando houver. */
  lengths?: string;
};

/** Monta a instrução do Smile Design (uma linha, em inglês, que é como o modelo responde melhor). */
export function buildDesignPrompt(o: DesignOptions): string {
  const shape = TOOTH_SHAPES.find((s) => s.id === o.shape) ?? TOOTH_SHAPES[0];
  const texture = TEXTURES.find((t) => t.id === o.texture) ?? TEXTURES[1];
  const gum = GUM_OPTIONS.find((g) => g.id === o.gum) ?? GUM_OPTIONS[0];
  return [
    'Dental smile design simulation on this patient photo.',
    'Replace ONLY the visible upper teeth with a new, aesthetically planned smile: well-aligned teeth in a harmonious arch that follows the curve of the lower lip, dominant central incisors, correct width proportions (centrals > laterals > canines), dental midline aligned with the face, no gaps, even incisal edges with natural embrasures.',
    `Tooth shape: ${shape.prompt}.`,
    `Surface texture: ${texture.prompt}.`,
    `Tooth shade: ${describeShade(o.shadeId, o.shadeLab)}. Slightly more saturated near the gums, slightly translucent at the incisal edges.`,
    gum.prompt,
    ...(o.lengths ? [o.lengths] : []),
    'Keep absolutely everything else identical to the original: face, skin, beard, lips and lip line, lower teeth, tongue, lighting, shadows, background, framing, camera angle and resolution.',
    'The new teeth must sit naturally under the upper lip with realistic reflections matching the scene light. Photorealistic. No text, no watermark, no other changes.',
  ].join(' ');
}

/** Resumo em português das opções, para o caso salvo e a tela. */
export function designSummary(o: Pick<DesignOptions, 'shape' | 'texture' | 'gum' | 'shadeId'>): string {
  const shape = TOOTH_SHAPES.find((s) => s.id === o.shape)?.name ?? (o.shape === 'retangular' ? 'Retangular' : o.shape);
  const texture = TEXTURES.find((t) => t.id === o.texture)?.name ?? o.texture;
  const gum = o.gum === 'plastia' ? ' · plastia gengival' : '';
  return `${shape} · textura ${texture.toLowerCase()} · ${o.shadeId}${gum}`;
}
