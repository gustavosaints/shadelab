import { describe, expect, it } from 'vitest';
import { applyToothEdit, clampEdit, DEFAULT_SMILE_PARAMS, layoutTeeth, mirrorEdit, mirrorFdi, NO_EDIT } from '@/lib/smile/teeth';

describe('ajuste dente a dente', () => {
  it('sem ajuste mantém a caixa e rotação zero', () => {
    const b = applyToothEdit({ x: 10, y: 20, w: 50, h: 60 }, undefined, 100, 120);
    expect(b).toEqual({ x: 10, y: 20, w: 50, h: 60, rot: 0 });
  });

  it('muda a largura mantendo o centro e o comprimento mantendo a linha cervical', () => {
    const b = applyToothEdit({ x: 10, y: 20, w: 50, h: 60 }, { ...NO_EDIT, sw: 1.5, sh: 0.5 }, 100, 120);
    expect(b.x + b.w / 2).toBeCloseTo(35, 6);
    expect(b.w).toBeCloseTo(75, 6);
    expect(b.y).toBe(20);
    expect(b.h).toBeCloseTo(30, 6);
  });

  it('desloca em frações do central e devolve a rotação', () => {
    const b = applyToothEdit({ x: 10, y: 20, w: 50, h: 60 }, { ...NO_EDIT, dx: 0.1, dy: -0.25, rot: -12 }, 100, 120);
    expect(b.x).toBeCloseTo(20, 6);
    expect(b.y).toBeCloseTo(-10, 6);
    expect(b.rot).toBe(-12);
  });

  it('espelha deslocamento horizontal e rotação', () => {
    expect(mirrorEdit({ dx: 0.2, dy: 0.1, sw: 1.1, sh: 0.9, rot: 7 })).toEqual({ dx: -0.2, dy: 0.1, sw: 1.1, sh: 0.9, rot: -7 });
    expect(mirrorFdi('12')).toBe('22');
    expect(mirrorFdi('23')).toBe('13');
  });

  it('limita os valores a faixas seguras', () => {
    expect(clampEdit({ dx: 5, dy: -5, sw: 0, sh: 9, rot: 90 })).toEqual({ dx: 1, dy: -1, sw: 0.5, sh: 1.6, rot: 30 });
  });

  it('no modo contorno a rotação vai para o dente e o vizinho continua encostado na posição base', () => {
    const edits = { '11': { ...NO_EDIT, rot: 5, dx: 0.3 } };
    const base = layoutTeeth(DEFAULT_SMILE_PARAMS, 1000, 1000);
    const out = layoutTeeth({ ...DEFAULT_SMILE_PARAMS, edits }, 1000, 1000);
    expect(out.find((t) => t.fdi === '11')!.rot).toBe(5);
    expect(out.find((t) => t.fdi === '12')!.x).toBeCloseTo(base.find((t) => t.fdi === '12')!.x, 6);
    expect(out.find((t) => t.fdi === '21')!.rot).toBe(0);
  });
});

describe('forma por dente', () => {
  it('um dente com forma própria muda só o próprio contorno', async () => {
    const { layoutTeeth, DEFAULT_SMILE_PARAMS, NO_EDIT } = await import('@/lib/smile/teeth');
    const base = layoutTeeth(DEFAULT_SMILE_PARAMS, 1000, 800);
    const edited = layoutTeeth({ ...DEFAULT_SMILE_PARAMS, edits: { '11': { ...NO_EDIT, shape: 1 } } }, 1000, 800);
    const d = (list: typeof base, fdi: string) => list.find((t) => t.fdi === fdi)!.d;
    expect(d(edited, '11')).not.toBe(d(base, '11'));
    expect(d(edited, '21')).toBe(d(base, '21'));
  });
});
