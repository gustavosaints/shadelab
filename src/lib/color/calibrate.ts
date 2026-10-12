import { clamp, labToLinear, linearToRgb, rgbToLab, rgbToLinear, type Lab, type RGB } from './convert';

export type ReferenceSpec = {
  /** Cor medida da referência na foto (sRGB). */
  measured: RGB;
  /** Cor conhecida da referência (CIELAB). */
  known: Lab;
};

/**
 * Corrige a cor medida do dente usando uma referência de cor conhecida
 * presente na mesma foto (cartão cinza, cartão branco ou um tab da escala).
 *
 * Modelo: ganho por canal no espaço RGB linear (adaptação tipo von Kries
 * no espaço do sensor). Compensa balanço de branco e exposição da câmera.
 * Os ganhos são limitados para evitar amplificar ruído em referências
 * mal iluminadas.
 */
export function correctWithReference(tooth: RGB, ref: ReferenceSpec): RGB {
  const measured = rgbToLinear(ref.measured);
  const known = labToLinear(ref.known);
  const t = rgbToLinear(tooth);

  const gain = (k: number, m: number) => clamp(k / Math.max(m, 1e-4), 0.25, 4);
  const gr = gain(known.r, measured.r);
  const gg = gain(known.g, measured.g);
  const gb = gain(known.b, measured.b);

  return linearToRgb({ r: t.r * gr, g: t.g * gg, b: t.b * gb });
}

export function correctedLab(tooth: RGB, ref?: ReferenceSpec): Lab {
  return rgbToLab(ref ? correctWithReference(tooth, ref) : tooth);
}
