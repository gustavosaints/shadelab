/**
 * Imagem-guia do planejamento para a IA (2026-10-23: o Gustavo achou que a geração "quase não mudou" os dentes —
 * só com texto o modelo mexe pouco). Sobre a mesma foto, desenha cada dente planejado (forma escolhida, já com
 * arco, larguras e comprimentos) preenchido na cor-alvo da escala, com uma linha discreta entre eles. A IA recebe a foto
 * original + esta imagem e transforma o rascunho em dentes fotorrealistas. Parte pura (RGBA em memória).
 */
import type { RGB } from '@/lib/color/convert';
import { mixedShapePoints } from './teeth';
import type { MappedTooth } from './mapping';

export type Rgba = { data: Uint8Array | Uint8ClampedArray; width: number; height: number };

/** Contorno do dente em px (polígono a partir do contorno unitário da forma; mesial voltado para a linha média). */
export function toothPolygon(t: MappedTooth, shapeMix: number): { x: number; y: number }[] {
  return mixedShapePoints(t.outline, shapeMix).map(([ux, uy]) => ({ x: t.x + (t.side === 'right' ? ux : 1 - ux) * t.w, y: t.y + uy * t.h }));
}

function inside(x: number, y: number, poly: { x: number; y: number }[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/**
 * Pinta os dentes planejados na imagem (altera `img.data`). `scale` converte px da foto original para px desta
 * imagem (ex.: foto reduzida para 1536 px). Preenchimento na cor-alvo com leve degradê (colo um pouco mais escuro,
 * incisal um pouco mais clara) e linha DISCRETA (a própria cor, um pouco mais escura) entre os dentes: uma linha
 * escura e grossa era lida pela IA como espaço, e os diastemas ficavam (2026-10-23). Os dentes são alargados
 * para encostar nos vizinhos (o layout deixa um espaço mínimo entre eles).
 */
export function paintGuide(img: Rgba, teeth: MappedTooth[], shapeMix: number, color: RGB, scale = 1, fillAlpha = 0.88): void {
  const { width: W, height: H, data } = img;
  const edge = Math.max(1, Math.round(W / 700));
  for (const t0 of teeth) {
    const grow = t0.w * 0.04; // fecha o espaço mínimo do layout: dentes em contato
    const t = { ...t0, x: (t0.x - grow / 2) * scale, y: t0.y * scale, w: (t0.w + grow) * scale, h: t0.h * scale };
    const poly = toothPolygon(t, shapeMix);
    const x0 = Math.max(0, Math.floor(Math.min(...poly.map((p) => p.x))));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(...poly.map((p) => p.x))));
    const y0 = Math.max(0, Math.floor(Math.min(...poly.map((p) => p.y))));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(...poly.map((p) => p.y))));
    for (let y = y0; y <= y1; y++) {
      const fy = t.h > 0 ? (y - t.y) / t.h : 0.5;
      const shade = 0.93 + 0.12 * fy; // colo mais escuro → incisal mais clara
      for (let x = x0; x <= x1; x++) {
        if (!inside(x + 0.5, y + 0.5, poly)) continue;
        // perto da borda do polígono vira contorno
        const border =
          !inside(x + 0.5 - edge, y + 0.5, poly) || !inside(x + 0.5 + edge, y + 0.5, poly) || !inside(x + 0.5, y + 0.5 - edge, poly) || !inside(x + 0.5, y + 0.5 + edge, poly);
        const i = (y * W + x) * 4;
        const tone = border ? shade * 0.72 : shade;
        const tgt = [color.r * tone, color.g * tone, color.b * tone];
        const a = border ? 0.95 : fillAlpha;
        for (let k = 0; k < 3; k++) data[i + k] = Math.max(0, Math.min(255, Math.round(data[i + k] * (1 - a) + tgt[k] * a)));
      }
    }
  }
}
