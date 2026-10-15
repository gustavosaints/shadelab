import { describe, expect, it } from 'vitest';
import { buildPrompt, describeShade, SMILE_STYLES } from '@/lib/ai/prompt';
import { getSystem } from '@/lib/color/shades';

describe('prompt do sorriso por IA', () => {
  const vita = getSystem('vita-classical');
  const b2 = vita.shades.find((s) => s.id === 'B2')!;

  it('descreve a cor da escala em palavras com o sRGB aproximado', () => {
    const d = describeShade('B2', b2.lab);
    expect(d).toContain('VITA B2');
    expect(d).toMatch(/#[0-9A-Fa-f]{6}/);
  });

  it('monta a instrução com estilo, cor e a ordem de manter o resto da foto', () => {
    for (const s of SMILE_STYLES) {
      const p = buildPrompt(s.id, 'B2', b2.lab);
      expect(p).toContain(s.prompt);
      expect(p).toContain('VITA B2');
      expect(p).toContain('Keep absolutely everything else identical');
      expect(p).not.toMatch(/\n/);
    }
  });

  it('tons mais claros e mais escuros ganham descrições diferentes', () => {
    const b1 = vita.shades.find((s) => s.id === 'B1')!;
    const a4 = vita.shades.find((s) => s.id === 'A4')!;
    expect(describeShade('B1', b1.lab)).not.toBe(describeShade('A4', a4.lab));
    expect(describeShade('A4', a4.lab)).toMatch(/darker|medium/);
  });
});
