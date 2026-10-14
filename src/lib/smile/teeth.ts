/**
 * Geometria paramétrica dos seis dentes anteriores superiores (13 a 23)
 * para o Smile Design. Tudo em coordenadas normalizadas pela largura da
 * imagem exibida (0..1), para o desenho ser independente do aparelho.
 */

export type ToothShape = 'oval' | 'square' | 'triangular';
export type Proportion = 'natural' | 'golden';
export type ToothKind = 'central' | 'lateral' | 'canine';

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
  proportion: Proportion;
  /** Opacidade da simulação (0..1). */
  opacity: number;
  /** Cor de preenchimento (hex), normalmente a cor-alvo da escala. */
  tint: string;
};

export const DEFAULT_SMILE_PARAMS: SmileParams = {
  midlineX: 0.5,
  gumY: 0.42,
  centralWidth: 0.085,
  heightRatio: 1.2,
  spacing: 0.04,
  curve: 0.08,
  shape: 'oval',
  proportion: 'natural',
  opacity: 0.85,
  tint: '#F2EBDD',
};

export type ToothPlacement = {
  fdi: string; // "13" .. "23"
  kind: ToothKind;
  /** Caixa em pixels (origem no canto superior esquerdo). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Caminho SVG em coordenadas absolutas (pixels). */
  d: string;
};

/** Larguras visíveis de lateral e canino relativas ao central, por proporção. */
export const WIDTH_RATIOS: Record<Proportion, { lateral: number; canine: number }> = {
  natural: { lateral: 0.78, canine: 0.84 },
  golden: { lateral: 0.618, canine: 0.382 },
};

const HEIGHT_RATIOS: Record<ToothKind, number> = { central: 1, lateral: 0.88, canine: 0.98 };
/** Deslocamento do zênite gengival (fração da altura): lateral fica um pouco mais baixo. */
const ZENITH_OFFSET: Record<ToothKind, number> = { central: 0, lateral: 0.06, canine: -0.02 };

type ShapeSpec = {
  cervicalWidth: number; // fração da largura no colo
  cornerRadius: number; // fração da largura nos ângulos incisais
  sideBulge: number; // quanto as faces proximais são convexas (0 reto .. 1 muito)
  incisalCurve: number; // convexidade da borda incisal (fração da altura)
};

const SHAPES: Record<ToothShape, ShapeSpec> = {
  oval: { cervicalWidth: 0.7, cornerRadius: 0.3, sideBulge: 0.9, incisalCurve: 0.05 },
  square: { cervicalWidth: 0.82, cornerRadius: 0.12, sideBulge: 0.5, incisalCurve: 0.0 },
  triangular: { cervicalWidth: 0.52, cornerRadius: 0.2, sideBulge: 0.25, incisalCurve: 0.03 },
};

const f = (n: number) => Number(n.toFixed(2));

/**
 * Contorno de um dente numa caixa (x, y, w, h). O colo fica no topo.
 * O canino recebe uma cúspide em vez de borda incisal reta.
 */
export function toothPath(x: number, y: number, w: number, h: number, shape: ToothShape, kind: ToothKind): string {
  const s = SHAPES[shape];
  const cw = w * s.cervicalWidth;
  const xl = x + (w - cw) / 2;
  const xr = xl + cw;
  const yc = y + h * 0.16; // altura em que o colo encontra as faces
  const r = w * s.cornerRadius;
  const bulge = s.sideBulge;

  // Controle das faces proximais: quanto maior o bulge, mais a face sai da reta.
  const c1x = (side: 1 | -1) => (side > 0 ? xr + (x + w - xr) * (0.6 + 0.6 * bulge) : xl - (xl - x) * (0.6 + 0.6 * bulge));
  const c2x = (side: 1 | -1) => (side > 0 ? x + w + w * 0.02 * bulge : x - w * 0.02 * bulge);

  const parts: string[] = [];
  parts.push(`M ${f(xl)} ${f(yc)}`);
  // colo (arco superior)
  parts.push(`C ${f(xl + cw * 0.15)} ${f(y - h * 0.01)}, ${f(xr - cw * 0.15)} ${f(y - h * 0.01)}, ${f(xr)} ${f(yc)}`);
  // face distal/mesial direita até o ângulo incisal
  parts.push(`C ${f(c1x(1))} ${f(y + h * 0.32)}, ${f(c2x(1))} ${f(y + h * 0.65)}, ${f(x + w)} ${f(y + h - r)}`);

  if (kind === 'canine') {
    // ângulo direito, vertente até a ponta da cúspide, vertente até o ângulo esquerdo
    const tipY = y + h;
    const shoulderY = y + h - h * 0.12;
    parts.push(`Q ${f(x + w)} ${f(shoulderY)}, ${f(x + w - r * 0.8)} ${f(shoulderY)}`);
    parts.push(`L ${f(x + w / 2)} ${f(tipY)}`);
    parts.push(`L ${f(x + r * 0.8)} ${f(shoulderY)}`);
    parts.push(`Q ${f(x)} ${f(shoulderY)}, ${f(x)} ${f(y + h - r)}`);
  } else {
    // ângulo incisal direito
    parts.push(`Q ${f(x + w)} ${f(y + h)}, ${f(x + w - r)} ${f(y + h)}`);
    // borda incisal (levemente convexa)
    parts.push(`Q ${f(x + w / 2)} ${f(y + h + h * s.incisalCurve)}, ${f(x + r)} ${f(y + h)}`);
    // ângulo incisal esquerdo
    parts.push(`Q ${f(x)} ${f(y + h)}, ${f(x)} ${f(y + h - r)}`);
  }
  // face esquerda de volta ao colo
  parts.push(`C ${f(c2x(-1))} ${f(y + h * 0.65)}, ${f(c1x(-1))} ${f(y + h * 0.32)}, ${f(xl)} ${f(yc)}`);
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
  for (const side of [-1, 1] as const) {
    let edge = midX + (side * gap) / 2; // borda mesial do próximo dente
    for (const t of order) {
      const w = cw * t.ratio;
      const h = ch * HEIGHT_RATIOS[t.kind];
      const x = side > 0 ? edge : edge - w;
      const y = gumY + ZENITH_OFFSET[t.kind] * ch - p.curve * ch * t.k * t.k * 0.5;
      const fdi = side < 0 ? `1${t.k + 1}` : `2${t.k + 1}`;
      out.push({ fdi, kind: t.kind, x, y, w, h, d: toothPath(x, y, w, h, p.shape, t.kind) });
      edge = side > 0 ? x + w + gap : x - gap;
    }
  }
  // ordem anatômica da esquerda para a direita do observador: 13 12 11 21 22 23
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
