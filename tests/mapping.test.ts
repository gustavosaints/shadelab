import { describe, expect, it } from 'vitest';
import { buildDesignPrompt, TOOTH_SHAPES } from '@/lib/ai/prompt';
import { getSystem } from '@/lib/color/shades';
import {
  applyLength,
  bumpLength,
  commonLength,
  describeLengths,
  layoutMapped,
  MAPPED_TEETH,
  mirrorLabels,
  silhouette,
  type ToothMap,
} from '@/lib/smile/mapping';

describe('mapeamento dos dentes 15–25', () => {
  const teeth = layoutMapped(500, 300, 80, 1.2);

  it('posiciona os 10 dentes em ordem, 1x à esquerda da foto e 2x à direita', () => {
    expect(teeth.map((t) => t.fdi)).toEqual(['15', '14', '13', '12', '11', '21', '22', '23', '24', '25']);
    for (let i = 1; i < teeth.length; i++) expect(teeth[i].x).toBeGreaterThan(teeth[i - 1].x);
    const c11 = teeth.find((t) => t.fdi === '11')!;
    const c21 = teeth.find((t) => t.fdi === '21')!;
    expect(c11.x + c11.w).toBeLessThanOrEqual(500);
    expect(c21.x).toBeGreaterThanOrEqual(500);
  });

  it('larguras diminuem do central ao segundo pré-molar e a incisal sobe para trás', () => {
    const right = ['11', '12', '13', '14', '15'].map((f) => teeth.find((t) => t.fdi === f)!);
    expect(right[0].w).toBeGreaterThan(right[1].w);
    expect(right[3].w).toBeGreaterThan(right[4].w);
    expect(right[4].y + right[4].h).toBeLessThan(right[0].y + right[0].h);
  });

  it('silhueta é um caminho SVG fechado para cada forma', () => {
    for (const sh of TOOTH_SHAPES) for (const t of teeth) expect(silhouette(t, sh.mix)).toMatch(/^M .* Z$/);
  });

  it('foto espelhada troca os números de lado', () => {
    const map: ToothMap = { teeth, pxPerMm: 10, source: 'boca' };
    expect(mirrorLabels(map).teeth[0].fdi).toBe('25');
  });
});

describe('comprimento em mm', () => {
  it('incisal alonga para baixo; cervical alonga para cima', () => {
    const t = layoutMapped(500, 300, 80, 1.2).find((x) => x.fdi === '11')!;
    const inc = applyLength(t, { incisal: 1, cervical: 0 }, 10);
    expect(inc.y).toBe(t.y);
    expect(inc.h).toBeCloseTo(t.h + 10);
    const cerv = applyLength(t, { incisal: 0, cervical: 1 }, 10);
    expect(cerv.y).toBeCloseTo(t.y - 10);
    expect(cerv.y + cerv.h).toBeCloseTo(t.y + t.h);
  });

  it('todos ou um por um, de 0,5 em 0,5 mm, limitado a ±3 mm', () => {
    let e = bumpLength({}, MAPPED_TEETH, 'incisal', 0.5);
    expect(commonLength(e, MAPPED_TEETH, 'incisal')).toBe(0.5);
    e = bumpLength(e, ['11'], 'incisal', 0.5);
    expect(commonLength(e, MAPPED_TEETH, 'incisal')).toBeNull();
    expect(e['11']?.incisal).toBe(1);
    for (let k = 0; k < 10; k++) e = bumpLength(e, ['11'], 'cervical', -0.5);
    expect(e['11']?.cervical).toBe(-3);
    const zero = bumpLength(bumpLength({}, ['21'], 'incisal', 0.5), ['21'], 'incisal', -0.5);
    expect(zero['21']).toBeUndefined();
  });

  it('descreve os ajustes para a IA, agrupando dentes iguais', () => {
    expect(describeLengths({})).toBe('');
    const all = bumpLength({}, MAPPED_TEETH, 'incisal', 1);
    expect(describeLengths(all)).toMatch(/all upper teeth from 15 to 25: incisal edge lengthened by 1 mm/);
    const some = bumpLength(bumpLength({}, ['11', '21'], 'incisal', 1), ['12'], 'cervical', 0.5);
    const d = describeLengths(some);
    expect(d).toMatch(/tooth 11, 21: incisal edge lengthened by 1 mm/);
    expect(d).toMatch(/tooth 12: gingival margin moved 0.5 mm apically/);
  });

  it('a instrução da IA inclui os ajustes quando há', () => {
    const b1 = getSystem('vita-classical').shades.find((s) => s.id === 'B1')!;
    const lengths = describeLengths(bumpLength({}, ['11'], 'incisal', 1));
    const p = buildDesignPrompt({ shape: 'quadrado', texture: 'natural', gum: 'manter', shadeId: 'B1', shadeLab: b1.lab, lengths });
    expect(p).toContain(lengths);
    expect(p).not.toMatch(/\n/);
  });
});
