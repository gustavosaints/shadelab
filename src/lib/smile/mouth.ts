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

/** Índices das comissuras: a direita do paciente é o ponto 0; a esquerda, o de maior x. */
export function mouthCorners(mouth: MouthPoint[]): { r: number; l: number } {
  let l = 0;
  for (let i = 1; i < mouth.length; i++) if (mouth[i].x > mouth[l].x) l = i;
  return { r: 0, l };
}

/**
 * Acrescenta um ponto no lábio superior ou inferior, no meio do maior segmento daquele lábio,
 * para refinar o contorno (funciona com qualquer número de pontos).
 */
export function addMouthPoint(mouth: MouthPoint[], lip: 'upper' | 'lower'): MouthPoint[] {
  const { l } = mouthCorners(mouth);
  const n = mouth.length;
  // segmentos do lábio superior: 0→1→…→l ; inferior: l→…→n-1→0
  const segs: number[] = [];
  if (lip === 'upper') for (let i = 0; i < l; i++) segs.push(i);
  else for (let i = l; i < n; i++) segs.push(i);
  let best = segs[0];
  let bestLen = -1;
  for (const i of segs) {
    const a = mouth[i];
    const b = mouth[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  }
  const a = mouth[best];
  const b = mouth[(best + 1) % n];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const out = [...mouth];
  out.splice(best + 1, 0, mid);
  return out;
}

/** Remove o ponto (que não seja comissura) cuja retirada menos altera o contorno. Mantém no mínimo 6. */
export function removeMouthPoint(mouth: MouthPoint[]): MouthPoint[] {
  if (mouth.length <= 6) return mouth;
  const { r, l } = mouthCorners(mouth);
  const n = mouth.length;
  let best = -1;
  let bestDev = Infinity;
  for (let i = 0; i < n; i++) {
    if (i === r || i === l) continue;
    const a = mouth[(i - 1 + n) % n];
    const b = mouth[(i + 1) % n];
    const p = mouth[i];
    // distância do ponto à reta entre os vizinhos
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1e-9;
    const dev = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
    if (dev < bestDev) {
      bestDev = dev;
      best = i;
    }
  }
  if (best < 0) return mouth;
  return mouth.filter((_, i) => i !== best);
}

/** Medidas úteis do contorno em px: cantos, centro e altura dos lábios no meio. */
export function mouthBounds(mouth: MouthPoint[], width: number, height: number) {
  const px = mouth.map((p) => ({ x: p.x * width, y: p.y * height }));
  const { r, l } = mouthCorners(mouth);
  const cornerR = px[r];
  const cornerL = px[l];
  const centerX = (cornerR.x + cornerL.x) / 2;
  // ponto do lábio superior (índices entre r e l) e inferior (os demais) mais próximos do centro
  const nearest = (idx: number[]) => idx.reduce((b, i) => (Math.abs(px[i].x - centerX) < Math.abs(px[b].x - centerX) ? i : b), idx[0]);
  const upperIdx: number[] = [];
  const lowerIdx: number[] = [];
  for (let i = 0; i < px.length; i++) {
    if (i === r || i === l) continue;
    (i > r && i < l ? upperIdx : lowerIdx).push(i);
  }
  return {
    cornerR,
    cornerL,
    centerX,
    widthPx: Math.hypot(cornerL.x - cornerR.x, cornerL.y - cornerR.y),
    upperMidY: upperIdx.length ? px[nearest(upperIdx)].y : cornerR.y,
    lowerMidY: lowerIdx.length ? px[nearest(lowerIdx)].y : cornerR.y,
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

/**
 * Contorno inicial para delimitar à mão quando o detector não achou o rosto (sorriso fotografado de perto):
 * boca no centro da foto ocupando ~64 % da largura.
 */
export function centeredMouth(width: number, height: number): MouthPoint[] {
  const cx = width / 2;
  const cy = height / 2;
  const w = width * 0.64;
  const h = w * 0.3;
  const pts = [
    [cx - w / 2, cy],
    [cx - 0.3 * w, cy - 0.45 * h],
    [cx, cy - 0.5 * h],
    [cx + 0.3 * w, cy - 0.45 * h],
    [cx + w / 2, cy],
    [cx + 0.3 * w, cy + 0.45 * h],
    [cx, cy + 0.5 * h],
    [cx - 0.3 * w, cy + 0.45 * h],
  ];
  return pts.map(([x, y]) => ({ x: x / width, y: y / height }));
}

/** Recorte (px) em volta do contorno, com folga, para ver a boca ampliada na tela (proporção ~2:1). */
export function mouthCrop(mouth: MouthPoint[], width: number, height: number): Box {
  const xs = mouth.map((p) => p.x * width);
  const ys = mouth.map((p) => p.y * height);
  const bw = Math.max(...xs) - Math.min(...xs);
  const bh = Math.max(...ys) - Math.min(...ys);
  const w = Math.min(width * 1.1, Math.max(bw * 1.7, width * 0.2));
  const h = Math.min(height * 1.1, Math.max(bh * 2.6, w / 2));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
