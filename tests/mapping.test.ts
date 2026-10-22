import { describe, expect, it } from 'vitest';
import { buildDesignPrompt, TOOTH_SHAPES } from '@/lib/ai/prompt';
import { getSystem } from '@/lib/color/shades';
import {
  applyLength,
  archTeeth,
  clampArch,
  DEFAULT_ARCH,
  describeArch,
  dragArch,
  bumpLength,
  commonLength,
  describeLengths,
  setToothEdit,
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
    const map: ToothMap = { base: { midX: 500, gumY: 300, centralW: 80, heightRatio: 1.2, widthScale: {} }, pxPerMm: 10, source: 'boca', mirrored: false };
    expect(archTeeth(map)[0].fdi).toBe('15');
    expect(archTeeth(mirrorLabels(map))[0].fdi).toBe('25');
  });
});

describe('arco: fechar/abrir, subir/descer e proporção áurea', () => {
  const map: ToothMap = { base: { midX: 500, gumY: 300, centralW: 85, heightRatio: 1.2, widthScale: { '12': 1.2 } }, pxPerMm: 10, source: 'autofit', mirrored: false };
  const get = (teeth: ReturnType<typeof archTeeth>, f: string) => teeth.find((t) => t.fdi === f)!;

  it('fechar o arco estreita as larguras sem mudar a altura', () => {
    const base = archTeeth(map);
    const closed = archTeeth(map, { ...DEFAULT_ARCH, centralMm: 7.5 });
    expect(get(closed, '11').w).toBeCloseTo((get(base, '11').w * 7.5) / 8.5);
    expect(get(closed, '11').h).toBeCloseTo(get(base, '11').h);
  });

  it('descer o arco move todos os dentes para baixo em mm', () => {
    const down = archTeeth(map, { ...DEFAULT_ARCH, dyMm: 1 });
    expect(get(down, '13').y).toBeCloseTo(get(archTeeth(map), '13').y + 10);
  });

  it('proporção áurea: lateral = 0,618 do central e canino = 0,618 do lateral, ignorando a medida da foto', () => {
    const g = archTeeth(map, { ...DEFAULT_ARCH, golden: true, centralMm: 9 });
    expect(get(g, '12').w / get(g, '11').w).toBeCloseTo(0.618, 3);
    expect(get(g, '13').w / get(g, '12').w).toBeCloseTo(0.618, 2);
    expect(get(g, '22').w).toBeCloseTo(get(g, '12').w);
  });

  it('limites e descrição para a IA', () => {
    expect(clampArch({ ...DEFAULT_ARCH, centralMm: 20, dyMm: -9, open: 3 })).toEqual({ ...DEFAULT_ARCH, centralMm: 11, dyMm: -6, open: 1 });
    expect(describeArch(DEFAULT_ARCH)).toBe('');
    const d = describeArch({ ...DEFAULT_ARCH, centralMm: 8, dyMm: 1, golden: true, open: -0.5, curveMm: 1 });
    expect(d).toMatch(/GOLDEN PROPORTION/);
    expect(d).toMatch(/8 mm wide/);
    expect(d).toMatch(/1 mm lower/);
    expect(d).toMatch(/close the arch/);
    expect(d).toMatch(/more convex smile curve/);
  });

  it('alças: mover, largura simétrica e alça distal (abre para fora, curva para cima)', () => {
    const moved = dragArch(DEFAULT_ARCH, 'move', 20, -10, 10, 600);
    expect(moved.dxMm).toBeCloseTo(2);
    expect(moved.dyMm).toBeCloseTo(-1);
    const wider = dragArch(DEFAULT_ARCH, 'widthL', -30, 0, 10, 600); // esquerda para fora
    expect(wider.centralMm).toBeCloseTo(8.5 * 1.1);
    const narrower = dragArch(DEFAULT_ARCH, 'widthR', -30, 0, 10, 600); // direita para dentro
    expect(narrower.centralMm).toBeCloseTo(8.5 * 0.9);
    const opened = dragArch(DEFAULT_ARCH, 'distalR', 75, -20, 10, 600);
    expect(opened.open).toBeCloseTo(0.5);
    expect(opened.curveMm).toBeCloseTo(2);
    const base = archTeeth(map);
    const op = archTeeth(map, opened);
    expect(get(op, '15').w).toBeGreaterThan(get(base, '15').w);
    expect(get(op, '11').w).toBeCloseTo(get(base, '11').w);
    expect(get(op, '15').y).toBeLessThan(get(base, '15').y);
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

describe('delimitar a boca à mão', () => {
  it('contorno inicial no centro, cantos nas pontas e mapa dos dentes cabendo entre eles', async () => {
    const { centeredMouth, mouthBounds, mouthCrop } = await import('@/lib/smile/mouth');
    const { archTeeth: arch, mapFromMouth } = await import('@/lib/smile/mapping');
    const m = centeredMouth(4000, 3000);
    expect(m).toHaveLength(8);
    const b = mouthBounds(m, 4000, 3000);
    expect(b.centerX).toBeCloseTo(2000);
    expect(b.widthPx).toBeCloseTo(2000);
    const map = mapFromMouth(m, 4000, 3000);
    const teeth = arch(map);
    const x0 = Math.min(...teeth.map((t) => t.x));
    const x1 = Math.max(...teeth.map((t) => t.x + t.w));
    expect(x0).toBeGreaterThan(2000 - 1000);
    expect(x1).toBeLessThan(2000 + 1000);
    const crop = mouthCrop(m, 4000, 3000);
    expect(crop.w).toBeGreaterThan(2000);
    expect(crop.w).toBeLessThanOrEqual(4000);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.w / crop.h).toBeLessThanOrEqual(2.01);
  });
});

describe('ajuste de um dente direto na silhueta', () => {
  const map: ToothMap = { base: { midX: 500, gumY: 300, centralW: 85, heightRatio: 1.2, widthScale: {} }, pxPerMm: 10, source: 'boca', mirrored: false };
  const get = (teeth: ReturnType<typeof archTeeth>, f: string) => teeth.find((t) => t.fdi === f)!;

  it('largura de um dente empurra os vizinhos de fora, sem mexer no outro lado', () => {
    const e = setToothEdit({}, '12', { width: 1 });
    const base = archTeeth(map);
    const wide = archTeeth(map, DEFAULT_ARCH, e);
    expect(get(wide, '12').w).toBeCloseTo(get(base, '12').w + 10);
    expect(get(wide, '13').x).toBeCloseTo(get(base, '13').x - 10); // vizinho distal se afasta
    expect(get(wide, '22').x).toBeCloseTo(get(base, '22').x);
  });

  it('arrasto livre em 0,1 mm, limitado e some quando zera', () => {
    expect(setToothEdit({}, '11', { incisal: 0.83 })['11']?.incisal).toBe(0.8);
    expect(setToothEdit({}, '11', { cervical: 9 })['11']?.cervical).toBe(3);
    expect(setToothEdit({ '11': { incisal: 1, cervical: 0 } }, '11', { incisal: 0 })['11']).toBeUndefined();
  });

  it('a largura entra na instrução da IA', () => {
    expect(describeLengths(setToothEdit({}, '21', { width: -0.5 }))).toMatch(/tooth 21: visible width reduced by 0.5 mm/);
  });
});
