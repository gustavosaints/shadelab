/**
 * Smile Design com anatomias reais: sprites renderizados dos STLs/EOFF
 * (scripts/anatomia/render.mjs) no lugar dos contornos SVG.
 *
 * Cada dente do lado direito do paciente (11, 12, 13) vem como três PNGs com
 * fundo transparente, já cortados na linha da gengiva:
 *   fill  — silhueta branca (recebe a cor-alvo via tintColor)
 *   shade — preto com alfa = sombra (colo e faces proximais mais escuros)
 *   gloss — branco com alfa = reflexos da luz de estúdio
 * Os dentes 21–23 são o espelho horizontal dos sprites.
 */
import { WIDTH_RATIOS, type Side, type SmileParams, type ToothKind } from './teeth';

export type AnatomyShape = 'oval' | 'square' | 'triangular' | 'mixed';

export type AnatomyTooth = {
  /** Tamanho do sprite em pixels. */
  width: number;
  height: number;
  /** Tamanho real na vista frontal do arco (mm). */
  wMm: number;
  hMm: number;
  /** Posição da caixa em relação à do central (mm): offsetX negativo = mais para a esquerda do observador. */
  offsetX: number;
  /** offsetY positivo = margem gengival mais baixa que a do central. */
  offsetY: number;
  fill: number;
  shade: number;
  gloss: number;
};

export type AnatomyDef = {
  id: string;
  name: string;
  shape: AnatomyShape;
  thumb: number;
  teeth: Record<ToothKind, AnatomyTooth>;
};

export type AnatomyPlacement = {
  fdi: string;
  kind: ToothKind;
  side: Side;
  x: number;
  y: number;
  w: number;
  h: number;
  tooth: AnatomyTooth;
};

/** Ordem de desenho: caninos atrás, centrais na frente (como no arco). */
export const Z_ORDER: Record<ToothKind, number> = { canine: 0, lateral: 1, central: 2 };

/**
 * Posiciona os seis anteriores usando as medidas reais da anatomia.
 * Mantém a semântica dos parâmetros do modo contorno: `centralWidth` é a largura do
 * central, `heightRatio` a relação altura/largura dele (os outros dentes seguem a
 * proporção da biblioteca), `spacing` abre espaço entre vizinhos, `curve` eleva os
 * posteriores e `proportion` áurea força 62%/38% nas larguras.
 */
export function layoutAnatomy(p: SmileParams, def: AnatomyDef, width: number, height: number): AnatomyPlacement[] {
  const c = def.teeth.central;
  const cw = p.centralWidth * width;
  const s = cw / c.wMm; // px por mm (horizontal)
  const vs = (p.heightRatio * c.wMm) / c.hMm; // fator vertical: central fica com cw × heightRatio
  const ch = c.hMm * s * vs;
  const gap = p.spacing * cw;
  const midX = p.midlineX * width;
  const gumY = p.gumY * height;

  const kinds: { kind: ToothKind; k: number }[] = [
    { kind: 'central', k: 0 },
    { kind: 'lateral', k: 1 },
    { kind: 'canine', k: 2 },
  ];
  const forced = p.proportion !== 'natural'; // áurea ou RED: larguras impostas em relação ao central
  const ratios = WIDTH_RATIOS[p.proportion];

  // lado direito do paciente (à esquerda do observador), depois espelhado
  const right: AnatomyPlacement[] = [];
  let edge = midX - gap / 2; // borda mesial do próximo dente
  for (const { kind, k } of kinds) {
    const t = def.teeth[kind];
    const natural = t.wMm * s;
    const w = forced && kind !== 'central' ? cw * (kind === 'lateral' ? ratios.lateral : ratios.canine) : natural;
    const h = t.hMm * s * vs;
    let x: number;
    if (forced || kind === 'central') {
      x = edge - w;
      edge = x - gap;
    } else {
      x = midX - gap / 2 - cw + t.offsetX * s - gap * k;
    }
    const y = gumY + t.offsetY * s * vs - p.curve * ch * k * k * 0.5;
    right.push({ fdi: `1${k + 1}`, kind, side: 'right', x, y, w, h, tooth: t });
  }
  const left: AnatomyPlacement[] = right.map((t) => ({
    ...t,
    fdi: `2${t.fdi[1]}`,
    side: 'left',
    x: 2 * midX - (t.x + t.w),
  }));
  return [...right, ...left].sort((a, b) => a.x - b.x);
}
