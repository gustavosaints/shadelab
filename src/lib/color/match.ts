import type { Lab } from './convert';
import { classifyDeltaE, deltaE2000, PERCEPTIBILITY_THRESHOLD, type MatchQuality } from './deltaE';
import { compareHcv, hcvTieBreak, type HcvDiff } from './hcv';
import { getSystem, type ShadeRef, type ShadeSystemId } from './shades';

export type ShadeMatch = {
  shade: ShadeRef;
  deltaE: number;
  quality: MatchQuality;
  /** Dente × tab em valor, croma e matiz (terço médio). */
  hcv?: HcvDiff;
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

/** Cor do dente (ou do tab) por terços, do colo à borda incisal. */
export type ThirdsProfile = { cervical: Lab; middle: Lab; incisal: Lab };
export type ProfileCalibrationMap = Partial<Record<string, ThirdsProfile>>;

/**
 * Diferença típica de cada terço em relação ao terço médio num tab da escala (aproximação da
 * literatura: colo mais escuro e mais saturado, incisal mais claro e acinzentado/azulado pela
 * translucidez). Usada quando a escala não foi calibrada por terços no aparelho.
 */
export const THIRD_OFFSETS: Record<'cervical' | 'incisal', Lab> = {
  cervical: { L: -2.5, a: 0.8, b: 3.0 },
  incisal: { L: 1.5, a: -0.5, b: -4.0 },
};
/** Peso de cada terço na comparação: o médio manda, o colo mostra o croma, o incisal a translucidez. */
export const THIRD_WEIGHTS = { cervical: 0.3, middle: 0.5, incisal: 0.2 };

const add = (a: Lab, d: Lab): Lab => ({ L: a.L + d.L, a: a.a + d.a, b: a.b + d.b });

/** Perfil de referência de um tab: medido por terços (calibração) ou derivado do Lab único pelos offsets. */
export function tabProfile(lab: Lab, measured?: ThirdsProfile): ThirdsProfile {
  if (measured) return measured;
  return { cervical: add(lab, THIRD_OFFSETS.cervical), middle: lab, incisal: add(lab, THIRD_OFFSETS.incisal) };
}

/** Distância entre dois perfis: média ponderada dos ΔE00 por terço. */
export function profileDeltaE(a: ThirdsProfile, b: ThirdsProfile): number {
  return (
    THIRD_WEIGHTS.cervical * deltaE2000(a.cervical, b.cervical) +
    THIRD_WEIGHTS.middle * deltaE2000(a.middle, b.middle) +
    THIRD_WEIGHTS.incisal * deltaE2000(a.incisal, b.incisal)
  );
}

type Options = { topN?: number; calibration?: CalibrationMap; calibrationThirds?: ProfileCalibrationMap };

/**
 * Compara a cor medida com todos os tabs da escala e devolve os melhores (padrão: o mais provável
 * e a alternativa mais próxima). Se houver calibração da própria escala (Lab medido pelo mesmo
 * aparelho), ela substitui os valores padrão daquele tab.
 */
export function matchShade(measured: Lab, system: ShadeSystemId, options: Options = {}): MatchResult {
  return rank(measured, system, options, (ref) => deltaE2000(measured, ref.lab));
}

/**
 * Compara o DENTE INTEIRO (terços cervical, médio e incisal) com o tab inteiro da escala. Os tabs
 * entram com os terços medidos na calibração ou, sem ela, com os offsets típicos. O `measured`
 * devolvido é o terço médio.
 */
export function matchShadeProfile(profile: ThirdsProfile, system: ShadeSystemId, options: Options = {}): MatchResult {
  return rank(profile.middle, system, options, (ref, id, calibrated) =>
    profileDeltaE(profile, tabProfile(ref.lab, options.calibrationThirds?.[id] ?? (calibrated ? undefined : ref.thirds))),
  );
}

type DistanceRef = { lab: Lab; thirds?: ThirdsProfile };

function rank(measured: Lab, system: ShadeSystemId, options: Options, distance: (ref: DistanceRef, id: string, calibrated: boolean) => number): MatchResult {
  const { topN = 2, calibration } = options;
  const sys = getSystem(system);
  const calibratedCount = calibration ? sys.shades.filter((s) => calibration[s.id]).length : 0;
  const useCalibration = calibratedCount === sys.shades.length;

  const all: ShadeMatch[] = sys.shades.map((shade) => {
    const refLab = useCalibration && calibration ? calibration[shade.id]! : shade.lab;
    const dE = distance({ lab: refLab, thirds: shade.thirds }, shade.id, useCalibration);
    return { shade: { ...shade, lab: refLab }, deltaE: dE, quality: classifyDeltaE(dE) };
  });
  all.sort((a, b) => a.deltaE - b.deltaE);
  // empate no total (diferença abaixo do perceptível): valor decide, depois croma, depois matiz
  if (all[1] && all[1].deltaE - all[0].deltaE < PERCEPTIBILITY_THRESHOLD && hcvTieBreak(measured, all[0].shade.lab, all[1].shade.lab) > 0) {
    [all[0], all[1]] = [all[1], all[0]];
  }
  for (const m of all.slice(0, topN)) m.hcv = compareHcv(measured, m.shade.lab);

  const best = all[0];
  const second = all[1];
  const gap = second ? Math.abs(second.deltaE - best.deltaE) : 1;
  const confidence = Math.max(0, Math.min(1, gap / 2));

  return { system, measured, matches: all.slice(0, topN), confidence, calibrated: useCalibration };
}
