import type { SmileLibraryEntry } from './smileLibrary';
import type { SmileParams } from './teeth';

export type LibraryPlacement = { left: number; top: number; width: number; height: number };

/**
 * Posiciona um arco 2D da biblioteca (PNG) sobre a vista de `width` x `height` px usando os mesmos
 * parâmetros do modo contorno: a linha média cai em `midlineX`, o colo dos centrais em `gumY`, um central
 * fica com `centralWidth` da largura da vista e o comprimento do central com `heightRatio` × largura.
 * A escala horizontal vem da largura do central; a vertical, do comprimento (o PNG pode esticar um pouco).
 */
export function libraryPlacement(p: SmileParams, e: SmileLibraryEntry, width: number, height: number): LibraryPlacement {
  const cw = p.centralWidth * width;
  const sx = cw / e.centralWidth;
  const crownPx = Math.max(1, e.incisalY - e.gumY);
  const sy = (p.heightRatio * cw) / crownPx;
  return {
    left: p.midlineX * width - e.midlineX * sx,
    top: p.gumY * height - e.gumY * sy,
    width: e.width * sx,
    height: e.height * sy,
  };
}
