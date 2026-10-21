import { describe, expect, it } from 'vitest';
import { applyScenario, SCENARIOS } from '@/lib/smile/scenarios';
import { DEFAULT_SMILE_PARAMS, NO_EDIT } from '@/lib/smile/teeth';

const ctx = { system: 'vita-classical' as const, aspect: 4 / 3 };

describe('cenários de tratamento', () => {
  it('todos preservam linha média e largura e devolvem parâmetros válidos', () => {
    for (const s of SCENARIOS) {
      const r = applyScenario(s.id, DEFAULT_SMILE_PARAMS, ctx);
      expect(r.params.midlineX).toBe(DEFAULT_SMILE_PARAMS.midlineX);
      expect(r.params.heightRatio).toBeGreaterThan(0.8);
      expect(r.params.heightRatio).toBeLessThanOrEqual(1.6);
    }
  });

  it('facetas: sem espaços, proporção RED, cor clara sugerida', () => {
    const r = applyScenario('veneers', DEFAULT_SMILE_PARAMS, ctx);
    expect(r.params.spacing).toBe(0);
    expect(r.params.proportion).toBe('red');
    expect(r.shade).toBe('B1');
  });

  it('clareamento muda só a cor; na 3D-Master sugere 1M1', () => {
    const r = applyScenario('whitening', DEFAULT_SMILE_PARAMS, { ...ctx, system: 'vita-3d-master' });
    expect(r.params).toEqual(DEFAULT_SMILE_PARAMS);
    expect(r.shade).toBe('1M1');
  });

  it('gengivectomia sobe a gengiva e alonga a coroa', () => {
    const r = applyScenario('gingivectomy', DEFAULT_SMILE_PARAMS, ctx);
    expect(r.params.gumY).toBeLessThan(DEFAULT_SMILE_PARAMS.gumY);
    expect(r.params.heightRatio).toBeGreaterThan(DEFAULT_SMILE_PARAMS.heightRatio);
  });

  it('fechar diastema zera o espaçamento e alarga os centrais', () => {
    const r = applyScenario('diastema', { ...DEFAULT_SMILE_PARAMS, spacing: 0.1 }, ctx);
    expect(r.params.spacing).toBe(0);
    expect(r.params.centralWidth).toBeGreaterThan(DEFAULT_SMILE_PARAMS.centralWidth);
  });

  it('alinhar zera os ajustes individuais', () => {
    const edits = { '12': { ...NO_EDIT, rot: 10, dx: 0.2 } };
    const r = applyScenario('alignment', { ...DEFAULT_SMILE_PARAMS, edits }, ctx);
    expect(r.params.edits?.['12']).toEqual(NO_EDIT);
  });
});
