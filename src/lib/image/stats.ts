import {
  linearChannelToSrgb,
  rgbToLab,
  srgbChannelToLinear,
  type Lab,
  type RGB,
} from '@/lib/color/convert';

export type Rect = { x: number; y: number; width: number; height: number };

export type Sample = {
  rgb: RGB;
  lab: Lab;
  /** Nº de pixels usados após remover extremos (brilho especular / sombra). */
  pixels: number;
  /** Desvio padrão da luminância linear: alto = região heterogênea. */
  spread: number;
};


export function clampRect(rect: Rect, imageWidth: number, imageHeight: number): Rect {
  const width = Math.max(4, Math.min(rect.width, imageWidth));
  const height = Math.max(4, Math.min(rect.height, imageHeight));
  const x = Math.max(0, Math.min(rect.x, imageWidth - width));
  const y = Math.max(0, Math.min(rect.y, imageHeight - height));
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

/**
 * Calcula a cor média robusta de uma região da imagem.
 * A média é feita em RGB linear (fisicamente correto), descartando os
 * 15% de pixels mais claros (reflexo) e 15% mais escuros (sombra/borda).
 */
export function averagePixels(rgba: Uint8Array, count: number): Sample {
  const lin = new Float32Array(count * 3);
  const luma = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = srgbChannelToLinear(rgba[i * 4]);
    const g = srgbChannelToLinear(rgba[i * 4 + 1]);
    const b = srgbChannelToLinear(rgba[i * 4 + 2]);
    lin[i * 3] = r;
    lin[i * 3 + 1] = g;
    lin[i * 3 + 2] = b;
    luma[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => luma[a] - luma[b]);
  const lo = Math.floor(count * 0.15);
  const hi = Math.ceil(count * 0.85);
  const kept = order.slice(lo, Math.max(hi, lo + 1));

  let sr = 0;
  let sg = 0;
  let sb = 0;
  let sl = 0;
  let sl2 = 0;
  for (const i of kept) {
    sr += lin[i * 3];
    sg += lin[i * 3 + 1];
    sb += lin[i * 3 + 2];
    sl += luma[i];
    sl2 += luma[i] * luma[i];
  }
  const n = kept.length;
  const meanL = sl / n;
  const spread = Math.sqrt(Math.max(0, sl2 / n - meanL * meanL));
  const rgb: RGB = {
    r: linearChannelToSrgb(sr / n),
    g: linearChannelToSrgb(sg / n),
    b: linearChannelToSrgb(sb / n),
  };
  return { rgb, lab: rgbToLab(rgb), pixels: n, spread };
}

