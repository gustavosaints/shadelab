/**
 * Varredura da foto para achar a abertura da boca SEM o detector de rosto (pedido do Gustavo, 2026-10-22: em foto
 * de sorriso de perto o MediaPipe não acha o rosto). Parte pura, testável.
 *
 * Ideia: a abertura da boca é o que fica entre os lábios — dentes (claros e pouco saturados) e o fundo escuro da
 * boca (entre os dentes e nos cantos). Os lábios e a gengiva são avermelhados e a pele é mais clara que o fundo.
 * 1. Lab de cada pixel numa versão reduzida da foto.
 * 2. Dentes candidatos: claros (perto dos mais claros da foto), pouco croma e não avermelhados.
 * 3. Os dentes vizinhos se juntam (dilatação) e escolhe-se o grupo mais "boca": largo, com vermelho (lábio/
 *    gengiva) logo acima e abaixo, perto do centro.
 * 4. A abertura cresce desse grupo pelos pixels de dente e escuros, sem sair de uma caixa em volta dele
 *    (assim não vaza para a barba ou o fundo), e fecha pequenos buracos.
 * 5. Contorno pelo lado de dentro dos lábios: em cada coluna, o primeiro e o último pixel da abertura; os cantos
 *    são as pontas onde a abertura afina. Saem os 8 pontos do contorno (mesma ordem de `centeredMouth`).
 */
import type { MouthPoint } from './teeth';

export type Rgba = { data: Uint8Array | Uint8ClampedArray; width: number; height: number };

const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const LIN = Array.from({ length: 256 }, (_, i) => lin(i));
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);

/** L*, a*, b* de cada pixel (D65). */
export function labPlanes(img: Rgba): { L: Float32Array; A: Float32Array; B: Float32Array } {
  const n = img.width * img.height;
  const L = new Float32Array(n);
  const A = new Float32Array(n);
  const B = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = LIN[img.data[i * 4]];
    const g = LIN[img.data[i * 4 + 1]];
    const b = LIN[img.data[i * 4 + 2]];
    const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
    const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
    const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
    const fx = f(x);
    const fy = f(y);
    const fz = f(z);
    L[i] = 116 * fy - 16;
    A[i] = 500 * (fx - fy);
    B[i] = 200 * (fy - fz);
  }
  return { L, A, B };
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
}

/** Dilatação (raio r, quadrado) de uma máscara binária. */
function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = -r; k <= r && !v; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w && mask[y * w + xx]) v = 1;
      }
      tmp[y * w + x] = v;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = -r; k <= r && !v; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h && tmp[yy * w + x]) v = 1;
      }
      out[y * w + x] = v;
    }
  return out;
}

function erode(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < inv.length; i++) inv[i] = mask[i] ? 0 : 1;
  const d = dilate(inv, w, h, r);
  for (let i = 0; i < d.length; i++) d[i] = d[i] ? 0 : 1;
  return d;
}

type Comp = { pixels: number[]; x0: number; x1: number; y0: number; y1: number };

/** Componentes conexos (4-vizinhança) de uma máscara. */
function components(mask: Uint8Array, w: number, h: number, minArea: number): Comp[] {
  const seen = new Uint8Array(w * h);
  const out: Comp[] = [];
  const stack: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    const c: Comp = { pixels: [], x0: w, x1: 0, y0: h, y1: 0 };
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      c.pixels.push(p);
      const x = p % w;
      const y = (p - x) / w;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) if (q >= 0 && mask[q] && !seen[q]) {
        seen[q] = 1;
        stack.push(q);
      }
    }
    if (c.pixels.length >= minArea) out.push(c);
  }
  return out;
}

const median = (v: number[]) => percentile(v, 0.5);

export type MouthScan = {
  mouth: MouthPoint[];
  /** Máscara da abertura (para conferência/depuração). */
  mask: Uint8Array;
  /** 0..1: quão parecido com uma boca ficou (vermelho em volta, formato). */
  confidence: number;
};

/** Acha a abertura da boca. Devolve null quando não encontra nada com cara de boca. */
export function scanMouth(img: Rgba): MouthScan | null {
  const { width: w, height: h } = img;
  const n = w * h;
  const { L, A, B } = labPlanes(img);
  const wx0 = Math.round(w * 0.04);
  const wx1 = Math.round(w * 0.96);
  const wy0 = Math.round(h * 0.08);
  const wy1 = Math.round(h * 0.96);

  const window: number[] = [];
  for (let y = wy0; y < wy1; y += 2) for (let x = wx0; x < wx1; x += 2) window.push(L[y * w + x]);
  const tL = Math.max(45, percentile(window, 0.93) - 18);
  const tDark = Math.min(32, percentile(window, 0.06) + 12);

  // 2. dentes candidatos
  const teeth = new Uint8Array(n);
  const dark = new Uint8Array(n);
  for (let y = wy0; y < wy1; y++)
    for (let x = wx0; x < wx1; x++) {
      const i = y * w + x;
      const C = Math.hypot(A[i], B[i]);
      if (L[i] >= tL && C <= 30 && A[i] <= 9 && B[i] >= -6) teeth[i] = 1;
      else if (L[i] <= tDark) dark[i] = 1;
    }

  // 3. junta dentes vizinhos e escolhe o grupo mais "boca"
  const joined = dilate(teeth, w, h, 2);
  const comps = components(joined, w, h, Math.max(30, n * 0.002));
  if (!comps.length) return null;
  const redAround = (c: Comp) => {
    const cw = c.x1 - c.x0;
    const band = Math.max(2, Math.round((c.y1 - c.y0) * 0.35));
    let s = 0;
    let k = 0;
    for (let x = c.x0 + Math.round(cw * 0.2); x <= c.x1 - Math.round(cw * 0.2); x += 2) {
      for (const [ya, yb] of [
        [c.y0 - band, c.y0 - 1],
        [c.y1 + 1, c.y1 + band],
      ]) {
        for (let y = Math.max(0, ya); y <= Math.min(h - 1, yb); y++) {
          s += A[y * w + x];
          k++;
        }
      }
    }
    return k ? s / k : 0;
  };
  let best: Comp | null = null;
  let bestScore = 0;
  let bestRed = 0;
  for (const c of comps) {
    const cw = c.x1 - c.x0 + 1;
    const ch = c.y1 - c.y0 + 1;
    if (cw < w * 0.12 || cw / ch < 1.8) continue;
    const red = redAround(c);
    const cx = (c.x0 + c.x1) / 2 / w - 0.5;
    const cy = (c.y0 + c.y1) / 2 / h - 0.55;
    const central = Math.max(0.2, 1 - Math.hypot(cx, cy) * 1.6);
    // dentes têm escuro entre eles e nos cantos (fundo da boca); um brilho de pele (nariz, testa) não tem
    let darkN = 0;
    let boxN = 0;
    for (let y = c.y0; y <= c.y1; y++)
      for (let x = Math.max(0, c.x0 - Math.round(cw * 0.1)); x <= Math.min(w - 1, c.x1 + Math.round(cw * 0.1)); x++) {
        boxN++;
        if (dark[y * w + x]) darkN++;
      }
    const darkness = Math.min(2, 0.3 + (darkN / Math.max(1, boxN)) * 8);
    const score = c.pixels.length * Math.max(0.5, red) * central * Math.min(4, cw / ch) * darkness;
    if (score > bestScore) {
      bestScore = score;
      best = c;
      bestRed = red;
    }
  }
  if (!best) return null;

  // 4. abertura: cresce pelos dentes e escuros dentro de uma caixa em volta do grupo escolhido
  const bw = best.x1 - best.x0;
  const bh = best.y1 - best.y0;
  const bx0 = Math.max(0, Math.round(best.x0 - bw * 0.25));
  const bx1 = Math.min(w - 1, Math.round(best.x1 + bw * 0.25));
  const by0 = Math.max(0, Math.round(best.y0 - bh * 0.6));
  const by1 = Math.min(h - 1, Math.round(best.y1 + bh * 0.9));
  const open = new Uint8Array(n);
  const stack: number[] = [];
  for (const p of best.pixels) if (teeth[p] || dark[p]) {
    open[p] = 1;
    stack.push(p);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p - x) / w;
    const nb = [x > bx0 ? p - 1 : -1, x < bx1 ? p + 1 : -1, y > by0 ? p - w : -1, y < by1 ? p + w : -1];
    for (const q of nb) if (q >= 0 && !open[q] && (teeth[q] || dark[q])) {
      open[q] = 1;
      stack.push(q);
    }
  }
  // 4b. corredor bucal e dentes de trás (mais escuros e acinzentados que os da frente): nas laterais, cresce também
  // por pixels menos vermelhos que o lábio e mais escuros que a pele, até encontrar o lábio no canto da boca
  const band = (ya: number, yb: number) => {
    const v: number[] = [];
    for (let x = best.x0 + Math.round(bw * 0.3); x <= best.x1 - Math.round(bw * 0.3); x += 2)
      for (let y = Math.max(0, ya); y <= Math.min(h - 1, yb); y++) v.push(y * w + x);
    return v;
  };
  const lipPx = [...band(best.y0 - 4, best.y0 - 2), ...band(best.y1 + 2, best.y1 + 4)];
  const aLip = median(lipPx.map((i) => A[i]));
  const lLip = median(lipPx.map((i) => L[i]));
  const lateral = (x: number) => x < best.x0 + bw * 0.18 || x > best.x1 - bw * 0.18;
  const cy0 = Math.round(best.y0 - bh * 0.15);
  const cy1 = Math.round(best.y1 + bh * 0.25);
  const corridor = (q: number) => {
    const x = q % w;
    const y = (q - x) / w;
    return lateral(x) && y >= cy0 && y <= cy1 && A[q] < aLip - 4 && L[q] < Math.max(tDark + 6, lLip - 2);
  };
  for (let p = 0; p < n; p++) if (open[p]) stack.push(p);
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p - x) / w;
    const nb = [x > bx0 ? p - 1 : -1, x < bx1 ? p + 1 : -1, y > by0 ? p - w : -1, y < by1 ? p + w : -1];
    for (const q of nb) if (q >= 0 && !open[q] && corridor(q)) {
      open[q] = 1;
      stack.push(q);
    }
  }
  const closed = erode(dilate(open, w, h, 2), w, h, 2);

  // 5. contorno interno: topo e base por coluna (mediana móvel), cantos nas pontas
  const top: number[] = new Array(w).fill(-1);
  const bot: number[] = new Array(w).fill(-1);
  for (let x = bx0; x <= bx1; x++) {
    for (let y = by0; y <= by1; y++)
      if (closed[y * w + x]) {
        if (top[x] < 0) top[x] = y;
        bot[x] = y;
      }
  }
  // gengiva à mostra: acima dos dentes há uma faixa rosada e clara antes do lábio (mais escuro). O contorno deve
  // ficar no lábio, então sobe enquanto for gengiva e para onde a claridade cai (começo do lábio).
  const maxUp = Math.max(2, Math.round(bh * 0.32));
  for (let x = best.x0 + Math.round(bw * 0.12); x <= best.x1 - Math.round(bw * 0.12); x++) {
    if (top[x] < 0) continue;
    const ref = L[Math.max(0, top[x] - 2) * w + x];
    let y = top[x] - 1;
    let reds = 0;
    let k = 0;
    while (y > Math.max(0, top[x] - maxUp)) {
      const i = y * w + x;
      if (L[i] < ref - 7) break;
      reds += A[i];
      k++;
      y--;
    }
    if (k >= 2 && y > top[x] - maxUp && reds / k > 9) top[x] = y + 1;
  }
  const cols: number[] = [];
  for (let x = bx0; x <= bx1; x++) if (top[x] >= 0 && bot[x] - top[x] >= 1) cols.push(x);
  if (cols.length < w * 0.06) return null;
  // ignora colunas soltas nas pontas (cantos): começa onde a abertura fica contínua
  const xs = cols[0];
  const xe = cols[cols.length - 1];
  // janela de ~6 % da largura da boca: a papila entre os dentes e os sulcos não puxam o contorno para dentro
  const win = Math.max(3, Math.round((xe - xs) * 0.06));
  const smooth = (arr: number[], x: number, p = 0.5) => {
    const v: number[] = [];
    for (let k = -win; k <= win; k++) if (arr[x + k] >= 0) v.push(arr[x + k]);
    return v.length ? percentile(v, p) : arr[x];
  };
  const at = (fx: number) => Math.round(xs + (xe - xs) * fx);
  const colOk = (x: number) => {
    let k = x;
    while (k <= xe && top[k] < 0) k++;
    return k;
  };
  const upper = (fx: number) => {
    const x = colOk(at(fx));
    return { x, y: smooth(top, x, 0.2) - 0.5 };
  };
  const lower = (fx: number) => {
    const x = colOk(at(fx));
    return { x, y: smooth(bot, x, 0.8) + 0.5 };
  };
  const cornerY = (x: number) => (top[x] + bot[x]) / 2;
  const pts = [
    { x: xs - 0.5, y: cornerY(xs) },
    upper(0.2),
    upper(0.5),
    upper(0.8),
    { x: xe + 0.5, y: cornerY(xe) },
    lower(0.8),
    lower(0.5),
    lower(0.2),
  ];
  const mouth = pts.map((p) => ({ x: Math.min(1, Math.max(0, p.x / w)), y: Math.min(1, Math.max(0, p.y / h)) }));
  const confidence = Math.max(0, Math.min(1, (bestRed - 4) / 14));
  return { mouth, mask: closed, confidence };
}
