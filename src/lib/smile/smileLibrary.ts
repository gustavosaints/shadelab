// GERADO por scripts/sorrisos/extract.mjs — não editar à mão.
// Arcos 2D (foto/render) recortados de reference/sorrisos/tipos-de-sorriso.png. Medidas em px do PNG.
export type SmileLibraryEntry = {
  id: string;
  name: string;
  image: number;
  width: number;
  height: number;
  /** Linha média (x), borda incisal e colo dos centrais (y), largura de um central — em px do PNG. */
  midlineX: number;
  incisalY: number;
  gumY: number;
  centralWidth: number;
};
export const SMILE_LIBRARY: SmileLibraryEntry[] = [
  { id: 'retangular', name: 'Retangular', image: require('../../../assets/sorrisos/retangular.png'), width: 218, height: 70, midlineX: 103.5, incisalY: 66, gumY: 10, centralWidth: 43 },
  { id: 'triangular', name: 'Triangular', image: require('../../../assets/sorrisos/triangular.png'), width: 219, height: 72, midlineX: 104.5, incisalY: 69, gumY: 12, centralWidth: 41 },
  { id: 'arredondado', name: 'Arredondado', image: require('../../../assets/sorrisos/arredondado.png'), width: 224, height: 69, midlineX: 112.5, incisalY: 65, gumY: 13, centralWidth: 41 },
  { id: 'quadrado', name: 'Quadrado', image: require('../../../assets/sorrisos/quadrado.png'), width: 216, height: 57, midlineX: 103.5, incisalY: 54, gumY: 5, centralWidth: 40.5 },
];
