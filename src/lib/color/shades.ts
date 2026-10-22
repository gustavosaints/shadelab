import type { Lab } from './convert';
import type { ThirdsProfile } from './match';
import { VITA_CLASSICAL_IMAGES, VITA_CLASSICAL_MEASURED, VITA_CLASSICAL_THIRDS } from './vitaClassicalMeasured';

export type ShadeSystemId = 'vita-classical' | 'vita-3d-master';

export type ShadeRef = {
  id: string; // ex.: "A2"
  system: ShadeSystemId;
  lab: Lab;
  group?: string; // ex.: "A" ou "2M"
  /** Cor por terços medida na escala real (quando houver). */
  thirds?: ThirdsProfile;
  /** Foto recortada do tab real (require do asset), para resultados e PDF. */
  image?: number;
};

export type ShadeSystem = {
  id: ShadeSystemId;
  name: string;
  shades: ShadeRef[];
};

/**
 * Valores CIELAB (D65/2°) da VITA Classical A1–D4 da LITERATURA (terço médio, espectrofotômetro). Desde
 * 2026-10-22 o app usa os valores MEDIDOS na escala do Gustavo (`vitaClassicalMeasured.ts`); estes só ficam
 * para o tab que faltou na foto (B3). A calibração em Configurações continua substituindo tudo.
 */
const VITA_CLASSICAL_LITERATURE: Record<string, Lab> = {
  A1: { L: 76.5, a: 1.0, b: 14.5 },
  A2: { L: 74.5, a: 1.8, b: 17.5 },
  A3: { L: 72.0, a: 2.5, b: 19.5 },
  'A3.5': { L: 69.5, a: 3.0, b: 21.5 },
  A4: { L: 66.0, a: 3.0, b: 20.5 },
  B1: { L: 78.0, a: -0.5, b: 12.0 },
  B2: { L: 75.0, a: 0.5, b: 17.0 },
  B3: { L: 71.5, a: 2.0, b: 22.0 },
  B4: { L: 68.5, a: 2.5, b: 22.5 },
  C1: { L: 73.5, a: -0.5, b: 11.5 },
  C2: { L: 70.0, a: 0.5, b: 15.5 },
  C3: { L: 67.0, a: 1.0, b: 16.5 },
  C4: { L: 62.5, a: 1.5, b: 17.5 },
  D2: { L: 72.5, a: 0.0, b: 12.5 },
  D3: { L: 70.5, a: 0.8, b: 15.0 },
  D4: { L: 69.0, a: 1.5, b: 17.0 },
};

export const VITA_CLASSICAL: ShadeSystem = {
  id: 'vita-classical',
  name: 'VITA Classical',
  shades: Object.entries(VITA_CLASSICAL_LITERATURE).map(([id, lab]) => ({
    id,
    system: 'vita-classical',
    lab: VITA_CLASSICAL_MEASURED[id] ?? lab,
    thirds: VITA_CLASSICAL_THIRDS[id],
    image: VITA_CLASSICAL_IMAGES[id],
    group: id[0],
  })),
};

/**
 * VITA Toothguide 3D-Master (29 tabs: 0M1–0M3 de clareamento + 26), CIELAB MEDIDO nos tabs (terço médio) com
 * SpectroShade Micro — média de 34 leituras em 3 lotes da escala, erro do aparelho ΔE00 ≈ 0,5: Dias, Pereira,
 * Silveira, Mata, Marques et al., "Different Methods for Assessing Tooth Colour — In Vitro Study", Biomimetics
 * 2023;8(5):384 (doi 10.3390/biomimetics8050384), Tabela 4. O mesmo estudo mediu a VITA Classical na mesma
 * escala de L* que a do app (A1 L 76,5), então as duas escalas ficam comparáveis. Substituídos pelas medições da
 * escala do Gustavo quando ele fotografar a dele (como foi feito com a Classical) ou pela calibração.
 * Nome: grupo de luminosidade 0–5 (0 = clareado, 5 = mais escuro), matiz L (amarelado) / M / R (avermelhado) e croma.
 */
const VITA_3D_MASTER_LITERATURE: Record<string, Lab> = {
  '0M1': { L: 81.1, a: -0.3, b: 6.7 },
  '0M2': { L: 79.8, a: -0.5, b: 8.0 },
  '0M3': { L: 79.2, a: -0.7, b: 9.4 },
  '1M1': { L: 77.5, a: -0.3, b: 12.3 },
  '1M2': { L: 77.2, a: -0.5, b: 16.8 },
  '2L1.5': { L: 72.7, a: -0.5, b: 15.7 },
  '2L2.5': { L: 72.3, a: -0.2, b: 22.4 },
  '2M1': { L: 72.5, a: 0.2, b: 13.0 },
  '2M2': { L: 71.8, a: 0.3, b: 17.0 },
  '2M3': { L: 73.2, a: 0.3, b: 22.5 },
  '2R1.5': { L: 72.2, a: 0.9, b: 15.1 },
  '2R2.5': { L: 73.4, a: 0.8, b: 20.9 },
  '3L1.5': { L: 67.0, a: 1.1, b: 18.3 },
  '3L2.5': { L: 68.6, a: 1.3, b: 23.3 },
  '3M1': { L: 68.1, a: 1.2, b: 14.2 },
  '3M2': { L: 69.2, a: 1.7, b: 20.1 },
  '3M3': { L: 68.5, a: 2.5, b: 26.0 },
  '3R1.5': { L: 71.8, a: 1.0, b: 15.2 },
  '3R2.5': { L: 70.0, a: 3.1, b: 25.2 },
  '4L1.5': { L: 64.8, a: 2.2, b: 20.1 },
  '4L2.5': { L: 65.6, a: 3.5, b: 27.8 },
  '4M1': { L: 65.2, a: 1.9, b: 15.8 },
  '4M2': { L: 65.3, a: 2.5, b: 20.7 },
  '4M3': { L: 66.0, a: 3.5, b: 28.1 },
  '4R1.5': { L: 65.0, a: 3.1, b: 19.6 },
  '4R2.5': { L: 65.4, a: 3.8, b: 24.5 },
  '5M1': { L: 60.1, a: 3.2, b: 18.3 },
  '5M2': { L: 61.2, a: 4.6, b: 25.1 },
  '5M3': { L: 62.0, a: 5.8, b: 32.2 },
};

export const VITA_3D_MASTER: ShadeSystem = {
  id: 'vita-3d-master',
  name: 'VITA 3D-Master',
  shades: Object.entries(VITA_3D_MASTER_LITERATURE).map(([id, lab]) => ({ id, system: 'vita-3d-master', lab, group: id[0] })),
};

export const SHADE_SYSTEMS: Record<ShadeSystemId, ShadeSystem> = {
  'vita-classical': VITA_CLASSICAL,
  'vita-3d-master': VITA_3D_MASTER,
};

export function getSystem(id: ShadeSystemId): ShadeSystem {
  return SHADE_SYSTEMS[id];
}

export function findShade(system: ShadeSystemId, id: string): ShadeRef | undefined {
  return SHADE_SYSTEMS[system].shades.find((s) => s.id === id);
}

/** Referências neutras para correção de branco. */
export type NeutralReferenceId = 'gray18' | 'white';

export const NEUTRAL_REFERENCES: Record<NeutralReferenceId, { name: string; lab: Lab }> = {
  gray18: { name: 'Cartão cinza 18%', lab: { L: 49.5, a: 0, b: 0 } },
  white: { name: 'Cartão branco', lab: { L: 95, a: 0, b: 0 } },
};
