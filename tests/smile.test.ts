import { describe, expect, it } from 'vitest';
import { DEFAULT_SMILE_PARAMS, layoutTeeth, toothPath, WIDTH_RATIOS } from '@/lib/smile/teeth';

describe('layoutTeeth', () => {
  const W = 1000;
  const H = 1000;

  it('gera os seis anteriores em ordem 13..23', () => {
    const teeth = layoutTeeth(DEFAULT_SMILE_PARAMS, W, H);
    expect(teeth.map((t) => t.fdi)).toEqual(['13', '12', '11', '21', '22', '23']);
  });

  it('é simétrico em relação à linha média', () => {
    const teeth = layoutTeeth(DEFAULT_SMILE_PARAMS, W, H);
    const mid = DEFAULT_SMILE_PARAMS.midlineX * W;
    const t11 = teeth.find((t) => t.fdi === '11')!;
    const t21 = teeth.find((t) => t.fdi === '21')!;
    expect(mid - (t11.x + t11.w)).toBeCloseTo(t21.x - mid, 6);
    expect(t11.w).toBeCloseTo(t21.w, 6);
    expect(t11.y).toBeCloseTo(t21.y, 6);
  });

  it('respeita a proporção áurea', () => {
    const teeth = layoutTeeth({ ...DEFAULT_SMILE_PARAMS, proportion: 'golden' }, W, H);
    const w = (fdi: string) => teeth.find((t) => t.fdi === fdi)!.w;
    expect(w('12') / w('11')).toBeCloseTo(WIDTH_RATIOS.golden.lateral, 6);
    expect(w('13') / w('11')).toBeCloseTo(WIDTH_RATIOS.golden.canine, 6);
  });

  it('dentes não se sobrepõem', () => {
    const teeth = layoutTeeth(DEFAULT_SMILE_PARAMS, W, H);
    for (let i = 1; i < teeth.length; i++) {
      expect(teeth[i].x).toBeGreaterThanOrEqual(teeth[i - 1].x + teeth[i - 1].w - 1e-6);
    }
  });

  it('curva do sorriso eleva caninos mais que laterais', () => {
    const teeth = layoutTeeth({ ...DEFAULT_SMILE_PARAMS, curve: 0.2 }, W, H);
    const y = (fdi: string) => teeth.find((t) => t.fdi === fdi)!.y;
    expect(y('13')).toBeLessThan(y('12'));
  });
});

describe('toothPath', () => {
  it('produz um caminho fechado para cada forma e tipo', () => {
    for (const shape of ['oval', 'square', 'triangular'] as const) {
      for (const kind of ['central', 'lateral', 'canine'] as const) {
        const d = toothPath(10, 20, 80, 100, shape, kind);
        expect(d.startsWith('M ')).toBe(true);
        expect(d.endsWith('Z')).toBe(true);
        expect(d).not.toMatch(/NaN/);
      }
    }
  });
});
