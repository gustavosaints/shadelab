import { describe, expect, it } from 'vitest';
import {
  alignMidlineToFace,
  analyzeFrame,
  defaultFacePoints,
  frameCurves,
  lineAngleDeg,
  lineXAtY,
  setCentralWidthMm,
  smoothPath,
} from '@/lib/smile/frame';
import { DEFAULT_SMILE_PARAMS } from '@/lib/smile/teeth';

const W = 1000;
const H = 1000;

describe('analyzeFrame', () => {
  it('calibra pixels por mm pela largura dos dois centrais', () => {
    const face = defaultFacePoints();
    // distais a 70 px de distância (0.465 → 0.535) e 17 mm reais
    const a = analyzeFrame(face, 17, DEFAULT_SMILE_PARAMS, W, H);
    expect(a.pxPerMm).toBeCloseTo(70 / 17, 6);
    expect(a.centralWidthMm).toBeCloseTo((DEFAULT_SMILE_PARAMS.centralWidth * W) / a.pxPerMm, 6);
  });

  it('face simétrica e nivelada com linha média na simulação não gera observações de desvio', () => {
    const a = analyzeFrame(defaultFacePoints(), 17, DEFAULT_SMILE_PARAMS, W, H);
    expect(a.bipupillaryDeg).toBeCloseTo(0, 6);
    expect(a.midlineShiftMm).toBeCloseTo(0, 6);
    expect(a.widthHeightPct).toBeCloseTo(100 / DEFAULT_SMILE_PARAMS.heightRatio, 6);
    expect(a.notes.some((n) => n.includes('Linha média'))).toBe(false);
  });

  it('detecta desvio de linha média em mm e o sentido', () => {
    const face = defaultFacePoints();
    const a = analyzeFrame(face, 17, { ...DEFAULT_SMILE_PARAMS, midlineX: 0.5 + 10 / W }, W, H); // 10 px ≈ 2,4 mm
    expect(a.midlineShiftMm).toBeCloseTo(10 / (70 / 17), 6);
    expect(a.notes.some((n) => n.includes('esquerda'))).toBe(true);
  });

  it('detecta foto inclinada pela bipupilar', () => {
    const face = defaultFacePoints();
    face.pupilL = { x: 0.62, y: 0.32 }; // olho esquerdo mais baixo
    const a = analyzeFrame(face, 17, DEFAULT_SMILE_PARAMS, W, H);
    expect(a.bipupillaryDeg).toBeGreaterThan(2);
    expect(a.notes.some((n) => n.includes('inclinada'))).toBe(true);
  });

  it('avisa quando a relação largura/comprimento sai de 70–90%', () => {
    const a = analyzeFrame(defaultFacePoints(), 17, { ...DEFAULT_SMILE_PARAMS, heightRatio: 1.6 }, W, H); // 62%
    expect(a.notes.some((n) => n.includes('largura/comprimento'))).toBe(true);
  });

  it('calibração inválida zera pxPerMm e avisa', () => {
    const a = analyzeFrame(defaultFacePoints(), 0, DEFAULT_SMILE_PARAMS, W, H);
    expect(a.pxPerMm).toBe(0);
    expect(a.notes[0]).toContain('Calibração');
  });
});

describe('geometria', () => {
  it('ângulo e interseção de reta', () => {
    expect(lineAngleDeg({ x: 0, y: 0 }, { x: 1, y: 1 }, 100, 100)).toBeCloseTo(45, 6);
    expect(lineXAtY({ x: 0.5, y: 0 }, { x: 0.6, y: 1 }, 50, 100, 100)).toBeCloseTo(55, 6);
  });

  it('alinha a linha média da simulação à facial inclinada', () => {
    const face = defaultFacePoints();
    face.philtrum = { x: 0.52, y: 0.58 };
    const p = alignMidlineToFace(DEFAULT_SMILE_PARAMS, face, W, H);
    expect(p.midlineX).toBeGreaterThan(0.5);
  });

  it('define a largura do central em mm', () => {
    const p = setCentralWidthMm(DEFAULT_SMILE_PARAMS, defaultFacePoints(), 17, 8.5, W, H);
    expect(p.centralWidth * W).toBeCloseTo(8.5 * (70 / 17), 6);
  });

  it('curvas do smile frame seguem as caixas e papila a 40%', () => {
    const c = frameCurves([
      { fdi: '21', x: 100, y: 50, w: 50, h: 100 },
      { fdi: '11', x: 50, y: 50, w: 50, h: 100 },
    ]);
    expect(c.smile[0]).toEqual({ x: 75, y: 150 });
    expect(c.gingival[1]).toEqual({ x: 125, y: 50 });
    expect(c.papilla[0].y).toBeCloseTo(90, 6);
    expect(smoothPath(c.smile)).toMatch(/^M 75\.0 150\.0 C /);
    expect(smoothPath([])).toBe('');
  });
});
