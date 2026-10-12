import type { Lab } from './convert';
import { classifyDeltaE, deltaE2000, type MatchQuality } from './deltaE';
import { getSystem, type ShadeRef, type ShadeSystemId } from './shades';

export type ShadeMatch = {
  shade: ShadeRef;
  deltaE: number;
  quality: MatchQuality;
};

export type MatchResult = {
  system: ShadeSystemId;
  measured: Lab;
  matches: ShadeMatch[];
  /** 0..1: quão separado o melhor resultado está do segundo. */
  confidence: number;
  calibrated: boolean;
};

export type CalibrationMap = Partial<Record<string, Lab>>;

/**
 * Compara a cor medida com todos os tabs da escala e devolve os melhores.
 * Se houver calibração da própria escala (Lab medido pelo mesmo aparelho),
 * ela substitui os valores padrão daquele tab.
 */
export function matchShade(
  measured: Lab,
  system: ShadeSystemId,
  options: { topN?: number; calibration?: CalibrationMap } = {},
): MatchResult {
  const { topN = 3, calibration } = options;
  const sys = getSystem(system);
  const calibratedCount = calibration ? sys.shades.filter((s) => calibration[s.id]).length : 0;
  const useCalibration = calibratedCount === sys.shades.length;

  const all: ShadeMatch[] = sys.shades.map((shade) => {
    const refLab = useCalibration && calibration ? calibration[shade.id]! : shade.lab;
    const dE = deltaE2000(measured, refLab);
    return { shade: { ...shade, lab: refLab }, deltaE: dE, quality: classifyDeltaE(dE) };
  });
  all.sort((a, b) => a.deltaE - b.deltaE);

  const best = all[0];
  const second = all[1];
  const gap = second ? second.deltaE - best.deltaE : 1;
  const confidence = Math.max(0, Math.min(1, gap / 2));

  return {
    system,
    measured,
    matches: all.slice(0, topN),
    confidence,
    calibrated: useCalibration,
  };
}
