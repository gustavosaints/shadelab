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
          expect(p).toContain('Keep everything that is not an upper tooth identical');
          expect(p).toMatch(/CLEARLY VISIBLE/);
          expect(p).toMatch(/CLOSE ALL DIASTEMAS/);
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

describe('imagem-guia do planejamento', () => {
  it('a instrução fala da imagem 2 só quando ela vai junto', async () => {
    const { buildDesignPrompt } = await import('@/lib/ai/prompt');
    const b1 = getSystem('vita-classical').shades.find((s) => s.id === 'B1')!;
    const base = { shape: 'quadrado' as const, texture: 'natural' as const, gum: 'manter' as const, shadeId: 'B1', shadeLab: b1.lab };
    expect(buildDesignPrompt({ ...base, withGuide: true })).toMatch(/Image 2 is the dentist's planning mock-up/);
    expect(buildDesignPrompt(base)).not.toMatch(/Image 2/);
  });

  it('com o guia, o tamanho vem dele: sem "transformação claramente visível" e sem mexer nos lábios', async () => {
    const { buildDesignPrompt } = await import('@/lib/ai/prompt');
    const b1 = getSystem('vita-classical').shades.find((s) => s.id === 'B1')!;
    const base = { shape: 'quadrado' as const, texture: 'natural' as const, gum: 'manter' as const, shadeId: 'B1', shadeLab: b1.lab };
    const p = buildDesignPrompt({ ...base, withGuide: true });
    expect(p).not.toMatch(/CLEARLY VISIBLE/);
    expect(p).not.toMatch(/dominant central incisors/);
    expect(p).toMatch(/HIDDEN behind the lips/);
    expect(p).toMatch(/Do NOT lift, open, stretch or move the lips/);
    expect(p).toMatch(/CLOSE ALL DIASTEMAS/);
    expect(p).not.toMatch(/\n/);
  });

  it('recorta o desenho pela abertura dos lábios: atrás do lábio a foto fica intacta', async () => {
    const { paintGuide } = await import('@/lib/smile/guideImage');
    const { layoutMapped } = await import('@/lib/smile/mapping');
    const W = 200;
    const H = 120;
    const data = new Uint8Array(W * H * 4).fill(0);
    const teeth = layoutMapped(100, 30, 20, 1.2); // colo em y = 30, incisal em y = 54
    // "boca" = retângulo que só mostra a metade de baixo dos dentes (lábio superior em y = 42)
    const clip = [
      { x: 0, y: 42 },
      { x: W, y: 42 },
      { x: W, y: H },
      { x: 0, y: H },
    ];
    paintGuide({ data, width: W, height: H }, teeth, 0.5, { r: 240, g: 230, b: 210 }, 1, 0.88, clip);
    const at = (x: number, y: number) => Array.from(data.slice((y * W + x) * 4, (y * W + x) * 4 + 3));
    const c11 = teeth.find((t) => t.fdi === '11')!;
    const cx = Math.round(c11.x + c11.w / 2);
    expect(at(cx, 48)[0]).toBeGreaterThan(180); // dentro da boca: pintado
    expect(at(cx, 36)).toEqual([0, 0, 0]); // atrás do lábio: intacto
  });

  it('pinta os dentes planejados na cor-alvo e não mexe fora deles', async () => {
    const { paintGuide } = await import('@/lib/smile/guideImage');
    const { layoutMapped } = await import('@/lib/smile/mapping');
    const W = 200;
    const H = 120;
    const data = new Uint8Array(W * H * 4).fill(0);
    const teeth = layoutMapped(100, 30, 20, 1.2);
    paintGuide({ data, width: W, height: H }, teeth, 0.5, { r: 240, g: 230, b: 210 });
    const at = (x: number, y: number) => Array.from(data.slice((y * W + x) * 4, (y * W + x) * 4 + 3));
    const c11 = teeth.find((t) => t.fdi === '11')!;
    const mid = at(Math.round(c11.x + c11.w / 2), Math.round(c11.y + c11.h / 2));
    expect(mid[0]).toBeGreaterThan(180); // preenchido na cor-alvo (sobre o preto)
    expect(at(2, 2)).toEqual([0, 0, 0]); // fora dos dentes, intacto
  });

  it('base64 ida e volta', async () => {
    const { base64ToBytes, bytesToBase64 } = await import('@/lib/image/base64');
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });
});
