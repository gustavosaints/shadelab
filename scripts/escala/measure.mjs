/**
 * Mede a cor REAL de cada tab da escala VITA Classical do Gustavo a partir da foto da régua
 * (reference/escala/vita-classical.jpg, 8064×4536, convertida do HEIC do iPhone).
 *
 *   node scripts/escala/measure.mjs            # mede, grava o JSON e a prévia com os quadros
 *   node scripts/escala/measure.mjs --crops    # também recorta cada tab em assets/escala/vita-classical/<id>.jpg
 *
 * 1. Balanço de branco: a placa cinza da régua (neutra) vira cinza puro (ganhos por canal em RGB linear).
 * 2. Cada tab: acha a coroa pela cor (amarelada, clara) numa janela em volta da posição esperada.
 * 3. Lê os terços (média robusta: descarta 15 % mais claros e 15 % mais escuros). O cabo entra pela cervical, então
 *    o topo da coroa na foto é o terço INCISAL (até 2026-10-22 estava invertido).
 * 4. Exposição: escala o RGB linear para a média do L* do terço médio bater com a dos valores da literatura
 *    (a foto não tem referência de exposição; isso mantém as DIFERENÇAS reais entre os tabs).
 * Saída: scripts/escala/vita-classical.json, src/lib/color/vitaClassicalMeasured.ts (+ reference/escala/medicao.png).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { thirdsOf as thirdsOfImg, writeMeasuredTs } from './lib.mjs';

const SRC = 'reference/escala/vita-classical-2016.png'; // 2016 px de largura = foto / 4
const FULL = 'reference/escala/vita-classical.jpg';
const SCALE_FULL = 4;
const OUT_JSON = 'scripts/escala/vita-classical.json';
const FF = process.env.FFMPEG ?? 'C:/Users/Studio Art In Dent/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';

// rótulos das hastes na foto, da esquerda para a direita (a 8ª é um segundo A2 no lugar do B3)
const SLOTS = ['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'A2*', 'B4', 'C1', 'C2', 'C3', 'C4', 'D2', 'D3', 'D4'];
// centros aproximados (prévia de 1400 px) → ×1.44 na imagem de 2016 px
const CENTERS_1400 = [172, 250, 327, 409, 483, 557, 637, 712, 787, 863, 939, 1014, 1086, 1160, 1233, 1306];
// literatura (mesmos valores do app antes desta medição) para normalizar a exposição
const LIT = {
  A1: { L: 76.5, a: 1.0, b: 14.5 }, A2: { L: 74.5, a: 1.8, b: 17.5 }, A3: { L: 72.0, a: 2.5, b: 19.5 },
  'A3.5': { L: 69.5, a: 3.0, b: 21.5 }, A4: { L: 66.0, a: 3.0, b: 20.5 }, B1: { L: 78.0, a: -0.5, b: 12.0 },
  B2: { L: 75.5, a: 0.0, b: 17.0 }, B4: { L: 71.0, a: 1.0, b: 23.0 }, C1: { L: 72.5, a: 0.5, b: 13.0 },
  C2: { L: 69.5, a: 1.0, b: 16.0 }, C3: { L: 67.0, a: 1.5, b: 17.0 }, C4: { L: 62.5, a: 2.5, b: 19.0 },
  D2: { L: 72.0, a: 1.5, b: 14.0 }, D3: { L: 70.0, a: 1.5, b: 17.0 }, D4: { L: 69.0, a: 1.5, b: 17.0 },
};

// ---------- cor ----------
const toLin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
function linToLab([r, g, b]) {
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const fx = f(x / 0.95047), fy = f(y), fz = f(z / 1.08883);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

const png = PNG.sync.read(fs.readFileSync(SRC));
const W = png.width, H = png.height;
const lin = (x, y) => {
  const i = (y * W + x) * 4;
  return [toLin(png.data[i]), toLin(png.data[i + 1]), toLin(png.data[i + 2])];
};

/** média robusta (descarta 15 % de cada ponta pela luminância) num retângulo */
function robustMean(x0, y0, w, h, gain = [1, 1, 1]) {
  const px = [];
  for (let y = Math.round(y0); y < Math.round(y0 + h); y++)
    for (let x = Math.round(x0); x < Math.round(x0 + w); x++) {
      const [r, g, b] = lin(x, y);
      px.push([r * gain[0], g * gain[1], b * gain[2]]);
    }
  px.sort((p, q) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2] - (0.2126 * q[0] + 0.7152 * q[1] + 0.0722 * q[2]));
  const kept = px.slice(Math.floor(px.length * 0.15), Math.ceil(px.length * 0.85));
  const m = [0, 0, 0];
  for (const p of kept) for (let k = 0; k < 3; k++) m[k] += p[k] / kept.length;
  return m;
}

// ---------- 1. balanço de branco pela placa cinza (abaixo das hastes, à esquerda do texto) ----------
const plate = robustMean(200 * 1.44, 560 * 1.44, 400 * 1.44, 50 * 1.44);
const gray = (plate[0] + plate[1] + plate[2]) / 3;
const wb = [gray / plate[0], gray / plate[1], gray / plate[2]];

// ---------- 2. coroas: caixas marcadas à mão sobre reference/escala/medicao.png ----------
// (a busca automática pegava os vizinhos: as coroas ficam encostadas). Coordenadas no recorte x+60, y+240.
const BOXES_CROP = [
  [137, 235, 85, 232], [245, 357, 97, 245], [355, 462, 65, 215], [475, 585, 62, 212], [590, 690, 60, 210],
  [690, 800, 68, 218], [800, 915, 65, 218], [912, 1020, 65, 222], [1025, 1130, 60, 212], [1135, 1235, 58, 210],
  [1245, 1345, 55, 208], [1345, 1452, 58, 210], [1455, 1560, 55, 198], [1565, 1665, 58, 205], [1670, 1775, 55, 205],
  [1775, 1880, 60, 200],
];
const tabs = SLOTS.map((slot, i) => {
  const [x0, x1, y0, y1] = BOXES_CROP[i];
  return { slot, box: { x: x0 + 60, y: y0 + 240, w: x1 - x0, h: y1 - y0 } };
});
void CENTERS_1400;

// ---------- 3. terços (lib.mjs: miolo de 56 % da largura, 10 % cortados em cima e embaixo, topo = incisal) ----------
const img = { lin };
const raw = tabs.map((t) => {
  const th = thirdsOfImg(img, t.box, wb);
  return { ...t, lin: [th.cervical, th.middle, th.incisal] };
});

// ---------- 4. exposição: k tal que a média do L* médio = média da literatura ----------
const litMean = Object.values(LIT).reduce((s, v) => s + v.L, 0) / Object.keys(LIT).length;
const meanL = (k) => raw.reduce((s, t) => s + linToLab(t.lin[1].map((v) => v * k)).L, 0) / raw.length;
let lo = 0.2, hi = 5;
for (let it = 0; it < 60; it++) {
  const mid = (lo + hi) / 2;
  if (meanL(mid) < litMean) lo = mid;
  else hi = mid;
}
const k = (lo + hi) / 2;
const r1 = (v) => Math.round(v * 10) / 10;
const labOf = (l) => {
  const lab = linToLab(l.map((v) => v * k));
  return { L: r1(lab.L), a: r1(lab.a), b: r1(lab.b) };
};
const result = raw.map((t) => ({ slot: t.slot, box: t.box, cervical: labOf(t.lin[0]), middle: labOf(t.lin[1]), incisal: labOf(t.lin[2]) }));

fs.writeFileSync(OUT_JSON, JSON.stringify({ source: FULL, whiteBalance: wb.map((v) => +v.toFixed(4)), exposure: +k.toFixed(4), tabs: result }, null, 2));
console.log(`WB ${wb.map((v) => v.toFixed(3)).join(' ')} · exposição ×${k.toFixed(3)} · média L* ${meanL(k).toFixed(1)} (literatura ${litMean.toFixed(1)})`);
for (const t of result) {
  const L = LIT[t.slot.replace('*', '')];
  console.log(`${t.slot.padEnd(5)} box ${t.box.w}×${t.box.h} médio L${t.middle.L} a${t.middle.a} b${t.middle.b} · cerv L${t.cervical.L} b${t.cervical.b} · inc L${t.incisal.L} b${t.incisal.b}${L ? ` · lit L${L.L} b${L.b}` : ''}`);
}

// prévia com os quadros e os terços, para conferir
const prev = PNG.sync.read(fs.readFileSync(SRC));
const mark = (x, y, c) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  prev.data[i] = c[0]; prev.data[i + 1] = c[1]; prev.data[i + 2] = c[2];
};
for (const t of result) {
  const { x, y, w, h } = t.box;
  for (let xx = x; xx < x + w; xx++) { mark(xx, y, [255, 0, 0]); mark(xx, y + h - 1, [255, 0, 0]); }
  for (let yy = y; yy < y + h; yy++) { mark(x, yy, [255, 0, 0]); mark(x + w - 1, yy, [255, 0, 0]); }
  for (let kk = 1; kk < 3; kk++) {
    const yy = Math.round(y + h * 0.1 + (h * 0.8 * kk) / 3);
    for (let xx = Math.round(x + w * 0.22); xx < x + w * 0.78; xx++) mark(xx, yy, [0, 120, 255]);
  }
}
fs.writeFileSync('reference/escala/medicao.png', PNG.sync.write(prev));

if (process.argv.includes('--crops')) {
  const dir = 'assets/escala/vita-classical';
  fs.mkdirSync(dir, { recursive: true });
  for (const t of result) {
    if (t.slot.endsWith('*')) continue; // o A2 repetido no lugar do B3 não vira imagem
    const pad = 6;
    const x = (t.box.x - pad) * SCALE_FULL, y = (t.box.y - pad) * SCALE_FULL;
    const w = (t.box.w + pad * 2) * SCALE_FULL, h = (t.box.h + pad * 2) * SCALE_FULL;
    const out = path.join(dir, `${t.slot.replace('.', '_')}.jpg`);
    execFileSync(FF, ['-v', 'error', '-y', '-i', FULL, '-vf', `crop=${w}:${h}:${x}:${y},scale=260:-2,colorchannelmixer=rr=${wb[0] ** (1 / 2.2)}:gg=${wb[1] ** (1 / 2.2)}:bb=${wb[2] ** (1 / 2.2)}`, '-q:v', '3', out]);
  }
  console.log(`recortes em ${dir}`);
}

writeMeasuredTs('src/lib/color/vitaClassicalMeasured.ts', {
  header: [
    'GERADO por scripts/escala/measure.mjs (scripts/escala/vita-classical.json) — não editar à mão.',
    'Escala VITA Classical do Gustavo fotografada em 2026-10-22 (reference/escala/vita-classical.jpg): balanço de',
    `branco pela placa cinza da régua, exposição normalizada para a média de L* da literatura (${litMean.toFixed(1).replace('.', ',')}), leitura por`,
    'terços (topo do tab = incisal). O B3 não estava na régua (havia um A2 repetido no lugar): fica com o valor da',
    'literatura e sem foto.',
  ],
  prefix: 'VITA_CLASSICAL',
  tabs: result.filter((t) => !t.slot.endsWith('*')).map((t) => ({ ...t, id: t.slot, image: `${t.slot.replace('.', '_')}.jpg` })),
  imageDir: '../../../assets/escala/vita-classical',
});
console.log('gravado src/lib/color/vitaClassicalMeasured.ts');
