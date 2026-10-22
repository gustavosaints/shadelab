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
 * VITA 3D-Master (26 tabs): grupo de luminosidade 1–5, matiz L/M/R e croma.
 * Valores aproximados derivados da estrutura da escala; calibre a sua.
 */
function threeDMaster(): ShadeRef[] {
  const lightness: Record<string, number> = { '1': 82, '2': 78, '3': 74, '4': 70, '5': 66 };
  const chromaB: Record<string, number> = { '1': 11, '1.5': 14, '2': 17, '2.5': 20, '3': 23 };
  const hueA: Record<string, number> = { L: 0.0, M: 1.5, R: 3.0 };

  const layout: Record<string, string[]> = {
    '1': ['M1', 'M2'],
    '2': ['L1.5', 'L2.5', 'M1', 'M2', 'M3', 'R1.5', 'R2.5'],
    '3': ['L1.5', 'L2.5', 'M1', 'M2', 'M3', 'R1.5', 'R2.5'],
    '4': ['L1.5', 'L2.5', 'M1', 'M2', 'M3', 'R1.5', 'R2.5'],
    '5': ['M1', 'M2', 'M3'],
  };

  const refs: ShadeRef[] = [];
  for (const [group, tabs] of Object.entries(layout)) {
    for (const t of tabs) {
      const hue = t[0];
      const chroma = t.slice(1);
      const chromaAdj = (chromaB[chroma] - 17) * 0.15; // croma alto escurece um pouco
      refs.push({
        id: `${group}${t}`,
        system: 'vita-3d-master',
        group,
        lab: {
          L: lightness[group] - chromaAdj,
          a: hueA[hue] + (chromaB[chroma] - 11) * 0.08,
          b: chromaB[chroma],
        },
      });
    }
  }
  return refs;
}

export const VITA_3D_MASTER: ShadeSystem = {
  id: 'vita-3d-master',
  name: 'VITA 3D-Master',
  shades: threeDMaster(),
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
