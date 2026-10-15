import { describe, expect, it } from 'vitest';
import { DEFAULT_SMILE_PARAMS, layoutTeeth, mixedShapePoints, SHAPE_MIX, shapeFromMix, toothPath } from '@/lib/smile/teeth';

describe('barra contínua de forma', () => {
  it('nos extremos e no meio coincide com as formas nominais', () => {
    for (const kind of ['central', 'lateral', 'canine'] as const) {
      expect(toothPath(0, 0, 100, 120, SHAPE_MIX.square, kind, 'right')).toBe(toothPath(0, 0, 100, 120, 'square', kind, 'right'));
      expect(toothPath(0, 0, 100, 120, SHAPE_MIX.oval, kind, 'right')).toBe(toothPath(0, 0, 100, 120, 'oval', kind, 'right'));
      expect(toothPath(0, 0, 100, 120, SHAPE_MIX.triangular, kind, 'right')).toBe(toothPath(0, 0, 100, 120, 'triangular', kind, 'right'));
    }
  });

  it('muda suavemente: passos pequenos na barra movem os pontos pouco', () => {
    const maxStep = (a: number, b: number) => {
      const pa = mixedShapePoints('central', a);
      const pb = mixedShapePoints('central', b);
      return Math.max(...pa.map(([x, y], i) => Math.hypot(pb[i][0] - x, pb[i][1] - y)));
    };
    for (let m = 0; m < 1; m += 0.05) expect(maxStep(m, m + 0.05)).toBeLessThan(0.06);
  });

  it('rótulo da forma segue a posição da barra e o layout usa shapeMix', () => {
    expect(shapeFromMix(0.1)).toBe('square');
    expect(shapeFromMix(0.5)).toBe('oval');
    expect(shapeFromMix(0.9)).toBe('triangular');
    const a = layoutTeeth({ ...DEFAULT_SMILE_PARAMS, shape: 'oval', shapeMix: 0 }, 1000, 1000);
    const b = layoutTeeth({ ...DEFAULT_SMILE_PARAMS, shape: 'square' }, 1000, 1000);
    expect(a[0].d).toBe(b[0].d);
  });
});
