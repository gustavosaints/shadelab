/**
 * Contorno da boca: a abertura entre os lábios que recorta a simulação, para o
 * lábio superior esconder a cervical dos dentes e os cantos não vazarem.
 *
 * Oito pontos em frações da imagem, no sentido horário a partir da comissura
 * direita do paciente (esquerda do observador):
 *   0 comissura R · 1 2 3 lábio superior (R, meio, L) · 4 comissura L · 5 6 7 lábio inferior (L, meio, R)
 */
import type { MouthPoint, SmileParams } from './teeth';

export type Box = { x: number; y: number; w: number; h: number };

export const MOUTH_LABELS = ['Comissura', 'Lábio sup.', 'Lábio sup.', 'Lábio sup.', 'Comissura', 'Lábio inf.', 'Lábio inf.', 'Lábio inf.'];

/**
 * Contorno inicial a partir das caixas dos dentes (px): cantos um pouco além dos caninos,
 * lábio superior cobrindo ~12% da coroa (a cervical) e lábio inferior abaixo das incisais.
 */
export function defaultMouth(teeth: Box[], width: number, height: number): MouthPoint[] {
  const left = Math.min(...teeth.map((t) => t.x));
  const right = Math.max(...teeth.map((t) => t.x + t.w));
  const top = Math.min(...teeth.map((t) => t.y));
  const bottom = Math.max(...teeth.map((t) => t.y + t.h));
  const w = right - left;
  const h = bottom - top;
  const cx = (left + right) / 2;
  const pts: MouthPoint[] = [
    { x: left - 0.18 * w, y: top + 0.6 * h },
    { x: cx - 0.3 * w, y: top + 0.14 * h },
    { x: cx, y: top + 0.08 * h },
    { x: cx + 0.3 * w, y: top + 0.14 * h },
    { x: right + 0.18 * w, y: top + 0.6 * h },
    { x: cx + 0.3 * w, y: bottom + 0.35 * h },
    { x: cx, y: bottom + 0.45 * h },
    { x: cx - 0.3 * w, y: bottom + 0.35 * h },
  ];
  const c = (v: number) => Math.min(1, Math.max(0, v));
  return pts.map((p) => ({ x: c(p.x / width), y: c(p.y / height) }));
}

/** Caminho SVG fechado e suave (Catmull-Rom → Bézier) pelo contorno, em px. */
export function mouthPath(mouth: MouthPoint[], width: number, height: number, tension = 0.5): string {
  const pts = mouth.map((p) => ({ x: p.x * width, y: p.y * height }));
  const n = pts.length;
  if (n < 3) return '';
  const f = (v: number) => v.toFixed(1);
  const parts = [`M ${f(pts[0].x)} ${f(pts[0].y)}`];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = { x: p1.x + ((p2.x - p0.x) * tension) / 3, y: p1.y + ((p2.y - p0.y) * tension) / 3 };
    const c2 = { x: p2.x - ((p3.x - p1.x) * tension) / 3, y: p2.y - ((p3.y - p1.y) * tension) / 3 };
    parts.push(`C ${f(c1.x)} ${f(c1.y)}, ${f(c2.x)} ${f(c2.y)}, ${f(p2.x)} ${f(p2.y)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/** Medidas úteis do contorno em px: cantos, centro e linha do lábio superior no meio. */
export function mouthBounds(mouth: MouthPoint[], width: number, height: number) {
  const px = mouth.map((p) => ({ x: p.x * width, y: p.y * height }));
  const cornerR = px[0];
  const cornerL = px[4];
  return {
    cornerR,
    cornerL,
    centerX: (cornerR.x + cornerL.x) / 2,
    widthPx: Math.hypot(cornerL.x - cornerR.x, cornerL.y - cornerR.y),
    upperMidY: px[2].y,
    lowerMidY: px[6].y,
  };
}

/** Fração da largura da boca (comissura a comissura) ocupada pelos seis anteriores num sorriso típico. */
export const ANTERIORS_TO_MOUTH = 0.72;

/**
 * Encaixa o arco na boca: linha média no centro das comissuras, seis anteriores com
 * ~72% da largura da boca e linha da gengiva um pouco acima do lábio superior, para
 * a cervical ficar escondida. `archHalfPx` é a meia largura atual do arco (px) e
 * `centralHeightPx` a altura atual do central.
 */
export function fitToMouth(params: SmileParams, mouth: MouthPoint[], width: number, height: number, archHalfPx: number, centralHeightPx: number): SmileParams {
  const b = mouthBounds(mouth, width, height);
  const targetHalf = (b.widthPx * ANTERIORS_TO_MOUTH) / 2;
  const scale = archHalfPx > 1 ? targetHalf / archHalfPx : 1;
  const newCh = centralHeightPx * scale;
  return {
    ...params,
    midlineX: b.centerX / width,
    centralWidth: params.centralWidth * scale,
    gumY: (b.upperMidY - 0.12 * newCh) / height,
  };
}
