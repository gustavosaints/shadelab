import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { clampRect, type Rect } from './stats';

/** Recorta a região e devolve JPEG em base64 (para embutir no PDF), com largura máxima `maxW`. */
export async function cropToBase64(uri: string, rect: Rect, imageWidth: number, imageHeight: number, maxW = 900): Promise<{ base64: string; width: number; height: number }> {
  const crop = clampRect(rect, imageWidth, imageHeight);
  const scale = Math.min(1, maxW / crop.width);
  const width = Math.round(crop.width * scale);
  const height = Math.round(crop.height * scale);
  const ref = await ImageManipulator.manipulate(uri)
    .crop({ originX: crop.x, originY: crop.y, width: crop.width, height: crop.height })
    .resize({ width, height })
    .renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.9, base64: true });
  if (!out.base64) throw new Error('Não foi possível recortar a imagem.');
  return { base64: out.base64, width, height };
}

/** Recorta a região e grava um JPEG permanente em `Paths.document/calib/<name>.jpg` (foto do tab real). */
export async function cropToFile(uri: string, rect: Rect, imageWidth: number, imageHeight: number, name: string, maxW = 600): Promise<string> {
  const crop = clampRect(rect, imageWidth, imageHeight);
  const scale = Math.min(1, maxW / crop.width);
  const ref = await ImageManipulator.manipulate(uri)
    .crop({ originX: crop.x, originY: crop.y, width: crop.width, height: crop.height })
    .resize({ width: Math.round(crop.width * scale), height: Math.round(crop.height * scale) })
    .renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
  if (Platform.OS === 'web') return out.uri;
  const dir = new Directory(Paths.document, 'calib');
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `${name}.jpg`);
  await new File(out.uri).copy(dest, { overwrite: true });
  return dest.uri;
}

/** Lê um arquivo de imagem como base64 (data URL pronta para HTML). */
export async function fileToDataUrl(uri: string): Promise<string | null> {
  try {
    const f = new File(uri);
    if (!f.exists) return null;
    const b64 = await f.base64();
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    return null;
  }
}

/** Região em volta de um retângulo (ex.: a boca em volta do dente), limitada à imagem. */
export function expandRect(rect: Rect, factorX: number, factorY: number, imageWidth: number, imageHeight: number): Rect {
  const w = rect.width * factorX;
  const h = rect.height * factorY;
  return clampRect({ x: rect.x + rect.width / 2 - w / 2, y: rect.y + rect.height / 2 - h / 2, width: w, height: h }, imageWidth, imageHeight);
}
