/* eslint-disable @typescript-eslint/no-require-imports */
// GERADO por scripts/anatomia/export3d.mjs — não editar à mão.
// Arcos completos (superior + inferior) das bibliotecas do exocad, em assets/arcos/<id>.bin.
export type ArchEntry = { id: string; name: string; bin: number };
export const ARCH_CATALOG: ArchEntry[] = [
  { id: 'avelar-x1', name: "Avelar X1", bin: require('../../../assets/arcos/avelar-x1.bin') },
  { id: 'jo-2026', name: "JO 2026", bin: require('../../../assets/arcos/jo-2026.bin') },
  { id: 'da507', name: "DA507", bin: require('../../../assets/arcos/da507.bin') },
  { id: 'shorodok-g013', name: "Shorodok G013", bin: require('../../../assets/arcos/shorodok-g013.bin') },
];
