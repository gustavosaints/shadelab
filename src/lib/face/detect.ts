/**
 * Detecção automática para o Smile Design: rosto e boca pelo MediaPipe (via WebView)
 * e alinhamento dos dentes por análise de pixels do recorte da boca.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import type { FaceLandmarkerHandle } from '@/components/FaceLandmarker';
import { base64ToBytes } from '@/lib/image/base64';
import { autoFitTeeth, autoFitToParams, type AutoFit } from '@/lib/smile/autofit';
import { scanMouth } from '@/lib/smile/mouthScan';
import type { FacePoints } from '@/lib/smile/frame';
import type { MouthPoint, SmileParams } from '@/lib/smile/teeth';
import { facePointsFromLandmarks, faceBoxFromLandmarks, isMirrored, mouthFromLandmarks, type FaceBox, type Landmark } from './landmarks';

export type Photo = { uri: string; width: number; height: number };

/** Reduz a foto e devolve JPEG em base64 (lado maior = maxSide). */
export async function photoToBase64(uri: string, maxSide: number): Promise<string> {
  const ref = await ImageManipulator.manipulate(uri).resize({ width: maxSide }).renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.9, base64: true });
  if (!out.base64) throw new Error('Não foi possível ler a foto.');
  return out.base64;
}

/** Espelha a foto horizontalmente (selfie) e devolve a nova URI. */
export async function flipPhoto(uri: string): Promise<string> {
  const ref = await ImageManipulator.manipulate(uri).flip('horizontal').renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
  return out.uri;
}

export type FaceDetection = { landmarks: Landmark[]; mouth: MouthPoint[]; face: FacePoints; box: FaceBox; mirrored: boolean };

/** Roda o detector e converte para o que o app usa. Devolve null se não houver rosto. */
export async function detectFace(landmarker: FaceLandmarkerHandle, uri: string): Promise<FaceDetection | null> {
  const b64 = await photoToBase64(uri, 1024);
  const lm = await landmarker.detect(b64);
  if (!lm) return null;
  return { landmarks: lm, mouth: mouthFromLandmarks(lm), face: facePointsFromLandmarks(lm), box: faceBoxFromLandmarks(lm), mirrored: isMirrored(lm) };
}

export type TeethFit = { params: SmileParams; fit: AutoFit };

/**
 * Recorta a boca da foto, analisa os pixels e devolve os parâmetros do Smile Design
 * alinhados aos dentes reais. `midlineX` é a linha média facial (fração da largura).
 */
export async function fitTeethToPhoto(photo: Photo, mouth: MouthPoint[], midlineX: number, base: SmileParams): Promise<TeethFit | null> {
  const r = await fitInRegion(photo, mouth, midlineX);
  if (!r) return null;
  return { params: autoFitToParams(r.fit, r.crop, photo.width, photo.height, base), fit: r.fit };
}

export type RegionFit = { fit: AutoFit; crop: { x: number; y: number; scale: number } };

/** Recorta a boca, analisa os pixels e devolve o ajuste em px do recorte + a transformação do recorte. */
export async function fitInRegion(photo: Photo, mouth: MouthPoint[], midlineX: number): Promise<RegionFit | null> {
  const xs = mouth.map((p) => p.x * photo.width);
  const ys = mouth.map((p) => p.y * photo.height);
  const pad = 0.15;
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - (Math.max(...xs) - Math.min(...xs)) * pad));
  const x1 = Math.min(photo.width, Math.ceil(Math.max(...xs) + (Math.max(...xs) - Math.min(...xs)) * pad));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - (Math.max(...ys) - Math.min(...ys)) * pad));
  const y1 = Math.min(photo.height, Math.ceil(Math.max(...ys) + (Math.max(...ys) - Math.min(...ys)) * pad));
  const cw = x1 - x0;
  const ch = y1 - y0;
  if (cw < 20 || ch < 10) return null;
  const targetW = 420;
  const scale = targetW / cw;
  const ref = await ImageManipulator.manipulate(photo.uri)
    .crop({ originX: x0, originY: y0, width: cw, height: ch })
    .resize({ width: targetW, height: Math.round(ch * scale) })
    .renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 1, base64: true });
  if (!out.base64) return null;
  const img = decode(base64ToBytes(out.base64), { useTArray: true, formatAsRGBA: true, colorTransform: true });
  const mouthPx = mouth.map((p) => ({ x: (p.x * photo.width - x0) * scale, y: (p.y * photo.height - y0) * scale }));
  const fit = autoFitTeeth({ data: img.data, width: img.width, height: img.height }, mouthPx, (midlineX * photo.width - x0) * scale);
  if (!fit) return null;
  return { fit, crop: { x: x0, y: y0, scale } };
}

/**
 * Sem rosto na foto (sorriso de perto): varre os pixels de uma versão reduzida (360 px) e acha a abertura da boca
 * pelo lado de dentro dos lábios (`scanMouth`). Devolve o contorno em frações da foto, ou null.
 */
export async function scanMouthInPhoto(photo: Photo): Promise<MouthPoint[] | null> {
  const targetW = 360;
  const ref = await ImageManipulator.manipulate(photo.uri).resize({ width: targetW }).renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.92, base64: true });
  if (!out.base64) return null;
  const img = decode(base64ToBytes(out.base64), { useTArray: true, formatAsRGBA: true, colorTransform: true });
  return scanMouth({ data: img.data, width: img.width, height: img.height })?.mouth ?? null;
}
