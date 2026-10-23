import { describe, expect, it } from 'vitest';
import {
  correctWithReference,
  deltaE2000,
  labToRgb,
  matchShade,
  rgbToLab,
  VITA_3D_MASTER,
  VITA_CLASSICAL,
} from '@/lib/color';

describe('conversões sRGB <-> Lab', () => {
  it('branco puro dá L=100, a=b=0', () => {
    const lab = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(lab.L).toBeCloseTo(100, 2);
    expect(lab.a).toBeCloseTo(0, 2);
    expect(lab.b).toBeCloseTo(0, 2);
  });

  it('vermelho puro bate com valor conhecido', () => {
    const lab = rgbToLab({ r: 255, g: 0, b: 0 });
    expect(lab.L).toBeCloseTo(53.24, 1);
    expect(lab.a).toBeCloseTo(80.09, 1);
    expect(lab.b).toBeCloseTo(67.2, 1);
  });

  it('ida e volta preserva a cor', () => {
    const rgb = { r: 201, g: 180, b: 150 };
    const back = labToRgb(rgbToLab(rgb));
    expect(back).toEqual(rgb);
  });
});

describe('CIEDE2000 (pares de teste de Sharma 2005)', () => {
  const cases: [number[], number[], number][] = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[50, 2.5, 0], [50, 3.1736, 0.5854], 1.0],
    [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.263],
    [[50, 2.5, 0], [50, 3.2972, 0], 1.0],
  ];
  for (const [a, b, expected] of cases) {
    it(`ΔE00(${a}) vs (${b}) ≈ ${expected}`, () => {
      const dE = deltaE2000({ L: a[0], a: a[1], b: a[2] }, { L: b[0], a: b[1], b: b[2] });
      expect(dE).toBeCloseTo(expected, 3);
    });
  }

  it('é simétrico', () => {
    const p = { L: 72, a: 2.5, b: 19.5 };
    const q = { L: 74.5, a: 1.8, b: 17.5 };
    expect(deltaE2000(p, q)).toBeCloseTo(deltaE2000(q, p), 10);
  });
});

describe('escalas', () => {
  it('VITA Classical tem 16 tabs únicos', () => {
    const ids = VITA_CLASSICAL.shades.map((s) => s.id);
    expect(ids).toHaveLength(16);
    expect(new Set(ids).size).toBe(16);
  });
  it('VITA 3D-Master tem 29 tabs únicos (0M1–0M3 de clareamento + 26)', () => {
    const ids = VITA_3D_MASTER.shades.map((s) => s.id);
    expect(ids).toHaveLength(29);
    expect(new Set(ids).size).toBe(29);
  });
  it('VITA 3D-Master: cada grupo de luminosidade é mais escuro que o anterior', () => {
    const meanL = (g: string) => {
      const tabs = VITA_3D_MASTER.shades.filter((s) => s.group === g);
      return tabs.reduce((sum, s) => sum + s.lab.L, 0) / tabs.length;
    };
    for (let g = 1; g <= 5; g++) expect(meanL(String(g))).toBeLessThan(meanL(String(g - 1)));
  });
});

describe('matchShade', () => {
  it('encontra o próprio tab com ΔE 0', () => {
    for (const shade of VITA_CLASSICAL.shades) {
      const r = matchShade(shade.lab, 'vita-classical');
      expect(r.matches[0].shade.id).toBe(shade.id);
      expect(r.matches[0].deltaE).toBeCloseTo(0, 6);
      expect(r.matches[0].quality).toBe('imperceptivel');
    }
  });

  it('usa a calibração quando ela está completa', () => {
    const calibration: Record<string, { L: number; a: number; b: number }> = {};
    for (const s of VITA_CLASSICAL.shades) calibration[s.id] = { L: s.lab.L - 10, a: s.lab.a, b: s.lab.b };
    const a2 = calibration.A2;
    const r = matchShade(a2, 'vita-classical', { calibration });
    expect(r.calibrated).toBe(true);
    expect(r.matches[0].shade.id).toBe('A2');
  });

  it('ignora calibração incompleta', () => {
    const r = matchShade({ L: 74.5, a: 1.8, b: 17.5 }, 'vita-classical', {
      calibration: { A1: { L: 1, a: 1, b: 1 } },
    });
    expect(r.calibrated).toBe(false);
    // o resultado é o mesmo de sem calibração nenhuma
    expect(r.matches[0].shade.id).toBe(matchShade({ L: 74.5, a: 1.8, b: 17.5 }, 'vita-classical').matches[0].shade.id);
  });
});

describe('correção por referência', () => {
  it('leva a referência medida exatamente para seu valor conhecido', () => {
    const known = { L: 49.5, a: 0, b: 0 };
    const measured = { r: 140, g: 118, b: 100 }; // cinza fotografado com luz quente
    const corrected = rgbToLab(correctWithReference(measured, { measured, known }));
    expect(corrected.L).toBeCloseTo(known.L, 0);
    expect(Math.abs(corrected.a)).toBeLessThan(1);
    expect(Math.abs(corrected.b)).toBeLessThan(1);
  });

  it('recupera a cor do dente sob luz quente simulada', () => {
    const toothTrue = { r: 220, g: 200, b: 170 };
    const grayTrue = labToRgb({ L: 49.5, a: 0, b: 0 });
    // simula um desvio de balanço de branco: mais vermelho, menos azul
    const warm = (c: { r: number; g: number; b: number }) => ({
      r: Math.round(c.r * 1.1),
      g: Math.round(c.g * 1.0),
      b: Math.round(c.b * 0.8),
    });
    const corrected = correctWithReference(warm(toothTrue), {
      measured: warm(grayTrue),
      known: { L: 49.5, a: 0, b: 0 },
    });
    const dE = deltaE2000(rgbToLab(corrected), rgbToLab(toothTrue));
    expect(dE).toBeLessThan(1.5);
  });
});

describe('matchShadeProfile (dente inteiro por terços)', () => {
  it('um dente com o perfil típico do tab acerta o tab e devolve 2 opções', async () => {
    const { matchShadeProfile, tabProfile } = await import('@/lib/color/match');
    const { getSystem } = await import('@/lib/color/shades');
    for (const shade of getSystem('vita-classical').shades) {
      const r = matchShadeProfile(shade.thirds ?? tabProfile(shade.lab), 'vita-classical');
      expect(r.matches).toHaveLength(2);
      expect(r.matches[0].shade.id).toBe(shade.id);
      expect(r.matches[0].deltaE).toBeCloseTo(0, 6);
    }
  });
  it('usa os terços calibrados do tab quando existem', async () => {
    const { matchShadeProfile } = await import('@/lib/color/match');
    const odd = { cervical: { L: 60, a: 5, b: 30 }, middle: { L: 70, a: 2, b: 20 }, incisal: { L: 75, a: 0, b: 10 } };
    const r = matchShadeProfile(odd, 'vita-classical', { calibrationThirds: { C4: odd } });
    expect(r.matches[0].shade.id).toBe('C4');
  });
});

describe('splitThirds', () => {
  it('divide em três faixas e inverte para dente inferior', async () => {
    const { splitThirds } = await import('@/lib/image/stats');
    const up = splitThirds({ x: 10, y: 20, width: 30, height: 90 });
    expect(up.cervical.y).toBe(20);
    expect(up.incisal.y).toBe(80);
    const low = splitThirds({ x: 10, y: 20, width: 30, height: 90 }, false);
    expect(low.cervical.y).toBe(80);
    expect(low.incisal.y).toBe(20);
  });
});

describe('matchGingiva', () => {
  it('acerta cada tab de gengiva pelos valores padrão e prefere a calibração quando completa', async () => {
    const { GINGIVA_SYSTEM, matchGingiva } = await import('@/lib/color/gingiva');
    for (const g of GINGIVA_SYSTEM.shades) expect(matchGingiva(g.lab).matches[0].shade.id).toBe(g.id);
    const calib = Object.fromEntries(GINGIVA_SYSTEM.shades.map((g, i) => [g.id, { L: 40 + i * 8, a: 20, b: 5 }]));
    const r = matchGingiva({ L: 56, a: 20, b: 5 }, calib);
    expect(r.calibrated).toBe(true);
    expect(r.matches[0].shade.id).toBe('G3');
  });
});

describe('valor, croma e matiz', () => {
  it('separa a diferença nas três dimensões, com sinal dente − tab', async () => {
    const { compareHcv, hcvOf } = await import('@/lib/color/hcv');
    const tab = { L: 72, a: 1, b: 18 };
    const lighter = compareHcv({ L: 76, a: 1, b: 18 }, tab);
    expect(lighter.value).toBeGreaterThan(0.8);
    expect(lighter.text.value).toMatch(/mais claro/);
    expect(lighter.text.chroma).toBe('igual ao tab');
    const yellower = compareHcv({ L: 72, a: -1.5, b: 18 }, tab); // ângulo maior = mais amarelado
    expect(yellower.text.hue).toMatch(/mais amarelado/);
    const satur = compareHcv({ L: 72, a: 1.3, b: 24 }, tab);
    expect(satur.text.chroma).toMatch(/mais saturado/);
    expect(hcvOf({ L: 70, a: 0, b: 20 }).hue).toBeCloseTo(90);
  });

  it('empate no total: ganha o tab de valor mais próximo', async () => {
    const { hcvTieBreak } = await import('@/lib/color/hcv');
    const tooth = { L: 74, a: 1, b: 17 };
    const sameValue = { L: 74, a: 2.5, b: 19.5 }; // difere em croma
    const otherValue = { L: 75.6, a: 1, b: 17 }; // difere em valor
    expect(hcvTieBreak(tooth, sameValue, otherValue)).toBeLessThan(0);
  });

  it('3D-Master: o nome do tab vira valor, matiz e croma', async () => {
    const { describe3dMaster } = await import('@/lib/color/hcv');
    expect(describe3dMaster('3R1.5')).toMatch(/valor 3.*matiz R.*croma 1,5/);
    expect(describe3dMaster('A2')).toBeNull();
  });
});
