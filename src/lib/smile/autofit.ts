/**
 * Alinhamento automático das anatomias nos dentes da foto.
 *
 * Entrada: pixels RGBA de um recorte em volta da boca, o contorno da boca em
 * coordenadas do recorte e a linha média facial (x). Saída: parâmetros do
 * Smile Design (linha média, largura e altura do central, gengiva) e ajustes
 * por dente (largura e posição de laterais e caninos) estimados a partir dos
 * espaços interproximais. Heurística de pixels: dentes são a região clara e
 * pouco saturada dentro da boca; os espaços entre eles são vales de claridade.
 * Sempre com ajuste manual depois.
 */
import type { MouthPoint, SmileParams, ToothEdit } from './teeth';
import { NO_EDIT } from './teeth';

export type Rgba = { data: Uint8Array | Uint8ClampedArray; width: number; height: number };

export type AutoFit = {
  /** Linha média dental (px do recorte). */
  midlineX: number;
  /** Linha cervical média dos centrais e borda incisal (px). */
  gumY: number;
  incisalY: number;
  /** Fronteiras mesiodistais encontradas, da esquerda para a direita (px), incluindo a linha média. */
  gaps: number[];
  /** Larguras estimadas por dente (px), por FDI. Ausente quando não detectado. */
  widths: Partial<Record<string, number>>;
  /** 0..1: quantos dos 5 espaços esperados foram encontrados. */
  confidence: number;
};

/** Ponto dentro de polígono (ray casting). */
export function insidePolygon(x: number, y: number, poly: MouthPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Máscara de "dente": claro, pouco saturado e não avermelhado, dentro da boca. */
export function toothMask(img: Rgba, mouth: MouthPoint[]): { mask: Uint8Array; lum: Float32Array } {
  const { data, width, height } = img;
  const mask = new Uint8Array(width * height);
  const lum = new Float32Array(width * height);
  // limiar adaptativo: média da luminância dentro da boca + meio desvio
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      lum[i] = L;
      if (insidePolygon(x + 0.5, y + 0.5, mouth)) {
        sum += L;
        sum2 += L * L;
        n++;
        mask[i] = 1; // marca "dentro"; vira dente abaixo
      }
    }
  if (!n) return { mask, lum };
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  const thr = mean + 0.5 * sd;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max ? (max - min) / max : 0;
      const reddish = r - g > 45; // gengiva, lábio, língua
      mask[i] = lum[i] > thr && sat < 0.4 && !reddish ? 1 : 0;
    }
  return { mask, lum };
}

/**
 * Procura os dentes superiores dentro da boca. `midlineX` é a linha média facial (px),
 * usada para escolher o espaço entre 11 e 21.
 */
export function autoFitTeeth(img: Rgba, mouth: MouthPoint[], midlineX: number): AutoFit | null {
  const { width, height } = img;
  const { mask, lum } = toothMask(img, mouth);

  // por coluna: primeira sequência de "dente" de cima para baixo = dente superior
  const top = new Int16Array(width).fill(-1);
  const bottom = new Int16Array(width).fill(-1);
  const minRun = Math.max(3, Math.round(height * 0.04));
  for (let x = 0; x < width; x++) {
    let y = 0;
    while (y < height && !mask[y * width + x]) y++;
    if (y >= height) continue;
    let e = y;
    while (e < height && mask[e * width + x]) e++;
    if (e - y < minRun) continue;
    top[x] = y;
    bottom[x] = e - 1;
  }
  const cols: number[] = [];
  for (let x = 0; x < width; x++) if (top[x] >= 0) cols.push(x);
  if (cols.length < width * 0.15) return null;

  // bordas da região de dentes também são fronteiras (distal dos últimos dentes visíveis)
  const left = cols[0];
  const right = cols[cols.length - 1];

  // faixa horizontal no terço médio dos dentes superiores, em TODAS as colunas entre as bordas
  // (nas frestas, onde não há dente, usa a faixa da coluna com dente mais próxima)
  const bandTop = new Float32Array(width);
  const bandBottom = new Float32Array(width);
  let lastTooth = -1;
  for (let x = left; x <= right; x++) {
    if (top[x] >= 0) lastTooth = x;
    const ref = top[x] >= 0 ? x : lastTooth;
    bandTop[x] = top[ref] + (bottom[ref] - top[ref]) * 0.35;
    bandBottom[x] = top[ref] + (bottom[ref] - top[ref]) * 0.75;
  }
  const profile = new Float32Array(width).fill(NaN);
  for (let x = left; x <= right; x++) {
    let s = 0;
    let k = 0;
    for (let y = Math.round(bandTop[x]); y <= Math.round(bandBottom[x]); y++) {
      s += lum[y * width + x];
      k++;
    }
    profile[x] = k ? s / k : NaN;
  }
  // suaviza (janela ~1% da largura para cada lado)
  const win = Math.max(1, Math.round(width * 0.01));
  const smooth = new Float32Array(width).fill(NaN);
  for (let x = left; x <= right; x++) {
    let s = 0;
    let k = 0;
    for (let d = -win; d <= win; d++) {
      const v = profile[x + d];
      if (v !== undefined && !Number.isNaN(v)) {
        s += v;
        k++;
      }
    }
    smooth[x] = s / k;
  }
  // vales: mínimos locais com proeminência (≥ 12% da claridade média) em relação à vizinhança,
  // separados por pelo menos 3% da largura
  let mean = 0;
  for (let x = left; x <= right; x++) mean += smooth[x];
  mean /= right - left + 1;
  const prominence = 0.12 * mean;
  const minSep = Math.max(2, Math.round(width * 0.03));
  const gaps: number[] = [];
  for (let x = left + 1; x < right; x++) {
    const v = smooth[x];
    let isMin = true;
    let windowMax = v;
    for (let d = -minSep; d <= minSep; d++) {
      const xx = x + d;
      if (xx < left || xx > right) continue;
      if (smooth[xx] < v) {
        isMin = false;
        break;
      }
      if (smooth[xx] > windowMax) windowMax = smooth[xx];
    }
    if (!isMin || windowMax - v < prominence) continue;
    if (gaps.length === 0 || x - gaps[gaps.length - 1] >= minSep) gaps.push(x);
  }

  // linha média: vale mais próximo da linha média facial (ou a própria se não houver vale perto)
  let mid = midlineX;
  let best = Infinity;
  for (const g of gaps) {
    const d = Math.abs(g - midlineX);
    if (d < best && d < width * 0.12) {
      best = d;
      mid = g;
    }
  }
  const leftGaps = gaps.filter((g) => g < mid - minSep).sort((a, b) => b - a); // do meio para fora
  const rightGaps = gaps.filter((g) => g > mid + minSep).sort((a, b) => a - b);

  const widths: Partial<Record<string, number>> = {};
  const chain = (list: number[], fdis: string[], edge: number) => {
    let prev = mid;
    for (let i = 0; i < fdis.length; i++) {
      const next = list[i] ?? (i === fdis.length - 1 ? edge : undefined);
      if (next === undefined) break;
      widths[fdis[i]] = Math.abs(next - prev);
      prev = next;
    }
  };
  chain(leftGaps, ['11', '12', '13'], left);
  chain(rightGaps, ['21', '22', '23'], right);

  // gengiva e incisal: média nas colunas dos centrais (±1/2 largura do central em volta da linha média)
  const cw = widths['11'] && widths['21'] ? (widths['11'] + widths['21']) / 2 : widths['11'] ?? widths['21'] ?? width * 0.12;
  let gSum = 0;
  let iSum = 0;
  let k = 0;
  for (let x = Math.max(0, Math.round(mid - cw)); x <= Math.min(width - 1, Math.round(mid + cw)); x++) {
    if (top[x] < 0) continue;
    gSum += top[x];
    iSum += bottom[x];
    k++;
  }
  if (!k) return null;
  const found = ['11', '12', '21', '22'].filter((f) => widths[f] !== undefined).length + (gaps.includes(mid) ? 1 : 0);
  return { midlineX: mid, gumY: gSum / k, incisalY: iSum / k, gaps: [left, ...gaps, right], widths, confidence: found / 5 };
}

/**
 * Converte o resultado (px do recorte) em parâmetros do Smile Design (frações da imagem inteira).
 * `crop` é a posição do recorte na imagem (px) e `imageW/H` o tamanho da imagem.
 */
export function autoFitToParams(fit: AutoFit, crop: { x: number; y: number; scale: number }, imageW: number, imageH: number, base: SmileParams): SmileParams {
  const toX = (px: number) => (crop.x + px / crop.scale) / imageW;
  const toY = (py: number) => (crop.y + py / crop.scale) / imageH;
  const cwPx = fit.widths['11'] && fit.widths['21'] ? (fit.widths['11'] + fit.widths['21']) / 2 : (fit.widths['11'] ?? fit.widths['21'] ?? 0);
  const centralWidth = cwPx ? cwPx / crop.scale / imageW : base.centralWidth;
  const hPx = fit.incisalY - fit.gumY;
  const heightRatio = cwPx && hPx > 0 ? Math.min(1.6, Math.max(0.8, hPx / cwPx)) : base.heightRatio;
  const edits: Record<string, ToothEdit> = {};
  const ratioFor: Record<string, number> = { '12': 0.78, '13': 0.74, '22': 0.78, '23': 0.74 };
  for (const fdi of Object.keys(ratioFor)) {
    const w = fit.widths[fdi];
    if (!w || !cwPx) continue;
    const sw = Math.min(1.6, Math.max(0.5, w / (cwPx * ratioFor[fdi])));
    if (Math.abs(sw - 1) > 0.08) edits[fdi] = { ...NO_EDIT, sw };
  }
  return {
    ...base,
    midlineX: toX(fit.midlineX),
    gumY: toY(fit.gumY),
    centralWidth,
    heightRatio,
    spacing: 0.01,
    edits: Object.keys(edits).length ? edits : undefined,
  };
}
