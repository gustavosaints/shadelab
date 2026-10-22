/**
 * Mede a cor REAL de cada tab da escala VITA 3D-Master do Gustavo (fotos IMG_4404–4408 de 2026-10-22, em
 * reference/escala/3d-master/, fora do git; convertidas do HEIC do iPhone, 8064×4536, e reduzidas para 2016 px).
 *
 *   node scripts/escala/measure-3d.mjs            # mede, grava o JSON, o .ts do app e as prévias com os quadros
 *   node scripts/escala/measure-3d.mjs --crops    # também recorta cada tab em assets/escala/vita-3d-master/<id>.jpg
 *
 * A escala dele vem em réguas separadas: Chroma/Hueguide 0/1, 2, 3 e 4 (placa clara) e Valueguide 0M2–5M2 (placa
 * escura). Não há a régua do grupo 5: 5M1 e 5M3 ficam com os valores da literatura e sem foto.
 * 1. Balanço de branco: a placa de cada régua (neutra) vira cinza puro.
 * 2. A placa clara é creme (não neutra): a correção por canal vem dos 5 tabs repetidos na Valueguide, cuja placa
 *    escura é neutra.
 * 3. Exposição de cada régua clara: média do L* médio dos tabs dela = média da literatura (SpectroShade, Dias 2023).
 * 4. Valueguide: exposição pelos tabs repetidos (0M2–4M2); dela sai só o 5M2.
 * 5. Terços lidos com o topo = incisal (o cabo entra pela cervical), tirando o fundo escuro das bordas.
 * Saída: scripts/escala/vita-3d-master.json, src/lib/color/vita3dMasterMeasured.ts, reference/escala/3d-master/medicao-*.png
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FF, linToLab, loadPng, robustMean, roundLab, thirdsOf, writeMeasuredTs, writePreview } from './lib.mjs';

const DIR = 'reference/escala/3d-master';
const OUT_JSON = 'scripts/escala/vita-3d-master.json';
const OUT_TS = 'src/lib/color/vita3dMasterMeasured.ts';
const CROPS = 'assets/escala/vita-3d-master';
const SCALE_FULL = 4; // 2016 px → 8064 px
const S = 2016 / 1400; // caixas marcadas na prévia de 1400 px

// literatura (SpectroShade, Dias et al. 2023) só para a exposição — os mesmos valores de shades.ts
const LIT = {
  '0M1': 81.1, '0M2': 79.8, '0M3': 79.2, '1M1': 77.5, '1M2': 77.2,
  '2L1.5': 72.7, '2L2.5': 72.3, '2M1': 72.5, '2M2': 71.8, '2M3': 73.2, '2R1.5': 72.2, '2R2.5': 73.4,
  '3L1.5': 67.0, '3L2.5': 68.6, '3M1': 68.1, '3M2': 69.2, '3M3': 68.5, '3R1.5': 71.8, '3R2.5': 70.0,
  '4L1.5': 64.8, '4L2.5': 65.6, '4M1': 65.2, '4M2': 65.3, '4M3': 66.0, '4R1.5': 65.0, '4R2.5': 65.4,
};

// caixas [x0, x1, y0, y1] na prévia de 1400 px, marcadas à mão; placa = área lisa sem texto
const ROW = (g) => [`${g}M1`, `${g}L1.5`, `${g}R1.5`, `${g}M2`, `${g}L2.5`, `${g}R2.5`, `${g}M3`];
const PHOTOS = [
  {
    file: 'IMG_4404', kind: 'chroma', plate: [650, 950, 570, 640],
    tabs: ['0M1', '0M2', '0M3', '1M1', '1M2'],
    boxes: [[442, 510, 228, 325], [515, 583, 226, 326], [590, 658, 230, 326], [732, 801, 222, 323], [810, 881, 220, 323]],
  },
  {
    file: 'IMG_4405', kind: 'chroma', plate: [620, 950, 480, 552],
    tabs: ROW(2),
    boxes: [[455, 518, 157, 250], [522, 587, 155, 250], [590, 655, 154, 250], [661, 725, 152, 248], [731, 796, 152, 248], [799, 864, 149, 246], [868, 935, 147, 244]],
  },
  {
    file: 'IMG_4406', kind: 'chroma', plate: [560, 930, 520, 600],
    tabs: ROW(3),
    boxes: [[376, 451, 159, 268], [457, 533, 159, 268], [535, 609, 157, 268], [614, 689, 159, 268], [693, 768, 157, 266], [772, 845, 154, 264], [847, 921, 154, 264]],
  },
  {
    file: 'IMG_4407', kind: 'chroma', plate: [600, 960, 560, 640],
    tabs: ROW(4),
    boxes: [[402, 476, 198, 308], [478, 552, 195, 306], [558, 633, 194, 303], [642, 716, 190, 301], [723, 798, 187, 298], [803, 878, 184, 295], [883, 958, 182, 293]],
  },
  {
    file: 'IMG_4408', kind: 'value', plate: [640, 1050, 590, 650],
    tabs: ['0M2', '1M2', '2M2', '3M2', '4M2', '5M2'],
    boxes: [[441, 520, 190, 308], [532, 610, 188, 305], [614, 694, 182, 300], [698, 778, 180, 298], [783, 862, 176, 296], [866, 944, 172, 291]],
  },
];

const toBox = ([x0, x1, y0, y1]) => ({ x: Math.round(x0 * S), y: Math.round(y0 * S), w: Math.round((x1 - x0) * S), h: Math.round((y1 - y0) * S) });

// ---------- 1. leitura de cada foto com o balanço de branco da placa ----------
const shots = PHOTOS.map((p) => {
  const src = path.join(DIR, `${p.file}-2016.png`);
  const img = loadPng(src);
  const pb = toBox(p.plate);
  const plate = robustMean(img, pb.x, pb.y, pb.w, pb.h);
  const gray = (plate[0] + plate[1] + plate[2]) / 3;
  const wb = [gray / plate[0], gray / plate[1], gray / plate[2]];
  const boxes = p.boxes.map(toBox);
  const tabs = p.tabs.map((id, i) => ({ id, box: boxes[i], lin: thirdsOf(img, boxes[i], wb, true) }));
  writePreview(src, path.join(DIR, `medicao-${p.file}.png`), boxes, [pb]);
  return { ...p, src, wb, plateGray: gray, tabs };
});

const scaleLin = (l, k) => l.map((v) => v * k);
const labOf = (l, k) => roundLab(linToLab(scaleLin(l, k)));
const solveK = (target, f) => {
  let lo = 0.05, hi = 20;
  for (let it = 0; it < 80; it++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};
const meanMidL = (list, k) => list.reduce((sum, t) => sum + linToLab(scaleLin(t.lin.middle, k)).L, 0) / list.length;

// ---------- 2. cor da placa clara: ela é creme, não neutra (os tabs saíam azulados). A placa escura da Valueguide
// é neutra; os 5 tabs que aparecem nas duas (0M2–4M2) dão a correção por canal, igual para as 4 réguas claras ----------
const chroma = shots.filter((s) => s.kind === 'chroma');
const value = shots.find((s) => s.kind === 'value');
const pairs = value.tabs.flatMap((v) => {
  const c = chroma.flatMap((s) => s.tabs).find((t) => t.id === v.id);
  return c ? [{ v: v.lin.middle, c: c.lin.middle }] : [];
});
const ratio = (ch) => pairs.reduce((sum, p) => sum + (p.v[ch] / p.c[ch]) / (p.v[1] / p.c[1]), 0) / pairs.length;
const plateFix = [ratio(0), 1, ratio(2)];
for (const s of chroma)
  for (const t of s.tabs) for (const third of ['cervical', 'middle', 'incisal']) t.lin[third] = t.lin[third].map((v, ch) => v * plateFix[ch]);

// ---------- 3. exposição de cada régua clara pela média de L* da literatura dos tabs dela (o iPhone ajusta o brilho
// de cada foto e achata as diferenças entre elas; dentro de cada foto as diferenças reais ficam) ----------
for (const s of chroma) s.k = solveK(s.tabs.reduce((sum, t) => sum + LIT[t.id], 0) / s.tabs.length, (k) => meanMidL(s.tabs, k));

const result = new Map();
for (const s of chroma)
  for (const t of s.tabs)
    result.set(t.id, { id: t.id, photo: s.file, box: t.box, cervical: labOf(t.lin.cervical, s.k), middle: labOf(t.lin.middle, s.k), incisal: labOf(t.lin.incisal, s.k) });

// ---------- 4. Valueguide: exposição pelos tabs repetidos; dela só entra o 5M2 ----------
const shared = value.tabs.filter((t) => result.has(t.id));
value.k = solveK(shared.reduce((sum, t) => sum + result.get(t.id).middle.L, 0) / shared.length, (k) => meanMidL(shared, k));
for (const t of value.tabs) {
  const lab = { cervical: labOf(t.lin.cervical, value.k), middle: labOf(t.lin.middle, value.k), incisal: labOf(t.lin.incisal, value.k) };
  if (result.has(t.id)) {
    const m = result.get(t.id).middle;
    console.log(`  conferência ${t.id}: réguas claras L${m.L} a${m.a} b${m.b} · Valueguide L${lab.middle.L} a${lab.middle.a} b${lab.middle.b}`);
  } else result.set(t.id, { id: t.id, photo: value.file, box: t.box, ...lab });
}

const ORDER = Object.keys(LIT).concat('5M2').sort((a, b) => a.localeCompare(b));
const tabs = ORDER.filter((id) => result.has(id)).map((id) => result.get(id));
fs.writeFileSync(
  OUT_JSON,
  JSON.stringify({ photos: shots.map((s) => ({ file: s.file, whiteBalance: s.wb.map((v) => +v.toFixed(4)), exposure: +s.k.toFixed(4) })), tabs }, null, 2),
);
console.log(`correção da placa clara R×${plateFix[0].toFixed(3)} B×${plateFix[2].toFixed(3)} · exposição ${shots.map((x) => `${x.file} ×${x.k.toFixed(3)}`).join(' · ')}`);
for (const t of tabs) console.log(`${t.id.padEnd(6)} médio L${t.middle.L} a${t.middle.a} b${t.middle.b} · cerv L${t.cervical.L} b${t.cervical.b} · inc L${t.incisal.L} b${t.incisal.b}${LIT[t.id] ? ` · lit L${LIT[t.id]}` : ''}`);

// ---------- 4. recortes e .ts do app ----------
const fileOf = (id) => `${id.replace('.', '_')}.jpg`;
if (process.argv.includes('--crops')) {
  fs.mkdirSync(CROPS, { recursive: true });
  for (const t of tabs) {
    const s = shots.find((p) => p.file === t.photo);
    const pad = 6;
    const x = (t.box.x - pad) * SCALE_FULL, y = (t.box.y - pad) * SCALE_FULL;
    const w = (t.box.w + pad * 2) * SCALE_FULL, h = (t.box.h + pad * 2) * SCALE_FULL;
    const fix = s.kind === 'chroma' ? plateFix : [1, 1, 1];
    const g = s.wb.map((v, ch) => (v * fix[ch] * s.k) ** (1 / 2.2));
    execFileSync(FF, ['-v', 'error', '-y', '-i', path.join(DIR, `${s.file}.jpg`), '-vf', `crop=${w}:${h}:${x}:${y},scale=260:-2,colorchannelmixer=rr=${g[0]}:gg=${g[1]}:bb=${g[2]}`, '-q:v', '3', path.join(CROPS, fileOf(t.id))]);
  }
  console.log(`recortes em ${CROPS}`);
}
writeMeasuredTs(OUT_TS, {
  header: [
    'GERADO por scripts/escala/measure-3d.mjs (scripts/escala/vita-3d-master.json) — não editar à mão.',
    'Escala VITA 3D-Master do Gustavo fotografada em 2026-10-22 (réguas Chroma/Hueguide 0/1, 2, 3, 4 e Valueguide):',
    'balanço de branco pela placa de cada régua, exposição pela placa + média de L* da literatura (SpectroShade),',
    'Valueguide ajustada pelos tabs repetidos, leitura por terços. 5M1 e 5M3 não vieram (sem a régua do grupo 5):',
    'ficam com o valor da literatura e sem foto.',
  ],
  prefix: 'VITA_3D_MASTER',
  tabs: tabs.map((t) => ({ ...t, image: fs.existsSync(path.join(CROPS, fileOf(t.id))) ? fileOf(t.id) : undefined })),
  imageDir: '../../../assets/escala/vita-3d-master',
});
console.log(`gravado ${OUT_TS}`);
