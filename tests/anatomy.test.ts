import { describe, expect, it } from 'vitest';
import { layoutAnatomy, type AnatomyDef } from '@/lib/smile/anatomy';
import { DEFAULT_SMILE_PARAMS, WIDTH_RATIOS } from '@/lib/smile/teeth';

// anatomia fictícia com medidas parecidas com as reais (mm)
const tooth = (wMm: number, hMm: number, offsetX: number, offsetY: number) => ({
  width: Math.round(wMm * 30),
  height: Math.round(hMm * 30),
  wMm,
  hMm,
  offsetX,
  offsetY,
  fill: 1,
  shade: 2,
  gloss: 3,
});
const DEF: AnatomyDef = {
  id: 'teste',
  name: 'Teste',
  shape: 'oval',
  thumb: 0,
  teeth: {
    central: tooth(8.5, 11, 0, 0),
    lateral: tooth(6.5, 9.5, -6.6, 0.8),
    canine: tooth(5, 10.5, -11.2, 0),
  },
};

const W = 1000;
const H = 800;

describe('layoutAnatomy', () => {
  it('gera os seis anteriores em ordem 13..23 com o central na largura pedida', () => {
    const teeth = layoutAnatomy(DEFAULT_SMILE_PARAMS, DEF, W, H);
    expect(teeth.map((t) => t.fdi)).toEqual(['13', '12', '11', '21', '22', '23']);
    const t11 = teeth.find((t) => t.fdi === '11')!;
    expect(t11.w).toBeCloseTo(DEFAULT_SMILE_PARAMS.centralWidth * W, 6);
    expect(t11.h).toBeCloseTo(t11.w * DEFAULT_SMILE_PARAMS.heightRatio, 6);
    expect(t11.y).toBeCloseTo(DEFAULT_SMILE_PARAMS.gumY * H, 6);
  });

  it('é simétrico em relação à linha média e espelha o lado esquerdo', () => {
    const teeth = layoutAnatomy(DEFAULT_SMILE_PARAMS, DEF, W, H);
    const mid = DEFAULT_SMILE_PARAMS.midlineX * W;
    for (const k of ['1', '2', '3']) {
      const r = teeth.find((t) => t.fdi === `1${k}`)!;
      const l = teeth.find((t) => t.fdi === `2${k}`)!;
      expect(mid - (r.x + r.w)).toBeCloseTo(l.x - mid, 6);
      expect(r.w).toBeCloseTo(l.w, 6);
      expect(r.y).toBeCloseTo(l.y, 6);
      expect(r.side).toBe('right');
      expect(l.side).toBe('left');
    }
  });

  it('proporção natural segue as larguras da biblioteca, lado a lado por contato', () => {
    const teeth = layoutAnatomy({ ...DEFAULT_SMILE_PARAMS, spacing: 0 }, DEF, W, H);
    const t11 = teeth.find((t) => t.fdi === '11')!;
    const t12 = teeth.find((t) => t.fdi === '12')!;
    const t13 = teeth.find((t) => t.fdi === '13')!;
    const s = t11.w / DEF.teeth.central.wMm;
    expect(t12.w).toBeCloseTo(DEF.teeth.lateral.wMm * s, 6);
    expect(t12.x + t12.w).toBeCloseTo(t11.x, 6); // contato, sem sobreposição
    expect(t13.x + t13.w).toBeCloseTo(t12.x, 6);
    expect(t12.y).toBeGreaterThan(t11.y); // zênite do lateral mais baixo
  });

  it('ajuste individual desloca, escala e gira só o dente editado', () => {
    const edits = { '12': { dx: 0.2, dy: 0.1, sw: 1.2, sh: 0.9, rot: 8 } };
    const base = layoutAnatomy(DEFAULT_SMILE_PARAMS, DEF, W, H);
    const edited = layoutAnatomy({ ...DEFAULT_SMILE_PARAMS, edits }, DEF, W, H);
    const b12 = base.find((t) => t.fdi === '12')!;
    const e12 = edited.find((t) => t.fdi === '12')!;
    const cw = DEFAULT_SMILE_PARAMS.centralWidth * W;
    expect(e12.w).toBeCloseTo(b12.w * 1.2, 6);
    expect(e12.h).toBeCloseTo(b12.h * 0.9, 6);
    expect(e12.x + e12.w / 2).toBeCloseTo(b12.x + b12.w / 2 + 0.2 * cw, 6);
    expect(e12.y).toBeGreaterThan(b12.y);
    expect(e12.rot).toBe(8);
    // o vizinho não muda
    const b13 = base.find((t) => t.fdi === '13')!;
    const e13 = edited.find((t) => t.fdi === '13')!;
    expect(e13.x).toBeCloseTo(b13.x, 6);
    expect(e13.rot).toBe(0);
  });

  it('proporção áurea força 62% e 38% da largura do central', () => {
    const teeth = layoutAnatomy({ ...DEFAULT_SMILE_PARAMS, proportion: 'golden' }, DEF, W, H);
    const w = (fdi: string) => teeth.find((t) => t.fdi === fdi)!.w;
    expect(w('12') / w('11')).toBeCloseTo(WIDTH_RATIOS.golden.lateral, 6);
    expect(w('13') / w('11')).toBeCloseTo(WIDTH_RATIOS.golden.canine, 6);
  });

  it('espaçamento afasta os vizinhos e curva do sorriso eleva os caninos', () => {
    const base = layoutAnatomy({ ...DEFAULT_SMILE_PARAMS, spacing: 0, curve: 0 }, DEF, W, H);
    const spaced = layoutAnatomy({ ...DEFAULT_SMILE_PARAMS, spacing: 0.1, curve: 0.2 }, DEF, W, H);
    const x = (list: typeof base, fdi: string) => list.find((t) => t.fdi === fdi)!;
    expect(x(spaced, '13').x).toBeLessThan(x(base, '13').x);
    expect(x(spaced, '13').y).toBeLessThan(x(base, '13').y);
    expect(x(spaced, '11').y).toBeCloseTo(x(base, '11').y, 6);
  });
});
