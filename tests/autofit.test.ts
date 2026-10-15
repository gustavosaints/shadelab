import { describe, expect, it } from 'vitest';
import { autoFitTeeth, autoFitToParams, insidePolygon, type Rgba } from '@/lib/smile/autofit';
import { checkFraming, faceBoxFromLandmarks, facePointsFromLandmarks, isMirrored, LANDMARK_COUNT, mouthFromLandmarks, IDX } from '@/lib/face/landmarks';
import { DEFAULT_SMILE_PARAMS } from '@/lib/smile/teeth';

/** Boca sintética: fundo escuro, 6 retângulos claros (dentes) separados por frestas escuras, dentro de um polígono. */
function syntheticMouth(): { img: Rgba; mouth: { x: number; y: number }[]; widths: number[]; gapXs: number[] } {
  const W = 300;
  const H = 120;
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) data.set([40, 20, 20, 255], i * 4); // boca escura/avermelhada
  const widths = [26, 36, 44, 44, 36, 26]; // 13 12 11 21 22 23 (px)
  const gap = 3;
  const total = widths.reduce((a, b) => a + b, 0) + gap * 5;
  let x = Math.round((W - total) / 2);
  const gapXs: number[] = [];
  const top = 30;
  widths.forEach((w, k) => {
    const h = k === 2 || k === 3 ? 52 : k === 1 || k === 4 ? 46 : 50;
    for (let yy = top; yy < top + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        const i = yy * W + xx;
        data.set([235, 228, 212, 255], i * 4); // esmalte
      }
    if (k < 5) gapXs.push(x + w + 1);
    x += w + gap;
  });
  // polígono da boca: retângulo folgado em volta dos dentes
  const mouth = [
    { x: 10, y: 15 },
    { x: W / 2, y: 10 },
    { x: W - 10, y: 15 },
    { x: W - 10, y: 105 },
    { x: W / 2, y: 112 },
    { x: 10, y: 105 },
  ];
  return { img: { data, width: W, height: H }, mouth, widths, gapXs };
}

describe('autoFitTeeth', () => {
  it('ponto em polígono', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(insidePolygon(5, 5, sq)).toBe(true);
    expect(insidePolygon(15, 5, sq)).toBe(false);
  });

  it('encontra linha média, frestas, gengiva e incisal numa boca sintética', () => {
    const { img, mouth, widths, gapXs } = syntheticMouth();
    const fit = autoFitTeeth(img, mouth, img.width / 2 + 4);
    expect(fit).not.toBeNull();
    const f = fit!;
    expect(Math.abs(f.midlineX - gapXs[2])).toBeLessThanOrEqual(2);
    expect(f.gumY).toBeCloseTo(30, 0);
    expect(f.incisalY).toBeGreaterThan(75);
    expect(f.widths['11']).toBeGreaterThan(widths[2] - 6);
    expect(f.widths['11']).toBeLessThan(widths[2] + 6);
    expect(f.widths['12']).toBeGreaterThan(widths[1] - 6);
    expect(f.widths['22']).toBeLessThan(widths[4] + 6);
    expect(f.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('converte para parâmetros em frações da imagem inteira', () => {
    const { img, mouth } = syntheticMouth();
    const fit = autoFitTeeth(img, mouth, img.width / 2 + 4)!;
    const p = autoFitToParams(fit, { x: 100, y: 200, scale: 1 }, 1000, 800, DEFAULT_SMILE_PARAMS);
    expect(p.midlineX).toBeCloseTo((100 + fit.midlineX) / 1000, 6);
    expect(p.gumY).toBeCloseTo((200 + fit.gumY) / 800, 6);
    expect(p.centralWidth).toBeCloseTo(44 / 1000, 1);
    expect(p.heightRatio).toBeGreaterThan(1);
  });

  it('devolve null quando não há dentes', () => {
    const W = 100;
    const H = 60;
    const data = new Uint8Array(W * H * 4).fill(30);
    const mouth = [
      { x: 5, y: 5 },
      { x: 95, y: 5 },
      { x: 95, y: 55 },
      { x: 5, y: 55 },
    ];
    expect(autoFitTeeth({ data, width: W, height: H }, mouth, 50)).toBeNull();
  });
});

describe('marcos faciais → app', () => {
  const lm = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5 }));
  lm[IDX.innerCornerR] = { x: 0.4, y: 0.7 };
  lm[IDX.innerCornerL] = { x: 0.6, y: 0.7 };
  lm[IDX.innerUpperR] = { x: 0.45, y: 0.68 };
  lm[IDX.innerUpperMid] = { x: 0.5, y: 0.67 };
  lm[IDX.innerUpperL] = { x: 0.55, y: 0.68 };
  lm[IDX.innerLowerL] = { x: 0.55, y: 0.73 };
  lm[IDX.innerLowerMid] = { x: 0.5, y: 0.74 };
  lm[IDX.innerLowerR] = { x: 0.45, y: 0.73 };
  lm[IDX.irisR] = { x: 0.4, y: 0.3 };
  lm[IDX.irisL] = { x: 0.6, y: 0.3 };
  lm[IDX.glabella] = { x: 0.5, y: 0.27 };
  lm[IDX.philtrum] = { x: 0.5, y: 0.62 };
  lm[IDX.mouthCornerR] = { x: 0.38, y: 0.7 };
  lm[IDX.mouthCornerL] = { x: 0.62, y: 0.7 };
  lm[IDX.chin] = { x: 0.5, y: 0.9 };
  lm[10] = { x: 0.5, y: 0.1 }; // topo da testa

  it('boca com 8 pontos começando pela esquerda da imagem, inclusive em foto espelhada', () => {
    const m = mouthFromLandmarks(lm);
    expect(m).toHaveLength(8);
    expect(m[0].x).toBeLessThan(m[4].x);
    expect(m[2]).toEqual({ x: 0.5, y: 0.67 });
    const mirrored = lm.map((p) => ({ x: 1 - p.x, y: p.y }));
    expect(isMirrored(mirrored)).toBe(true);
    const mm = mouthFromLandmarks(mirrored);
    expect(mm[0].x).toBeLessThan(mm[4].x);
  });

  it('face-bow: pupilas, glabela, filtro, comissuras', () => {
    const f = facePointsFromLandmarks(lm);
    expect(f.pupilR.x).toBeLessThan(f.pupilL.x);
    expect(f.glabella.y).toBeLessThan(f.philtrum.y);
    expect(f.centralsDistalR.x).toBeLessThan(f.centralsDistalL.x);
  });

  it('enquadramento: rosto centralizado passa, rosto pequeno não', () => {
    const box = faceBoxFromLandmarks(lm);
    expect(box.mouthOpen).toBeGreaterThan(0.012);
    const small = { ...box, w: 0.2 };
    expect(checkFraming(small).ok).toBe(false);
    expect(checkFraming(small).issues).toContain('Aproxime a câmera');
  });
});
