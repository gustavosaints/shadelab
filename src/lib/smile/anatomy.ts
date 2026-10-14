/**
 * Smile Design com anatomias reais: sprites renderizados dos STLs/EOFF
 * (scripts/anatomia/render.mjs) no lugar dos contornos SVG.
 *
 * Cada dente do lado direito do paciente (11, 12, 13) vem como três PNGs com
 * fundo transparente, já cortados na linha da gengiva, vistos quase de frente:
 *   fill  — silhueta branca (recebe a cor-alvo)
 *   shade — preto com alfa = sombra (colo e faces proximais mais escuros)
 *   gloss — branco com alfa = reflexos da luz de estúdio
 * Os dentes 21–23 são o espelho horizontal dos sprites. Os dentes são postos
 * lado a lado por contato, como no modo contorno.
 */
import { applyToothEdit, WIDTH_RATIOS, type Side, type SmileParams, type ToothKind } from './teeth';

export type AnatomyShape = 'oval' | 'square' | 'triangular' | 'mixed';

export type AnatomyTooth = {
  /** Tamanho do sprite em pixels. */
  width: number;
  height: number;
  /** Tamanho real (mm). */
  wMm: number;
  hMm: number;
  /** Reservado (posição no arco); o layout usa contato entre vizinhos. */
  offsetX: number;
  /** offsetY positivo = margem gengival mais baixa que a do central (mm). */
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
  rot: number;
  tooth: AnatomyTooth;
};

/** Ordem de desenho: caninos atrás, centrais na frente (como no arco). */
export const Z_ORDER: Record<ToothKind, number> = { canine: 0, lateral: 1, central: 2 };

/**
 * Posiciona os seis anteriores usando as medidas reais da anatomia.
 * Mantém a semântica dos parâmetros do modo contorno: `centralWidth` é a largura do
 * central, `heightRatio` a relação altura/largura dele (os outros dentes seguem a
 * proporção da biblioteca), `spacing` abre espaço entre vizinhos, `curve` eleva os
 * posteriores, `proportion` áurea/RED força as larguras e `edits` ajusta dente a dente.
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
    const w = forced && kind !== 'central' ? cw * (kind === 'lateral' ? ratios.lateral : ratios.canine) : t.wMm * s;
    const h = t.hMm * s * vs;
    const x0 = edge - w;
    const y0 = gumY + t.offsetY * s * vs - p.curve * ch * k * k * 0.5;
    edge = x0 - gap;
    const fdi = `1${k + 1}`;
    const box = applyToothEdit({ x: x0, y: y0, w, h }, p.edits?.[fdi], cw, ch);
    right.push({ fdi, kind, side: 'right', ...box, tooth: t });
  }
  // lado esquerdo: mesmo encadeamento a partir da linha média, com o ajuste próprio de cada dente
  let edgeL = midX + gap / 2;
  const leftOut: AnatomyPlacement[] = [];
  for (const { kind, k } of kinds) {
    const t = def.teeth[kind];
    const w = forced && kind !== 'central' ? cw * (kind === 'lateral' ? ratios.lateral : ratios.canine) : t.wMm * s;
    const h = t.hMm * s * vs;
    const x0 = edgeL;
    const y0 = gumY + t.offsetY * s * vs - p.curve * ch * k * k * 0.5;
    edgeL = x0 + w + gap;
    const fdi = `2${k + 1}`;
    const box = applyToothEdit({ x: x0, y: y0, w, h }, p.edits?.[fdi], cw, ch);
    leftOut.push({ fdi, kind, side: 'left', ...box, tooth: t });
  }
  return [...right, ...leftOut].sort((a, b) => a.x - b.x);
}
