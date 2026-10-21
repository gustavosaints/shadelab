/**
 * Geometria paramétrica dos seis dentes anteriores superiores (13 a 23)
 * para o Smile Design. Parâmetros em frações da imagem exibida, para o
 * desenho ser independente do aparelho.
 *
 * Cada dente é descrito num quadrado unitário com a face DISTAL em x = 0 e a
 * face MESIAL em x = 1 (colo em y = 0, incisal em y = 1). Os dentes do lado
 * esquerdo do paciente (21–23) são espelhados.
 */

export type ToothShape = 'oval' | 'square' | 'triangular';
/** natural = larguras típicas/da biblioteca; golden = proporção áurea; red = Recurring Esthetic Dental (DSD). */
export type Proportion = 'natural' | 'golden' | 'red';
export type ToothKind = 'central' | 'lateral' | 'canine';
export type Side = 'right' | 'left'; // lado do paciente

export type SmileParams = {
  /** Centro da linha média, fração da largura da imagem. */
  midlineX: number;
  /** Linha cervical dos centrais, fração da altura da imagem. */
  gumY: number;
  /** Largura do incisivo central, fração da largura da imagem. */
  centralWidth: number;
  /** Relação altura/largura do central (0,9 a 1,4 na literatura ≈ 1,2). */
  heightRatio: number;
  /** Espaço entre dentes, fração da largura do central. */
  spacing: number;
  /** Curva do sorriso: elevação dos dentes posteriores, fração da altura do central. */
  curve: number;
  shape: ToothShape;
  /** Posição na barra contínua de forma (0 quadrada, 0,5 oval, 1 triangular). Ausente = usa `shape`. */
  shapeMix?: number;
  proportion: Proportion;
  /** Opacidade da simulação (0..1). */
  opacity: number;
  /** Cor de preenchimento (hex), normalmente a cor-alvo da escala. */
  tint: string;
  /**
   * Contorno da boca (abertura entre os lábios), frações da imagem, sentido horário a partir da
   * comissura direita do paciente. Quando presente, os dentes são recortados por ele.
   */
  mouth?: MouthPoint[];
  /** Ajustes dente a dente (por FDI "11".."23"), por cima do layout automático. */
  edits?: Partial<Record<string, ToothEdit>>;
  /** Anatomia 3D ao vivo: id do arco em `archCatalog.ts`. Ausente = contornos SVG com `shape`. */
  arch?: string;
  /** Ajustes só do 3D: inclinações (graus), inferior visível/abertura (mm), sombra do lábio (0..1). */
  arch3d?: Partial<Arch3DParams>;
};

export type Arch3DParams = { rotX: number; rotY: number; rotZ: number; showLower: boolean; lowerGap: number; lipShadow: number; gloss: number };
export const DEFAULT_ARCH3D: Arch3DParams = { rotX: 0, rotY: 0, rotZ: 0, showLower: true, lowerGap: 0, lipShadow: 0.5, gloss: 0.6 };

export type MouthPoint = { x: number; y: number };

/** Ajuste individual de um dente: deslocamento (frações da largura/altura do central), escala e rotação (graus, horário). */
export type ToothEdit = { dx: number; dy: number; sw: number; sh: number; rot: number };
export const NO_EDIT: ToothEdit = { dx: 0, dy: 0, sw: 1, sh: 1, rot: 0 };

export type ToothBox = { x: number; y: number; w: number; h: number };

/**
 * Aplica o ajuste individual a uma caixa: desloca, muda largura mantendo o centro e comprimento
 * mantendo a linha cervical. A rotação é devolvida para o desenho (em torno do centro da caixa).
 */
export function applyToothEdit(box: ToothBox, edit: ToothEdit | undefined, cw: number, ch: number): ToothBox & { rot: number } {
  if (!edit) return { ...box, rot: 0 };
  const w = box.w * edit.sw;
  const h = box.h * edit.sh;
  const cx = box.x + box.w / 2 + edit.dx * cw;
  return { x: cx - w / 2, y: box.y + edit.dy * ch, w, h, rot: edit.rot };
}

/** Ajuste espelhado para o dente do outro lado (deslocamento horizontal e rotação invertidos). */
export function mirrorEdit(e: ToothEdit): ToothEdit {
  return { ...e, dx: -e.dx, rot: -e.rot };
}

/** FDI do dente homólogo do outro lado. */
export function mirrorFdi(fdi: string): string {
  return (fdi[0] === '1' ? '2' : '1') + fdi[1];
}

export function clampEdit(e: ToothEdit): ToothEdit {
  const c = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return { dx: c(e.dx, -1, 1), dy: c(e.dy, -1, 1), sw: c(e.sw, 0.5, 1.6), sh: c(e.sh, 0.5, 1.6), rot: c(e.rot, -30, 30) };
}

export const DEFAULT_SMILE_PARAMS: SmileParams = {
  midlineX: 0.5,
  gumY: 0.42,
  centralWidth: 0.085,
  heightRatio: 1.2,
  spacing: 0.03,
  curve: 0.08,
  shape: 'oval',
  proportion: 'natural',
  opacity: 0.92,
  tint: '#F2EBDD',
};

export type ToothPlacement = {
  fdi: string; // "13" .. "23"
  kind: ToothKind;
  side: Side;
  /** Caixa em pixels (origem no canto superior esquerdo). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Caminho SVG em coordenadas absolutas (pixels). */
  d: string;
  /** Rotação em graus (horário) em torno do centro da caixa, do ajuste individual. */
  rot: number;
};

/** Larguras visíveis de lateral e canino relativas ao central, por proporção. */
export const WIDTH_RATIOS: Record<Proportion, { lateral: number; canine: number }> = {
  natural: { lateral: 0.78, canine: 0.74 },
  golden: { lateral: 0.618, canine: 0.382 },
  red: { lateral: 0.7, canine: 0.5 },
};

const HEIGHT_RATIOS: Record<ToothKind, number> = { central: 1, lateral: 0.85, canine: 1.02 };
/** Deslocamento do zênite gengival (fração da altura): lateral fica um pouco mais baixo. */
const ZENITH_OFFSET: Record<ToothKind, number> = { central: 0, lateral: 0.07, canine: -0.03 };

type Pt = [number, number];

/**
 * Contornos traçados no quadrado unitário (distal x=0, mesial x=1, colo y=0,
 * incisal y=1), no sentido horário a partir do colo mesial. São suavizados
 * por spline Catmull-Rom, então poucos pontos bastam.
 */
const OUTLINES: Record<ToothKind, Pt[]> = {
  central: [
    [0.78, 0.09], [0.9, 0.2], [0.97, 0.36], [1.0, 0.54], [1.0, 0.72], [0.99, 0.87],
    [0.97, 0.96], [0.86, 1.0], [0.62, 1.0], [0.38, 1.0], [0.18, 0.99], [0.08, 0.95],
    [0.02, 0.86], [0.0, 0.72], [0.0, 0.54], [0.03, 0.36], [0.1, 0.2], [0.22, 0.09],
    [0.34, 0.03], [0.47, 0.0], [0.6, 0.01], [0.7, 0.04],
  ],
  lateral: [
    [0.74, 0.11], [0.88, 0.24], [0.96, 0.4], [1.0, 0.58], [0.99, 0.76], [0.96, 0.9],
    [0.9, 0.97], [0.76, 1.0], [0.55, 1.0], [0.33, 0.99], [0.16, 0.95], [0.06, 0.87],
    [0.01, 0.74], [0.0, 0.58], [0.03, 0.42], [0.1, 0.26], [0.24, 0.12], [0.36, 0.04],
    [0.48, 0.0], [0.6, 0.01], [0.68, 0.05],
  ],
  // canino com cúspide arredondada (como um canino natural levemente desgastado), não pontudo
  canine: [
    [0.78, 0.1], [0.92, 0.24], [0.99, 0.42], [1.0, 0.6], [0.98, 0.76], [0.92, 0.88],
    [0.8, 0.96], [0.66, 1.0], [0.54, 0.99], [0.42, 0.955], [0.28, 0.9], [0.14, 0.82],
    [0.04, 0.7], [0.0, 0.55], [0.02, 0.4], [0.07, 0.26], [0.17, 0.13], [0.31, 0.04],
    [0.46, 0.0], [0.6, 0.01], [0.7, 0.04],
  ],
};

/**
 * Posição da forma na barra contínua: 0 = quadrada, 0.5 = oval, 1 = triangular.
 * Os contornos têm o mesmo número de pontos, então a interpolação é suave, sem saltos.
 */
export const SHAPE_MIX: Record<ToothShape, number> = { square: 0, oval: 0.5, triangular: 1 };

/** Forma nominal mais próxima de uma posição da barra (para rótulos e compatibilidade). */
export function shapeFromMix(mix: number): ToothShape {
  return mix < 0.25 ? 'square' : mix > 0.75 ? 'triangular' : 'oval';
}

/** Contorno interpolado entre quadrada → oval → triangular, no quadrado unitário. */
export function mixedShapePoints(kind: ToothKind, mix: number): Pt[] {
  const m = Math.min(1, Math.max(0, mix));
  const from = m < 0.5 ? shapePoints(kind, 'square') : shapePoints(kind, 'oval');
  const to = m < 0.5 ? shapePoints(kind, 'oval') : shapePoints(kind, 'triangular');
  const t = m < 0.5 ? m / 0.5 : (m - 0.5) / 0.5;
  return from.map(([x, y], i) => [x + (to[i][0] - x) * t, y + (to[i][1] - y) * t]);
}

/** Deforma o contorno base conforme a forma escolhida. */
function shapePoints(kind: ToothKind, shape: ToothShape): Pt[] {
  const base = OUTLINES[kind];
  if (shape === 'oval') return base;
  return base.map(([x, y]) => {
    if (shape === 'square') {
      // colo mais largo, faces mais retas e ângulos incisais mais vivos
      let nx = 0.5 + (x - 0.5) * (0.93 + 0.07 * y);
      let ny = y;
      if (y > 0.9 && kind !== 'canine') {
        nx = 0.5 + (x - 0.5) * 1.08;
        ny = x > 0.15 && x < 0.85 ? 1.0 : Math.max(y, 0.97);
      }
      return [Math.min(1, Math.max(0, nx)), ny];
    }
    // triangular: colo bem mais estreito, abrindo até a incisal
    return [0.5 + (x - 0.5) * (0.68 + 0.32 * y), y];
  });
}

/** Converte um polígono fechado em segmentos cúbicos (Catmull-Rom → Bézier). */
function smoothClosed(pts: Pt[], tension = 0.42): { start: Pt; segments: [Pt, Pt, Pt][] } {
  const n = pts.length;
  const segs: [Pt, Pt, Pt][] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) * tension) / 3, p1[1] + ((p2[1] - p0[1]) * tension) / 3];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) * tension) / 3, p2[1] - ((p3[1] - p1[1]) * tension) / 3];
    segs.push([c1, c2, p2]);
  }
  return { start: pts[0], segments: segs };
}

function unitOutline(kind: ToothKind, shape: ToothShape | number): { start: Pt; segments: [Pt, Pt, Pt][] } {
  return smoothClosed(typeof shape === 'number' ? mixedShapePoints(kind, shape) : shapePoints(kind, shape));
}

const f = (n: number) => Number(n.toFixed(2));

/**
 * Caminho SVG absoluto do dente na caixa (x, y, w, h).
 * `side === 'right'` (dentes 11–13, à esquerda do observador): mesial fica à direita.
 */
export function toothPath(x: number, y: number, w: number, h: number, shape: ToothShape | number, kind: ToothKind, side: Side): string {
  const { start, segments } = unitOutline(kind, shape);
  const map = ([ux, uy]: Pt): Pt => [x + (side === 'right' ? ux : 1 - ux) * w, y + uy * h];
  const [sx, sy] = map(start);
  const parts = [`M ${f(sx)} ${f(sy)}`];
  for (const [c1, c2, p] of segments) {
    const [a, b] = map(c1);
    const [c, d] = map(c2);
    const [e, g] = map(p);
    parts.push(`C ${f(a)} ${f(b)}, ${f(c)} ${f(d)}, ${f(e)} ${f(g)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/**
 * Posiciona os seis anteriores. `width`/`height` são as dimensões em pixels
 * da área onde a foto está desenhada.
 */
export function layoutTeeth(p: SmileParams, width: number, height: number): ToothPlacement[] {
  const cw = p.centralWidth * width;
  const ch = cw * p.heightRatio;
  const gap = p.spacing * cw;
  const ratios = WIDTH_RATIOS[p.proportion];
  const midX = p.midlineX * width;
  const gumY = p.gumY * height;

  const order: { kind: ToothKind; ratio: number; k: number }[] = [
    { kind: 'central', ratio: 1, k: 0 },
    { kind: 'lateral', ratio: ratios.lateral, k: 1 },
    { kind: 'canine', ratio: ratios.canine, k: 2 },
  ];

  const out: ToothPlacement[] = [];
  for (const dir of [-1, 1] as const) {
    const side: Side = dir < 0 ? 'right' : 'left';
    let edge = midX + (dir * gap) / 2; // borda mesial do próximo dente
    for (const t of order) {
      const w = cw * t.ratio;
      const h = ch * HEIGHT_RATIOS[t.kind];
      const x0 = dir > 0 ? edge : edge - w;
      const y0 = gumY + ZENITH_OFFSET[t.kind] * ch - p.curve * ch * t.k * t.k * 0.5;
      const fdi = dir < 0 ? `1${t.k + 1}` : `2${t.k + 1}`;
      const { x, y, w: ew, h: eh, rot } = applyToothEdit({ x: x0, y: y0, w, h }, p.edits?.[fdi], cw, ch);
      const shape = p.shapeMix ?? SHAPE_MIX[p.shape];
      out.push({ fdi, kind: t.kind, side, x, y, w: ew, h: eh, rot, d: toothPath(x, y, ew, eh, shape, t.kind, side) });
      edge = dir > 0 ? x0 + w + gap : x0 - gap;
    }
  }
  // ordem da esquerda para a direita do observador: 13 12 11 21 22 23
  return out.sort((a, b) => a.x - b.x);
}

export function clampParams(p: SmileParams): SmileParams {
  const c = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    ...p,
    midlineX: c(p.midlineX, 0.1, 0.9),
    gumY: c(p.gumY, 0.05, 0.9),
    centralWidth: c(p.centralWidth, 0.03, 0.25),
    heightRatio: c(p.heightRatio, 0.8, 1.6),
    spacing: c(p.spacing, 0, 0.2),
    curve: c(p.curve, -0.2, 0.4),
    opacity: c(p.opacity, 0, 1),
  };
}
