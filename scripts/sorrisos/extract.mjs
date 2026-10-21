/**
 * Recorta os quatro arcos renderizados da imagem "tipos de sorriso" (retangular, triangular, arredondado,
 * quadrado) para PNGs com fundo transparente e mede a geometria que o app precisa para encaixar cada um:
 * linha média, borda incisal e largura do central (em px do recorte).
 *
 *   node scripts/sorrisos/extract.mjs
 *
 * Entrada: reference/sorrisos/tipos-de-sorriso.png (fundo preto). Saída: assets/sorrisos/<id>.png e
 * src/lib/smile/smileLibrary.ts (GERADO).
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const SRC = 'reference/sorrisos/tipos-de-sorriso.png';
const OUT = 'assets/sorrisos';
const TS = 'src/lib/smile/smileLibrary.ts';

const png = PNG.sync.read(fs.readFileSync(SRC));
const W = png.width;
const px = (x, y) => {
  const i = (y * W + x) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
};
const bright = (x, y) => Math.max(...px(x, y));

/** Regiões aproximadas (metade esquerda/direita × faixa de linhas) de cada arco renderizado. */
const REGIONS = [
  { id: 'retangular', name: 'Retangular', x0: 0, x1: 351, y0: 140, y1: 240 },
  { id: 'triangular', name: 'Triangular', x0: 351, x1: 702, y0: 140, y1: 240 },
  { id: 'arredondado', name: 'Arredondado', x0: 0, x1: 351, y0: 470, y1: 570 },
  { id: 'quadrado', name: 'Quadrado', x0: 351, x1: 702, y0: 470, y1: 570 },
];

fs.mkdirSync(OUT, { recursive: true });
const entries = [];
for (const r of REGIONS) {
  // caixa envolvente do conteúdo claro
  let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
  for (let y = r.y0; y < r.y1; y++)
    for (let x = r.x0; x < r.x1; x++)
      if (bright(x, y) > 40) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
  const pad = 3;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [R, G, B] = px(minX + x, minY + y);
      const m = Math.max(R, G, B);
      // alfa a partir do brilho: fundo preto some, sombras entre dentes ficam translúcidas
      const a = Math.max(0, Math.min(1, (m - 14) / 36));
      const o = (y * w + x) * 4;
      // desfaz a pré-multiplicação pelo preto para a cor não escurecer nas bordas
      const k = a > 0 ? 1 / a : 0;
      out.data[o] = Math.min(255, Math.round(R * k));
      out.data[o + 1] = Math.min(255, Math.round(G * k));
      out.data[o + 2] = Math.min(255, Math.round(B * k));
      out.data[o + 3] = Math.round(a * 255);
    }
  fs.writeFileSync(path.join(OUT, `${r.id}.png`), PNG.sync.write(out));

  // ---- medidas: perfil de brilho por coluna na metade inferior (coroas), vales = espaços interproximais
  const col = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let y = Math.round(h * 0.35); y < Math.round(h * 0.8); y++) { s += bright(minX + x, minY + y); n++; }
    col[x] = s / n;
  }
  const smooth = col.map((_, i) => (col[Math.max(0, i - 1)] + col[i] + col[Math.min(w - 1, i + 1)]) / 3);
  const center = w / 2;
  // linha média: vale mais profundo perto do centro
  let mid = Math.round(center), best = Infinity;
  for (let x = Math.round(center - w * 0.08); x <= Math.round(center + w * 0.08); x++) if (smooth[x] < best) { best = smooth[x]; mid = x; }
  // próximos vales à esquerda e à direita (contato central/lateral)
  const valley = (dir) => {
    let x = mid + dir * 4;
    while (x > 2 && x < w - 3 && !(smooth[x] < smooth[x - 1] && smooth[x] <= smooth[x + 1] && smooth[x] < 0.85 * Math.max(...smooth.slice(Math.min(mid, x), Math.max(mid, x) + 1)))) x += dir;
    return x;
  };
  const vl = valley(-1), vr = valley(1);
  const centralWidth = ((mid - vl) + (vr - mid)) / 2;
  // borda incisal e colo dos centrais: linhas extremas com pixel claro nas colunas dos centrais
  let incisal = 0, gum = h;
  for (let y = 0; y < h; y++)
    for (let x = vl + 2; x < vr - 2; x++) if (bright(minX + x, minY + y) > 60) { incisal = Math.max(incisal, y); gum = Math.min(gum, y); }
  entries.push({ id: r.id, name: r.name, width: w, height: h, midlineX: mid + 0.5, incisalY: incisal + 1, gumY: gum, centralWidth });
  console.log(`${r.id}: ${w}x${h} midline=${mid} central=${centralWidth.toFixed(1)}px (vales ${vl}/${vr}) gum=${gum} incisal=${incisal}`);
}

const lines = entries.map(
  (e) =>
    `  { id: '${e.id}', name: '${e.name}', image: require('../../../assets/sorrisos/${e.id}.png'), width: ${e.width}, height: ${e.height}, midlineX: ${e.midlineX}, incisalY: ${e.incisalY}, gumY: ${e.gumY}, centralWidth: ${+e.centralWidth.toFixed(1)} },`,
);
fs.writeFileSync(
  TS,
  `// GERADO por scripts/sorrisos/extract.mjs — não editar à mão.
// Arcos 2D (foto/render) recortados de reference/sorrisos/tipos-de-sorriso.png. Medidas em px do PNG.
export type SmileLibraryEntry = {
  id: string;
  name: string;
  image: number;
  width: number;
  height: number;
  /** Linha média (x), borda incisal e colo dos centrais (y), largura de um central — em px do PNG. */
  midlineX: number;
  incisalY: number;
  gumY: number;
  centralWidth: number;
};
export const SMILE_LIBRARY: SmileLibraryEntry[] = [
${lines.join('\n')}
];
`,
);
console.log(`→ ${TS}`);
