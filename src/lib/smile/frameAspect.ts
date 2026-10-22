/**
 * Proporção do quadro da foto no Smile Design (metade da tela, pedido do Gustavo em 2026-10-22). A câmera mostra
 * uma moldura com essa proporção e a foto da galeria é cortada nela, para a foto encher o quadro sem cortar o rosto.
 */
export const HEADER_H = 44;
const GUTTER = 16;

/** Altura do quadro da foto para uma área de conteúdo (abaixo do cabeçalho) de `areaH` px. */
export function smilePhotoHeight(areaH: number, chipsH = 0): number {
  return Math.max(160, areaH / 2 - chipsH - GUTTER);
}

/** Largura / altura do quadro da foto. `areaH` = altura da área de conteúdo da tela do Smile Design. */
export function smileFrameAspect(winW: number, areaH: number): number {
  return (winW - GUTTER * 2) / smilePhotoHeight(areaH);
}

/** Estimativa da área de conteúdo a partir da janela (para a câmera, que não tem cabeçalho). */
export function estimateAreaH(winH: number, insetTop: number): number {
  return winH - insetTop - HEADER_H;
}

export type CropRect = { x: number; y: number; w: number; h: number };

/**
 * Recorte (px da foto) que aparece numa moldura de proporção `aspect` quando a foto é mostrada com escala `scale`
 * (px de tela por px de foto) e deslocamento `tx`/`ty` do centro da foto em relação ao centro da moldura.
 */
export function cropFromView(photoW: number, photoH: number, frameW: number, frameH: number, scale: number, tx: number, ty: number): CropRect {
  const w = frameW / scale;
  const h = frameH / scale;
  const x = photoW / 2 - tx / scale - w / 2;
  const y = photoH / 2 - ty / scale - h / 2;
  const cx = Math.max(0, Math.min(photoW - w, x));
  const cy = Math.max(0, Math.min(photoH - h, y));
  return { x: Math.round(cx), y: Math.round(cy), w: Math.round(Math.min(w, photoW)), h: Math.round(Math.min(h, photoH)) };
}

/** Escala mínima para a foto cobrir a moldura inteira (sem faixas vazias). */
export function coverScale(photoW: number, photoH: number, frameW: number, frameH: number): number {
  return Math.max(frameW / photoW, frameH / photoH);
}
