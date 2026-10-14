// Gera vistas simples de um dente a partir de +x, -x, +y, -y (z para cima) para descobrir a face vestibular.
import fs from 'node:fs';
import { readMesh } from './mesh.mjs';
import { rasterize, norm, cross, scale } from './raster.mjs';
import { encodePng } from './png.mjs';

const file = process.argv[2];
const out = process.argv[3];
const mesh = readMesh(file);
const views = { '+x': [1, 0, 0], '-x': [-1, 0, 0], '+y': [0, 1, 0], '-y': [0, -1, 0] };
const tiles = [];
for (const dir of Object.values(views)) {
  const toward = norm(scale(dir, -1)); // câmera em +dir olhando para a origem
  const up = [0, 0, 1];
  const right = norm(cross(up, toward));
  const r = rasterize(mesh, { right, up, toward }, 20, 4);
  const rgba = new Uint8Array(r.width * r.height * 4);
  for (let i = 0; i < r.width * r.height; i++) {
    if (r.front[i] === -Infinity) {
      rgba.set([30, 30, 30, 255], i * 4);
      continue;
    }
    const l = 0.25 + 0.75 * Math.max(0, r.normals[i * 3] * -0.3 + r.normals[i * 3 + 1] * 0.4 + r.normals[i * 3 + 2] * 0.85);
    const v = Math.round(255 * Math.min(1, l));
    rgba.set([v, v, v, 255], i * 4);
  }
  tiles.push({ ...r, rgba });
}
const W = tiles.reduce((s, t) => s + t.width + 10, 0);
const H = Math.max(...tiles.map((t) => t.height));
const all = new Uint8Array(W * H * 4);
let ox = 0;
for (const t of tiles) {
  for (let y = 0; y < t.height; y++) all.set(t.rgba.subarray(y * t.width * 4, (y + 1) * t.width * 4), (y * W + ox) * 4);
  ox += t.width + 10;
}
fs.writeFileSync(out, encodePng(W, H, all));
console.log('ordem: +x  -x  +y  -y  (z para cima)', W, H);
