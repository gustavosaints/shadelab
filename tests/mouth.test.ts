import { describe, expect, it } from 'vitest';
import { ANTERIORS_TO_MOUTH, defaultMouth, fitToMouth, mouthBounds, mouthPath } from '@/lib/smile/mouth';
import { DEFAULT_SMILE_PARAMS, layoutTeeth } from '@/lib/smile/teeth';

const W = 1000;
const H = 800;

describe('mouth', () => {
  const teeth = layoutTeeth(DEFAULT_SMILE_PARAMS, W, H);

  it('contorno inicial envolve os dentes e cobre a cervical', () => {
    const m = defaultMouth(teeth, W, H);
    expect(m).toHaveLength(8);
    const left = Math.min(...teeth.map((t) => t.x));
    const right = Math.max(...teeth.map((t) => t.x + t.w));
    const top = Math.min(...teeth.map((t) => t.y));
    expect(m[0].x * W).toBeLessThan(left);
    expect(m[4].x * W).toBeGreaterThan(right);
    expect(m[2].y * H).toBeGreaterThan(top); // lábio superior abaixo da linha cervical
    expect(m[6].y * H).toBeGreaterThan(Math.max(...teeth.map((t) => t.y + t.h)));
    for (const p of m) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
    }
  });

  it('gera caminho fechado e suave', () => {
    const d = mouthPath(defaultMouth(teeth, W, H), W, H);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect((d.match(/C /g) ?? []).length).toBe(8);
    expect(mouthPath([{ x: 0, y: 0 }], W, H)).toBe('');
  });

  it('encaixa o arco na boca: linha média no centro e largura proporcional', () => {
    const mouth = defaultMouth(teeth, W, H).map((p) => ({ x: p.x + 0.1, y: p.y }));
    const t23 = teeth.find((t) => t.fdi === '23')!;
    const t11 = teeth.find((t) => t.fdi === '11')!;
    const half = t23.x + t23.w - DEFAULT_SMILE_PARAMS.midlineX * W;
    const p = fitToMouth(DEFAULT_SMILE_PARAMS, mouth, W, H, half, t11.h);
    const b = mouthBounds(mouth, W, H);
    expect(p.midlineX * W).toBeCloseTo(b.centerX, 6);
    const after = layoutTeeth(p, W, H);
    const a23 = after.find((t) => t.fdi === '23')!;
    const a13 = after.find((t) => t.fdi === '13')!;
    expect(a23.x + a23.w - a13.x).toBeCloseTo(b.widthPx * ANTERIORS_TO_MOUTH, 3);
    expect(p.gumY * H).toBeLessThan(b.upperMidY);
  });
});
