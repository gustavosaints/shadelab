import { hexToRgb, labToHex, rgbToLab } from '@/lib/color/convert';
import type { ToothPlacement } from './teeth';

export type Stop = { offset: number; color: string; opacity: number };

export type ToothShading = {
  /** Gradiente vertical (colo → incisal): cor do corpo com translucidez na borda. */
  body: Stop[];
  /** Gradiente horizontal: sombra nas faces proximais para dar volume. */
  sides: Stop[];
  /** Reflexo principal (elipse vertical no terço médio, deslocada para mesial). */
  highlight: { cx: number; cy: number; rx: number; ry: number };
  /** Reflexo secundário próximo ao colo. */
  cervicalGlow: { cx: number; cy: number; rx: number; ry: number };
  stroke: { color: string; opacity: number; width: number };
};

/**
 * Deriva da cor-alvo as camadas de sombreamento de um dente:
 * colo um pouco mais escuro e saturado, corpo na cor, terço incisal mais
 * claro e levemente azulado/translúcido (halo incisal).
 */
export function toothShading(tint: string, opacity: number, t: ToothPlacement): ToothShading {
  const lab = rgbToLab(hexToRgb(tint));
  const cervical = labToHex({ L: lab.L - 8, a: lab.a + 1, b: lab.b + 6 });
  const body = labToHex(lab);
  const incisal = labToHex({ L: Math.min(97, lab.L + 3), a: lab.a - 0.5, b: lab.b - 3 });
  const edge = labToHex({ L: Math.min(97, lab.L + 4), a: lab.a - 1.5, b: lab.b - 9 });
  const dark = labToHex({ L: Math.max(0, lab.L - 22), a: lab.a, b: lab.b + 2 });

  const o = opacity;
  const mesialFirst = t.side === 'left'; // para 21–23 a mesial fica à esquerda da caixa
  const hx = t.x + t.w * (mesialFirst ? 0.42 : 0.58);

  return {
    body: [
      { offset: 0, color: cervical, opacity: o },
      { offset: 0.2, color: body, opacity: o },
      { offset: 0.62, color: body, opacity: o },
      { offset: 0.84, color: incisal, opacity: o * 0.92 },
      { offset: 1, color: edge, opacity: o * 0.55 },
    ],
    sides: [
      { offset: 0, color: dark, opacity: 0.3 },
      { offset: 0.2, color: dark, opacity: 0 },
      { offset: 0.8, color: dark, opacity: 0 },
      { offset: 1, color: dark, opacity: 0.26 },
    ],
    highlight: { cx: hx, cy: t.y + t.h * 0.47, rx: t.w * 0.17, ry: t.h * 0.27 },
    cervicalGlow: { cx: t.x + t.w * 0.5, cy: t.y + t.h * 0.22, rx: t.w * 0.3, ry: t.h * 0.1 },
    stroke: { color: dark, opacity: 0.35 * o, width: 0.8 },
  };
}
