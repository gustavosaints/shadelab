/**
 * Funções comuns da medição das escalas (measure.mjs = VITA Classical, measure-3d.mjs = VITA 3D-Master).
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

export const FF =
  process.env.FFMPEG ??
  'C:/Users/Studio Art In Dent/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';

const toLin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
export function linToLab([r, g, b]) {
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const fx = f(x / 0.95047), fy = f(y), fz = f(z / 1.08883);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}
const luma = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];

export function loadPng(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const W = png.width;
  const lin = (x, y) => {
    const i = (y * W + x) * 4;
    return [toLin(png.data[i]), toLin(png.data[i + 1]), toLin(png.data[i + 2])];
  };
  return { png, W, H: png.height, lin };
}

/**
 * Média robusta em RGB linear num retângulo: descarta 15 % mais claros e 15 % mais escuros. Com `crownOnly`,
 * antes tira o fundo escuro que aparece nas bordas arredondadas da coroa (pixels < 55 % do percentil 80).
 */
export function robustMean(img, x0, y0, w, h, gain = [1, 1, 1], crownOnly = false) {
  let px = [];
  for (let y = Math.round(y0); y < Math.round(y0 + h); y++)
    for (let x = Math.round(x0); x < Math.round(x0 + w); x++) {
      const [r, g, b] = img.lin(x, y);
      px.push([r * gain[0], g * gain[1], b * gain[2]]);
    }
  px.sort((p, q) => luma(p) - luma(q));
  if (crownOnly) {
    const ref = luma(px[Math.floor(px.length * 0.8)]);
    px = px.filter((p) => luma(p) >= ref * 0.55);
  }
  const kept = px.slice(Math.floor(px.length * 0.15), Math.ceil(px.length * 0.85));
  const m = [0, 0, 0];
  for (const p of kept) for (let k = 0; k < 3; k++) m[k] += p[k] / kept.length;
  return m;
}

/**
 * Terços de um tab dentro da caixa da coroa. O cabo de metal entra pela CERVICAL: com o tab em pé na foto
 * (cabo para baixo), o topo da caixa é o terço incisal. Miolo de 56 % da largura, 10 % cortados em cima e embaixo.
 */
export function thirdsOf(img, box, gain, crownOnly = false) {
  const x0 = box.x + box.w * 0.22, w = box.w * 0.56;
  const top = box.y + box.h * 0.1, h = (box.h * 0.8) / 3;
  const [incisal, middle, cervical] = [0, 1, 2].map((k) => robustMean(img, x0, top + k * h, w, h * 0.9, gain, crownOnly));
  return { cervical, middle, incisal };
}

/** Marca as caixas e as linhas dos terços numa cópia da imagem, para conferir. */
export function writePreview(file, out, boxes, extra = []) {
  const { png, W, H } = loadPng(file);
  const mark = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2];
  };
  const rect = ({ x, y, w, h }, c) => {
    for (let xx = x; xx < x + w; xx++) { mark(xx, y, c); mark(xx, y + h - 1, c); }
    for (let yy = y; yy < y + h; yy++) { mark(x, yy, c); mark(x + w - 1, yy, c); }
  };
  for (const box of boxes) {
    rect(box, [255, 0, 0]);
    for (let kk = 1; kk < 3; kk++) {
      const yy = Math.round(box.y + box.h * 0.1 + (box.h * 0.8 * kk) / 3);
      for (let xx = Math.round(box.x + box.w * 0.22); xx < box.x + box.w * 0.78; xx++) mark(xx, yy, [0, 120, 255]);
    }
  }
  for (const box of extra) rect(box, [0, 220, 0]);
  fs.writeFileSync(out, PNG.sync.write(png));
}

const r1 = (v) => Math.round(v * 10) / 10;
export const roundLab = (lab) => ({ L: r1(lab.L), a: r1(lab.a), b: r1(lab.b) });
const fmt = (lab) => `{ L: ${lab.L}, a: ${lab.a}, b: ${lab.b} }`;
const key = (id) => (/^[A-Za-z_$][\w$]*$/.test(id) ? id : `'${id}'`);

/**
 * Grava o .ts do app com Lab do terço médio, os terços e as fotos (require dos recortes).
 * `tabs`: [{ id, cervical, middle, incisal, image? }] — `image` = nome do arquivo em `imageDir`.
 */
export function writeMeasuredTs(out, { header, prefix, tabs, imageDir }) {
  const lines = [...header.map((l) => `// ${l}`), "import type { Lab } from './convert';", "import type { ThirdsProfile } from './match';", ''];
  lines.push(`export const ${prefix}_MEASURED: Partial<Record<string, Lab>> = {`);
  for (const t of tabs) lines.push(`  ${key(t.id)}: ${fmt(t.middle)},`);
  lines.push('};', '');
  lines.push(`export const ${prefix}_THIRDS: Partial<Record<string, ThirdsProfile>> = {`);
  for (const t of tabs) lines.push(`  ${key(t.id)}: { cervical: ${fmt(t.cervical)}, middle: ${fmt(t.middle)}, incisal: ${fmt(t.incisal)} },`);
  lines.push('};', '');
  lines.push('/** Foto recortada de cada tab da escala real (resultados, caso salvo e PDF). */');
  lines.push(`export const ${prefix}_IMAGES: Partial<Record<string, number>> = {`);
  for (const t of tabs) if (t.image) lines.push(`  ${key(t.id)}: require('${imageDir}/${t.image}'),`);
  lines.push('};', '');
  fs.writeFileSync(out, lines.join('\n'));
}
