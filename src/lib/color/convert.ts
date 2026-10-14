/**
 * Conversões de cor: sRGB (8 bits) <-> linear <-> XYZ (D65) <-> CIELAB.
 * Iluminante D65, observador 2°. Os valores de referência das escalas
 * estão no mesmo espaço.
 */

export type RGB = { r: number; g: number; b: number }; // 0..255
export type LinearRGB = { r: number; g: number; b: number }; // 0..1
export type XYZ = { x: number; y: number; z: number };
export type Lab = { L: number; a: number; b: number };

const D65: XYZ = { x: 0.95047, y: 1.0, z: 1.08883 };

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function srgbChannelToLinear(c8: number): number {
  const c = clamp(c8, 0, 255) / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearChannelToSrgb(c: number): number {
  const v = clamp(c, 0, 1);
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return clamp(Math.round(s * 255), 0, 255);
}

export function rgbToLinear(rgb: RGB): LinearRGB {
  return {
    r: srgbChannelToLinear(rgb.r),
    g: srgbChannelToLinear(rgb.g),
    b: srgbChannelToLinear(rgb.b),
  };
}

export function linearToRgb(lin: LinearRGB): RGB {
  return {
    r: linearChannelToSrgb(lin.r),
    g: linearChannelToSrgb(lin.g),
    b: linearChannelToSrgb(lin.b),
  };
}

export function linearToXyz(lin: LinearRGB): XYZ {
  const { r, g, b } = lin;
  return {
    x: r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
    y: r * 0.2126729 + g * 0.7151522 + b * 0.072175,
    z: r * 0.0193339 + g * 0.119192 + b * 0.9503041,
  };
}

export function xyzToLinear(xyz: XYZ): LinearRGB {
  const { x, y, z } = xyz;
  return {
    r: x * 3.2404542 + y * -1.5371385 + z * -0.4985314,
    g: x * -0.969266 + y * 1.8760108 + z * 0.041556,
    b: x * 0.0556434 + y * -0.2040259 + z * 1.0572252,
  };
}

const EPS = 216 / 24389; // 0.008856
const KAPPA = 24389 / 27; // 903.3

function fLab(t: number): number {
  return t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
}

function fInvLab(t: number): number {
  const t3 = t * t * t;
  return t3 > EPS ? t3 : (116 * t - 16) / KAPPA;
}

export function xyzToLab(xyz: XYZ, white: XYZ = D65): Lab {
  const fx = fLab(xyz.x / white.x);
  const fy = fLab(xyz.y / white.y);
  const fz = fLab(xyz.z / white.z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labToXyz(lab: Lab, white: XYZ = D65): XYZ {
  const fy = (lab.L + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;
  return {
    x: fInvLab(fx) * white.x,
    y: fInvLab(fy) * white.y,
    z: fInvLab(fz) * white.z,
  };
}

export function rgbToLab(rgb: RGB): Lab {
  return xyzToLab(linearToXyz(rgbToLinear(rgb)));
}

export function labToRgb(lab: Lab): RGB {
  return linearToRgb(xyzToLinear(labToXyz(lab)));
}

export function labToLinear(lab: Lab): LinearRGB {
  return xyzToLinear(labToXyz(lab));
}

export function rgbToHex(rgb: RGB): string {
  const h = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

export function labToHex(lab: Lab): string {
  return rgbToHex(labToRgb(lab));
}

export function roundLab(lab: Lab, digits = 1): Lab {
  const f = Math.pow(10, digits);
  return {
    L: Math.round(lab.L * f) / f,
    a: Math.round(lab.a * f) / f,
    b: Math.round(lab.b * f) / f,
  };
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  if (Number.isNaN(n) || v.length !== 6) return { r: 240, g: 232, b: 218 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
