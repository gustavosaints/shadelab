import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { base64ToBytes } from './base64';
import { averagePixels, clampRect, splitThirds, type Rect, type Sample } from './stats';

export type { Rect, Sample } from './stats';
export { averagePixels, clampRect, splitThirds } from './stats';

const SAMPLE_SIZE = 32;

/**
 * Recorta a região, reduz para 32x32 e lê os pixels.
 * Funciona em iOS, Android e web (expo-image-manipulator + jpeg-js).
 */
export async function sampleRegion(uri: string, rect: Rect, imageWidth: number, imageHeight: number): Promise<Sample> {
  const crop = clampRect(rect, imageWidth, imageHeight);
  const ctx = ImageManipulator.manipulate(uri);
  const ref = await ctx
    .crop({ originX: crop.x, originY: crop.y, width: crop.width, height: crop.height })
    .resize({ width: SAMPLE_SIZE, height: SAMPLE_SIZE })
    .renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 1, base64: true });
  if (!out.base64) throw new Error('Não foi possível ler os pixels da imagem.');
  const bytes = base64ToBytes(out.base64);
  const img = decode(bytes, { useTArray: true, formatAsRGBA: true, colorTransform: true });
  return averagePixels(img.data, img.width * img.height);
}

export type ThirdsSample = { cervical: Sample; middle: Sample; incisal: Sample; whole: Sample };

/**
 * Lê o dente inteiro em três faixas horizontais (terço cervical, médio e incisal) mais a média do todo.
 * `cervicalAtTop` = dente superior na foto em pé (colo em cima); false para dente inferior.
 */
export async function sampleThirds(uri: string, rect: Rect, imageWidth: number, imageHeight: number, cervicalAtTop = true): Promise<ThirdsSample> {
  const bands = splitThirds(clampRect(rect, imageWidth, imageHeight), cervicalAtTop);
  const [cervical, middle, incisal, whole] = await Promise.all([
    sampleRegion(uri, bands.cervical, imageWidth, imageHeight),
    sampleRegion(uri, bands.middle, imageWidth, imageHeight),
    sampleRegion(uri, bands.incisal, imageWidth, imageHeight),
    sampleRegion(uri, rect, imageWidth, imageHeight),
  ]);
  return { cervical, middle, incisal, whole };
}
