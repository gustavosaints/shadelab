import type { Lab } from './convert';
import { deltaE2000 } from './deltaE';

/**
 * Escala de gengiva. Valores CIELAB APROXIMADOS (D65/2°), derivados da descrição das cores do
 * guia IPS Gingiva (Ivoclar): G1 rosa-claro, G2 rosa-alaranjado, G3 rosa-médio, G4 rosa-avermelhado
 * escuro, G5 rosa-violáceo. Não há valores publicados confiáveis: calibre a sua escala de gengiva em
 * Configurações para a comparação usar a cor real dos seus tabs no seu aparelho.
 */
export type GingivaRef = { id: string; name: string; lab: Lab };

export const GINGIVA_SYSTEM = {
  id: 'ips-gingiva' as const,
  name: 'IPS Gingiva (Ivoclar)',
  shades: [
    { id: 'G1', name: 'G1 · rosa-claro', lab: { L: 62, a: 24, b: 12 } },
    { id: 'G2', name: 'G2 · rosa-alaranjado', lab: { L: 58, a: 28, b: 16 } },
    { id: 'G3', name: 'G3 · rosa-médio', lab: { L: 54, a: 30, b: 10 } },
    { id: 'G4', name: 'G4 · rosa-avermelhado', lab: { L: 48, a: 33, b: 12 } },
    { id: 'G5', name: 'G5 · rosa-violáceo', lab: { L: 50, a: 27, b: 4 } },
  ] as GingivaRef[],
};

export type GingivaMatch = { shade: GingivaRef; deltaE: number };

/** Compara a cor medida da gengiva com os tabs (calibrados quando todos foram medidos). */
export function matchGingiva(measured: Lab, calibration?: Partial<Record<string, Lab>>, topN = 2): { matches: GingivaMatch[]; calibrated: boolean } {
  const calibrated = !!calibration && GINGIVA_SYSTEM.shades.every((s) => calibration[s.id]);
  const all = GINGIVA_SYSTEM.shades
    .map((s) => {
      const lab = calibrated && calibration ? calibration[s.id]! : s.lab;
      return { shade: { ...s, lab }, deltaE: deltaE2000(measured, lab) };
    })
    .sort((a, b) => a.deltaE - b.deltaE);
  return { matches: all.slice(0, topN), calibrated };
}

export function findGingiva(id: string): GingivaRef | undefined {
  return GINGIVA_SYSTEM.shades.find((s) => s.id === id);
}
