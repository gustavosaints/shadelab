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
  /** Vai junto a imagem 2 com o planejamento desenhado (`paintGuide`). */
  withGuide?: boolean;
};

/**
 * Alinhamento e diastemas (pedido do Gustavo, 2026-10-23: no 1º resultado os diastemas ficaram e o 21 saiu
 * torto). Vale sempre: o planejamento é de dentes alinhados e em contato.
 */
export const ALIGNMENT =
  'CLOSE ALL DIASTEMAS and spaces between the upper teeth: every tooth in tight contact with its neighbours, no dark gaps between teeth (only the natural small incisal embrasures). All upper teeth perfectly straight and aligned: no rotated, tilted, crooked, crowded or overlapping teeth. The central incisors (11 and 21) must be upright, symmetric mirror images of each other with parallel long axes, meeting exactly at the dental midline. Do NOT keep any of the original spacing, rotation or misalignment.';

/** Monta a instrução do Smile Design (uma linha, em inglês, que é como o modelo responde melhor). */
export function buildDesignPrompt(o: DesignOptions): string {
  const shape = TOOTH_SHAPES.find((s) => s.id === o.shape) ?? TOOTH_SHAPES[0];
  const texture = TEXTURES.find((t) => t.id === o.texture) ?? TEXTURES[1];
  const gum = GUM_OPTIONS.find((g) => g.id === o.gum) ?? GUM_OPTIONS[0];
  return [
    'Cosmetic dentistry smile makeover simulation on this patient photo (image 1).',
    // Com a imagem-guia, o tamanho vem dela: a instrução "transformação claramente visível" (2026-10-23, quando o
    // resultado era tímido) fazia dentes gigantes num sorriso baixo (2026-10-26).
    ...(o.withGuide
      ? [
          "Remove the patient's current visible upper teeth and replace ALL of them with brand-new, ideal ceramic veneers/crowns that follow the dentist's planning mock-up in image 2: change the shape, alignment, texture and color of the upper teeth as specified below, but take their size, length and position ONLY from the mock-up.",
          "Image 2 is the dentist's planning mock-up on the same photo: each flat colored shape is one new upper tooth (the faint lines only separate neighbouring teeth, which TOUCH each other). The new teeth must occupy EXACTLY those shapes (same outline, width, length, position and smile curve) and have that color. Turn the mock-up into photorealistic teeth; do NOT copy the flat fill or the lines into the result.",
          'The mock-up shows only the part of each tooth visible through the lip opening; the rest of each tooth stays HIDDEN behind the lips, exactly as in image 1. Do NOT lift, open, stretch or move the lips, do NOT show more tooth or gum than the mock-up shows, and do NOT make any tooth larger, longer or more prominent than its shape in image 2.',
        ]
      : [
          "Remove the patient's current visible upper teeth and replace ALL of them with brand-new, ideal ceramic veneers/crowns. This must be a CLEARLY VISIBLE transformation, like a real before-and-after of a full smile makeover, not a subtle retouch: change the shape, size, alignment and color of the upper teeth as specified below, even if the original teeth look very different.",
        ]),
    o.withGuide
      ? 'Smile goals: well-aligned teeth in a harmonious arch, correct width proportions (centrals > laterals > canines), dental midline aligned with the face, even incisal edges with natural embrasures; sizes and positions as in image 2.'
      : 'Smile goals: well-aligned teeth in a harmonious arch that follows the curve of the lower lip, dominant central incisors, correct width proportions (centrals > laterals > canines), dental midline aligned with the face, even incisal edges with natural embrasures.',
    ALIGNMENT,
    `Tooth shape: ${shape.prompt}.`,
    `Surface texture: ${texture.prompt}.`,
    `Tooth shade: ${describeShade(o.shadeId, o.shadeLab)}. Use this shade even if it is much lighter or different from the current teeth. Slightly more saturated near the gums, slightly translucent at the incisal edges.`,
    gum.prompt,
    ...(o.lengths ? [o.lengths] : []),
    'Keep everything that is not an upper tooth identical to image 1: face, skin, beard, lips and lip line, lower teeth, tongue, lighting, shadows, background, framing, camera angle and resolution.',
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
