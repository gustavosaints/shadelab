import { describe, expect, it } from 'vitest';
import { scanMouth } from '@/lib/smile/mouthScan';

/**
 * Boca sintética: pele, lábios avermelhados em volta de uma abertura elíptica, dentes claros com espaços escuros e
 * fundo escuro nos cantos. A varredura deve achar os cantos e as bordas internas dos lábios.
 */
function syntheticSmile(w = 300, h = 220) {
  const data = new Uint8Array(w * h * 4);
  const cx = 150;
  const cy = 120;
  const ax = 90; // meia largura da abertura
  const ay = 28; // meia altura da abertura
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const e = ((x - cx) / ax) ** 2 + ((y - cy) / ay) ** 2;
      const lips = ((x - cx) / (ax + 14)) ** 2 + ((y - cy) / (ay + 16)) ** 2;
      let c = [196, 150, 125]; // pele
      if (lips <= 1) c = [178, 92, 92]; // lábio
      if (e <= 1) {
        const tooth = Math.abs(x - cx) < 70 && y > cy - 22 && y < cy + 14;
        const gap = Math.abs(((x - cx + 1000) % 22) - 11) > 10; // espaço entre dentes
        c = tooth && !gap ? [236, 228, 210] : [40, 26, 28]; // dente ou fundo da boca
      }
      data.set([c[0], c[1], c[2], 255], i);
    }
  return { data, width: w, height: h, cx, cy, ax, ay };
}

describe('varredura da boca sem detector de rosto', () => {
  it('acha a abertura pelo lado de dentro dos lábios, com os cantos', () => {
    const img = syntheticSmile();
    const r = scanMouth(img);
    expect(r).not.toBeNull();
    const pts = r!.mouth.map((p) => ({ x: p.x * img.width, y: p.y * img.height }));
    // cantos (0 e 4) perto das pontas da abertura
    expect(Math.abs(pts[0].x - (img.cx - img.ax))).toBeLessThan(12);
    expect(Math.abs(pts[4].x - (img.cx + img.ax))).toBeLessThan(12);
    // lábio de cima (2) e de baixo (6) no meio, perto das bordas internas
    expect(Math.abs(pts[2].y - (img.cy - img.ay))).toBeLessThan(6);
    expect(Math.abs(pts[6].y - (img.cy + img.ay))).toBeLessThan(6);
    expect(r!.confidence).toBeGreaterThan(0.3);
  });

  it('pele lisa sem boca: não inventa contorno', () => {
    const w = 200;
    const h = 150;
    const data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) data.set([196, 150, 125, 255], i * 4);
    expect(scanMouth({ data, width: w, height: h })).toBeNull();
  });
});
