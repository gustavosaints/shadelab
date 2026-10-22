// GERADO por scripts/escala/measure.mjs (scripts/escala/vita-classical.json) — não editar à mão.
// Escala VITA Classical do Gustavo fotografada em 2026-10-22 (reference/escala/vita-classical.jpg): balanço de
// branco pela placa cinza da régua, exposição normalizada para a média de L* da literatura (71,0), leitura por
// terços (topo do tab = incisal). O B3 não estava na régua (havia um A2 repetido no lugar): fica com o valor da
// literatura e sem foto.
import type { Lab } from './convert';
import type { ThirdsProfile } from './match';

export const VITA_CLASSICAL_MEASURED: Partial<Record<string, Lab>> = {
  A1: { L: 75.6, a: 0.7, b: 13.5 },
  A2: { L: 71.7, a: 0.6, b: 16.8 },
  A3: { L: 73.5, a: -0.1, b: 20.6 },
  'A3.5': { L: 70.1, a: 0.5, b: 24.8 },
  A4: { L: 63.4, a: 0.9, b: 24.4 },
  B1: { L: 77.2, a: -1.6, b: 13.1 },
  B2: { L: 76.5, a: -2.7, b: 18.4 },
  B4: { L: 68.4, a: -1.1, b: 25.9 },
  C1: { L: 71.9, a: -1.4, b: 15 },
  C2: { L: 68.6, a: -0.5, b: 18.7 },
  C3: { L: 67.2, a: -0.5, b: 19.2 },
  C4: { L: 62.2, a: 1.1, b: 20.8 },
  D2: { L: 73.8, a: -0.1, b: 13.2 },
  D3: { L: 70.5, a: 0.6, b: 17.5 },
  D4: { L: 72, a: 0.1, b: 19.4 },
};

export const VITA_CLASSICAL_THIRDS: Partial<Record<string, ThirdsProfile>> = {
  A1: { cervical: { L: 69.1, a: 0.7, b: 12 }, middle: { L: 75.6, a: 0.7, b: 13.5 }, incisal: { L: 83.9, a: -0.5, b: 12.2 } },
  A2: { cervical: { L: 61.6, a: 0.9, b: 13.4 }, middle: { L: 71.7, a: 0.6, b: 16.8 }, incisal: { L: 79.3, a: 0.1, b: 16.1 } },
  A3: { cervical: { L: 67.1, a: 0.4, b: 17.3 }, middle: { L: 73.5, a: -0.1, b: 20.6 }, incisal: { L: 79.6, a: -0.4, b: 19 } },
  'A3.5': { cervical: { L: 63.8, a: 0.5, b: 21.4 }, middle: { L: 70.1, a: 0.5, b: 24.8 }, incisal: { L: 76.6, a: -0.1, b: 23.2 } },
  A4: { cervical: { L: 56.2, a: 0.7, b: 21.5 }, middle: { L: 63.4, a: 0.9, b: 24.4 }, incisal: { L: 71.6, a: 0.2, b: 23.5 } },
  B1: { cervical: { L: 69, a: -2.2, b: 11.8 }, middle: { L: 77.2, a: -1.6, b: 13.1 }, incisal: { L: 82.7, a: -2.9, b: 11.7 } },
  B2: { cervical: { L: 66, a: -1.8, b: 14.7 }, middle: { L: 76.5, a: -2.7, b: 18.4 }, incisal: { L: 81.7, a: -3.1, b: 17.9 } },
  B4: { cervical: { L: 61.1, a: -1.1, b: 21.9 }, middle: { L: 68.4, a: -1.1, b: 25.9 }, incisal: { L: 75.3, a: -1.6, b: 25.5 } },
  C1: { cervical: { L: 65.3, a: -1, b: 12.2 }, middle: { L: 71.9, a: -1.4, b: 15 }, incisal: { L: 78.4, a: -1.9, b: 14.7 } },
  C2: { cervical: { L: 60.6, a: -0.7, b: 15 }, middle: { L: 68.6, a: -0.5, b: 18.7 }, incisal: { L: 75.7, a: -1.3, b: 17.7 } },
  C3: { cervical: { L: 58.5, a: -0.3, b: 15.1 }, middle: { L: 67.2, a: -0.5, b: 19.2 }, incisal: { L: 74.1, a: -0.5, b: 16.7 } },
  C4: { cervical: { L: 55.1, a: 0.6, b: 18.4 }, middle: { L: 62.2, a: 1.1, b: 20.8 }, incisal: { L: 70.6, a: 0.1, b: 19.7 } },
  D2: { cervical: { L: 67.2, a: 0.1, b: 10.9 }, middle: { L: 73.8, a: -0.1, b: 13.2 }, incisal: { L: 78.3, a: -0.2, b: 14.4 } },
  D3: { cervical: { L: 64.3, a: 0.2, b: 14.1 }, middle: { L: 70.5, a: 0.6, b: 17.5 }, incisal: { L: 77.3, a: 0.2, b: 16.7 } },
  D4: { cervical: { L: 66.2, a: 0.1, b: 17.6 }, middle: { L: 72, a: 0.1, b: 19.4 }, incisal: { L: 76.7, a: -0.1, b: 15 } },
};

/** Foto recortada de cada tab da escala real (resultados, caso salvo e PDF). */
export const VITA_CLASSICAL_IMAGES: Partial<Record<string, number>> = {
  A1: require('../../../assets/escala/vita-classical/A1.jpg'),
  A2: require('../../../assets/escala/vita-classical/A2.jpg'),
  A3: require('../../../assets/escala/vita-classical/A3.jpg'),
  'A3.5': require('../../../assets/escala/vita-classical/A3_5.jpg'),
  A4: require('../../../assets/escala/vita-classical/A4.jpg'),
  B1: require('../../../assets/escala/vita-classical/B1.jpg'),
  B2: require('../../../assets/escala/vita-classical/B2.jpg'),
  B4: require('../../../assets/escala/vita-classical/B4.jpg'),
  C1: require('../../../assets/escala/vita-classical/C1.jpg'),
  C2: require('../../../assets/escala/vita-classical/C2.jpg'),
  C3: require('../../../assets/escala/vita-classical/C3.jpg'),
  C4: require('../../../assets/escala/vita-classical/C4.jpg'),
  D2: require('../../../assets/escala/vita-classical/D2.jpg'),
  D3: require('../../../assets/escala/vita-classical/D3.jpg'),
  D4: require('../../../assets/escala/vita-classical/D4.jpg'),
};
