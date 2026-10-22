import { describe, expect, it } from 'vitest';
import { buildDesignPrompt, describeShade, designSummary, GUM_OPTIONS, TEXTURES, TOOTH_SHAPES } from '@/lib/ai/prompt';
import { getSystem } from '@/lib/color/shades';

describe('Smile Design por IA: instrução para o modelo', () => {
  const vita = getSystem('vita-classical');
  const b1 = vita.shades.find((s) => s.id === 'B1')!;

  it('descreve a cor da escala em palavras com o sRGB aproximado', () => {
    const d = describeShade('B1', b1.lab);
    expect(d).toContain('VITA B1');
    expect(d).toMatch(/#[0-9A-Fa-f]{6}/);
  });

  it('inclui forma, textura, cor e gengiva escolhidas e manda manter o resto da foto', () => {
    for (const shape of TOOTH_SHAPES)
      for (const texture of TEXTURES)
        for (const gum of GUM_OPTIONS) {
          const p = buildDesignPrompt({ shape: shape.id, texture: texture.id, gum: gum.id, shadeId: 'B1', shadeLab: b1.lab });
          expect(p).toContain(shape.prompt);
          expect(p).toContain(texture.prompt);
          expect(p).toContain(gum.prompt);
          expect(p).toContain('VITA B1');
          expect(p).toContain('Keep absolutely everything else identical');
          expect(p).not.toMatch(/\n/);
        }
  });

  it('plastia gengival pede gengiva nova; manter pede gengiva igual', () => {
    const base = { shape: 'quadrado' as const, texture: 'lisa' as const, shadeId: 'B1', shadeLab: b1.lab };
    expect(buildDesignPrompt({ ...base, gum: 'plastia' })).toMatch(/gingivoplasty/);
    expect(buildDesignPrompt({ ...base, gum: 'manter' })).toMatch(/Keep the gums exactly/);
  });

  it('resumo em português para o caso', () => {
    expect(designSummary({ shape: 'triangular', texture: 'caracterizada', gum: 'plastia', shadeId: 'A1' })).toBe('Triangular · textura caracterizada · A1 · plastia gengival');
  });
});
