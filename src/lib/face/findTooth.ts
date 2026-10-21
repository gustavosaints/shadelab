import type { FaceLandmarkerHandle } from '@/components/FaceLandmarker';
import type { Rect } from '@/lib/image/stats';
import type { AutoFit } from '@/lib/smile/autofit';
import { detectFace, fitInRegion, type Photo } from './detect';

export type ToothPlacement = {
  /** Quadro sobre a coroa do incisivo central (11 se visível, senão 21), px da imagem. */
  tooth: Rect;
  /** Quadro sobre a gengiva logo acima desse dente. */
  gingiva: Rect;
  fdi: '11' | '21';
  source: 'face' | 'pixels';
};

/** Quadro do dente a partir do ajuste de pixels (px do recorte → px da imagem). */
function rectsFromFit(fit: AutoFit, crop: { x: number; y: number; scale: number }, imageW: number, imageH: number): ToothPlacement | null {
  const mid = fit.midlineX;
  const h = fit.incisalY - fit.gumY;
  if (!(h > 0)) return null;
  const gapsL = fit.gaps.filter((g) => g < mid - 2).sort((a, b) => b - a);
  const gapsR = fit.gaps.filter((g) => g > mid + 2).sort((a, b) => a - b);
  let fdi: '11' | '21' = '11';
  let x0: number;
  let x1: number;
  if (fit.widths['11'] && gapsL.length) {
    x0 = gapsL[0];
    x1 = mid;
  } else if (fit.widths['21'] && gapsR.length) {
    fdi = '21';
    x0 = mid;
    x1 = gapsR[0];
  } else return null;
  const w = x1 - x0;
  const toImg = (r: Rect): Rect => ({ x: crop.x + r.x / crop.scale, y: crop.y + r.y / crop.scale, width: r.width / crop.scale, height: r.height / crop.scale });
  // dentro da coroa, longe das bordas (reflexo da borda, papila, contato)
  const tooth = toImg({ x: x0 + w * 0.14, y: fit.gumY + h * 0.08, width: w * 0.72, height: h * 0.84 });
  const gh = h * 0.35;
  const gingiva = toImg({ x: x0 + w * 0.14, y: fit.gumY - h * 0.06 - gh, width: w * 0.72, height: gh });
  const wi = tooth.width / imageW;
  if (wi < 0.015 || wi > 0.35) return null;
  const clamp = (r: Rect): Rect => ({
    x: Math.max(0, Math.min(imageW - r.width, r.x)),
    y: Math.max(0, Math.min(imageH - r.height, r.y)),
    width: Math.min(imageW, r.width),
    height: Math.min(imageH, r.height),
  });
  return { tooth: clamp(tooth), gingiva: clamp(gingiva), fdi, source: 'face' };
}

/**
 * Acha um incisivo central na foto e devolve os quadros do dente e da gengiva já no tamanho certo.
 * 1) Com rosto na foto: MediaPipe acha a boca e a análise de pixels acha os espaços interproximais.
 * 2) Sem rosto (close da boca): a mesma análise na imagem inteira, com a linha média no centro.
 * Devolve null quando não encontra nada confiável; aí ficam os quadros padrão.
 */
export async function findCentralIncisor(photo: Photo, landmarker: FaceLandmarkerHandle | null): Promise<ToothPlacement | null> {
  if (landmarker) {
    try {
      const det = await detectFace(landmarker, photo.uri);
      if (det) {
        const r = await fitInRegion(photo, det.mouth, det.face.philtrum.x);
        if (r && r.fit.confidence >= 0.4) {
          const placed = rectsFromFit(r.fit, r.crop, photo.width, photo.height);
          if (placed) return placed;
        }
      }
    } catch {
      // sem detector (offline) → tenta pelos pixels
    }
  }
  const inset = 0.04;
  const whole = [
    { x: inset, y: inset },
    { x: 1 - inset, y: inset },
    { x: 1 - inset, y: 1 - inset },
    { x: inset, y: 1 - inset },
  ];
  try {
    const r = await fitInRegion(photo, whole, 0.5);
    if (!r || r.fit.confidence < 0.4) return null;
    const placed = rectsFromFit(r.fit, r.crop, photo.width, photo.height);
    return placed ? { ...placed, source: 'pixels' } : null;
  } catch {
    return null;
  }
}
