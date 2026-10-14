/**
 * Renderiza os anteriores superiores de cada biblioteca de anatomia como
 * sprites para o Smile Design.
 *
 *   node scripts/anatomia/render.mjs              # bibliotecas de libraries.json → assets/anatomia + catálogo TS
 *   node scripts/anatomia/render.mjs --previews   # todas as bibliotecas de reference/anatomia → reference/renders
 *   node scripts/anatomia/render.mjs --previews --only "generic,Jan Hajto F1" --sheet app   # grava _folha-de-contato-app
 *
 * Cada dente vira três camadas PNG com fundo transparente, para o app tingir
 * pela cor-alvo preservando o sombreamento:
 *   *-fill.png   branco, alfa = cobertura × translucidez (recebe tintColor)
 *   *-shade.png  preto,  alfa = (1 − difusa)  → escurece colo e faces proximais
 *   *-gloss.png  branco, alfa = especular     → reflexos da luz de estúdio
 *
 * Orientação das malhas do exocad (verificada): x = mesial do dente direito,
 * y = vestibular, z = incisal. O upperjaw.xml dá a posição de cada dente no
 * arco; a câmera olha o arco de frente, então lateral e canino já aparecem
 * girados como numa foto frontal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMesh, readToothBow } from './mesh.mjs';
import { rasterize, norm, cross, dot, scale, sub } from './raster.mjs';
import { encodePng } from './png.mjs';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REF = path.join(ROOT, 'reference/anatomia');
const PREVIEWS = path.join(ROOT, 'reference/renders');
const ASSETS = path.join(ROOT, 'assets/anatomia');
const CATALOG_TS = path.join(ROOT, 'src/lib/smile/anatomyCatalog.ts');
const LIBS_JSON = path.join(ROOT, 'scripts/anatomia/libraries.json');

const KINDS = [
  { kind: 'central', file: 1, fdi: '11' },
  { kind: 'lateral', file: 2, fdi: '12' },
  { kind: 'canine', file: 3, fdi: '13' },
];
const CENTRAL_PX = 320; // altura do central no sprite final
const SS = 2; // supersampling

// ---------- iluminação de estúdio (espaço da câmera: x direita, y cima, z para a câmera) ----------
const LIGHTS = [
  { dir: norm([-0.3, 0.45, 1.0]), diffuse: 0.7, specular: 0.3, shininess: 40 }, // principal, alto à esquerda
  { dir: norm([-0.12, 0.1, 1.0]), diffuse: 0.0, specular: 0.2, shininess: 6 }, // softbox largo (brilho vertical suave)
  { dir: norm([0.7, -0.1, 0.75]), diffuse: 0.3, specular: 0.08, shininess: 20 }, // preenchimento à direita
  { dir: norm([0.1, 1.0, 0.4]), diffuse: 0.15, specular: 0.0, shininess: 1 }, // luz de cima
];
const AMBIENT = 0.3;
/** Escurecimento máximo pela sombra (a cor-alvo escolhida deve continuar dominando). */
const SHADE_DEPTH = 0.55;

function shade(n) {
  const nz = Math.max(0, n[2]);
  let d = AMBIENT + 0.06 * nz;
  let s = 0;
  for (const l of LIGHTS) {
    const ndl = Math.max(0, dot(n, l.dir));
    d += l.diffuse * ndl;
    if (l.specular > 0 && ndl > 0) {
      const h = norm([l.dir[0], l.dir[1], l.dir[2] + 1]);
      s += l.specular * Math.pow(Math.max(0, dot(n, h)), l.shininess);
    }
  }
  // leve efeito Fresnel nas bordas (o esmalte reflete mais de raspão)
  s += 0.1 * Math.pow(1 - nz, 3);
  const lit = Math.min(1, Math.pow(d, 0.9));
  return { d: 1 - SHADE_DEPTH * (1 - lit), s: Math.min(0.85, s) };
}

/** Reduz uma imagem RGBA por um fator inteiro (média dos blocos). */
function downscale(rgba, w, h, f) {
  const W = Math.floor(w / f);
  const H = Math.floor(h / f);
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const acc = [0, 0, 0, 0];
      for (let dy = 0; dy < f; dy++)
        for (let dx = 0; dx < f; dx++) {
          const i = ((y * f + dy) * w + x * f + dx) * 4;
          for (let c = 0; c < 4; c++) acc[c] += rgba[i + c];
        }
      for (let c = 0; c < 4; c++) out[(y * W + x) * 4 + c] = Math.round(acc[c] / (f * f));
    }
  return { width: W, height: H, rgba: out };
}

/** Eixos do arco: anterior (para o observador), oclusal (para cima no arco). */
function archFrame(bow) {
  const p = (n) => bow[n]?.position;
  const ant = norm(sub(scale([p('11'), p('21')].reduce((a, b) => a.map((v, i) => v + b[i])), 0.5), scale([p('16'), p('26')].reduce((a, b) => a.map((v, i) => v + b[i])), 0.5)));
  // plano oclusal do arco pelas posições dos dentes (ponto médio dos centrais, 16 e 26): os eixos dos
  // anteriores são inclinados para vestibular e não servem — a câmera olharia de cima para dentro dos colos
  const m = scale([p('11'), p('21')].reduce((a, b) => a.map((v, i) => v + b[i])), 0.5);
  let occ = norm(cross(sub(p('16'), m), sub(p('26'), m)));
  const meanAxis = norm(Object.values(bow).map((t) => norm(t.occlusal)).reduce((a, b) => a.map((v, i) => v + b[i])));
  if (dot(occ, meanAxis) < 0) occ = scale(occ, -1);
  // ortogonaliza anterior em relação ao oclusal: câmera na altura da boca, horizontal
  const a2 = norm(sub(ant, scale(occ, dot(ant, occ))));
  return { anterior: a2, occlusal: occ };
}

/** Matriz local→mundo do dente (colunas: mesial, vestibular, oclusal) a partir do XML. */
function toothRotation(t) {
  const m = norm(t.mesial);
  const o = norm(sub(norm(t.occlusal), scale(m, dot(norm(t.occlusal), m))));
  const f = cross(o, m); // vestibular, dente do lado direito (frame destro)
  return { m, f, o };
}

/** Aplica a rotação local→mundo à malha (devolve nova malha). */
function placeMesh(mesh, rot, pos) {
  const out = new Float32Array(mesh.positions.length);
  for (let i = 0; i < out.length; i += 3) {
    const x = mesh.positions[i];
    const y = mesh.positions[i + 1];
    const z = mesh.positions[i + 2];
    out[i] = pos[0] + x * rot.m[0] + y * rot.f[0] + z * rot.o[0];
    out[i + 1] = pos[1] + x * rot.m[1] + y * rot.f[1] + z * rot.o[1];
    out[i + 2] = pos[2] + x * rot.m[2] + y * rot.f[2] + z * rot.o[2];
  }
  return { positions: out, indices: mesh.indices };
}

function meshFile(lib, n) {
  for (const f of [`${n}.eoff`, `${n}.stl`]) {
    const p = path.join(REF, lib, 'upperjaw', f);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Altura visível da coroa do central (mm) — as malhas do exocad costumam ter uma extensão cervical longa. */
const crownHeight = (c) => Math.min(c.hMm, Math.max(1.3 * c.wMm, 11));
/** Zênite gengival por dente (mm abaixo da linha do central): lateral um pouco mais baixo. */
const ZENITH = { central: 0, lateral: 0.8, canine: 0 };
/** Transição suave na margem gengival (mm). */
const GUM_FADE_MM = 1.2;

/**
 * Renderiza um dente; devolve camadas já reduzidas (alfa 0..255) e medidas em mm.
 * `gumLineMm` (coordenada vertical do arco, para cima) corta o sprite na linha da gengiva.
 */
function renderTooth(lib, spec, bow, arch, ppm, gumLineMm) {
  const file = meshFile(lib, spec.file);
  if (!file) throw new Error(`${lib}: falta ${spec.file}.eoff/.stl`);
  const raw = readMesh(file);
  const mesh = placeMesh(raw, toothRotation(bow[spec.fdi]), bow[spec.fdi].position);
  const toward = scale(arch.anterior, -1); // câmera na frente do arco olhando para trás
  const up = scale(arch.occlusal, -1); // superiores: incisal para baixo
  const right = norm(cross(toward, up));
  const r0 = rasterize(mesh, { right, up, toward }, ppm * SS, 2 * SS);

  // corte na linha da gengiva: descarta as linhas acima dela e esmaece a margem
  const cropTopMm = gumLineMm === undefined ? r0.bounds.maxY : Math.min(r0.bounds.maxY, gumLineMm - ZENITH[spec.kind]);
  const skipRows = Math.max(0, Math.floor((r0.bounds.maxY - cropTopMm) * ppm * SS));
  const r = { ...r0, height: r0.height - skipRows, bounds: { ...r0.bounds, maxY: r0.bounds.maxY - skipRows / (ppm * SS) } };
  const rowOf = (y) => y + skipRows;

  const W = Math.ceil(r.width / SS);
  const H = Math.ceil(r.height / SS);
  const fill = new Float32Array(W * H);
  const shd = new Float32Array(W * H);
  const gls = new Float32Array(W * H);
  const hPx = r.height;
  const fadePx = GUM_FADE_MM * ppm * SS;
  for (let y = 0; y < r.height; y++) {
    for (let x = 0; x < r.width; x++) {
      const i = rowOf(y) * r.width + x;
      let n;
      if (r.front[i] !== -Infinity) n = norm([r.normals[i * 3], r.normals[i * 3 + 1], r.normals[i * 3 + 2]]);
      else if (r.any[i] !== -Infinity) n = norm([-r.anyNormals[i * 3], -r.anyNormals[i * 3 + 1], -r.anyNormals[i * 3 + 2]]); // parede interna do colo aberto
      else continue;
      // corte plano do colo (face virada para cima): fica fora do sprite
      if (n[1] > 0.8) continue;
      const { d, s } = shade(n);
      // translucidez incisal: onde o dente é fino (mm) e está no terço incisal
      const thickness = (r.front[i] === -Infinity ? r.any[i] : r.front[i]) - r.back[i];
      const inc = Math.min(1, Math.max(0, (y / hPx - 0.58) / 0.42));
      const thin = Math.min(1, Math.max(0, 1 - thickness / 2.4));
      let alpha = 1 - 0.55 * inc * Math.pow(thin, 1.6);
      if (y < fadePx) alpha *= y / fadePx; // margem gengival suave (também esconde o corte do colo)
      const o = Math.floor(y / SS) * W + Math.floor(x / SS);
      fill[o] += alpha;
      shd[o] += alpha * (1 - d);
      gls[o] += alpha * s;
    }
  }
  // fecha frestas verticais (a margem cervical recortada das coroas deixa ver através do colo)
  const maxHole = Math.round(3 * ppm);
  const full = SS * SS;
  for (let x = 0; x < W; x++) {
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < H; y++) if (fill[y * W + x] > 0) { if (top < 0) top = y; bottom = y; }
    if (top < 0) continue;
    for (let y = top; y <= bottom; y++) {
      if (fill[y * W + x] > 0) continue;
      let end = y;
      while (end <= bottom && fill[end * W + x] === 0) end++;
      if (end - y <= maxHole) {
        // sombra e brilho interpolados entre as bordas da fresta, para o remendo não aparecer
        const i0 = (y - 1) * W + x;
        const i1 = Math.min(bottom, end) * W + x;
        for (let k = y; k < end; k++) {
          const a = full * Math.min(1, (k * SS) / fadePx);
          const t = (k - y + 1) / (end - y + 1);
          fill[k * W + x] = a;
          shd[k * W + x] = (a / full) * ((shd[i0] / fill[i0]) * (1 - t) + (shd[i1] / fill[i1]) * t) * full;
          gls[k * W + x] = (a / full) * ((gls[i0] / fill[i0]) * (1 - t) + (gls[i1] / fill[i1]) * t) * full;
        }
      }
      y = end;
    }
  }
  const toLayer = (buf, rgb) => {
    const out = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      out[i * 4] = rgb;
      out[i * 4 + 1] = rgb;
      out[i * 4 + 2] = rgb;
      out[i * 4 + 3] = Math.round((255 * Math.min(1, buf[i] / (SS * SS))) );
    }
    return out;
  };
  // posição do dente no arco projetada na vista (mm): topo = colo, base = incisal
  const bounds = r.bounds;
  return {
    width: W,
    height: H,
    fill: toLayer(fill, 255),
    shade: toLayer(shd, 0),
    gloss: toLayer(gls, 255),
    wMm: bounds.maxX - bounds.minX,
    hMm: bounds.maxY - bounds.minY,
    // coordenadas do arco na vista: x cresce para a direita do observador, y para cima
    leftMm: bounds.minX,
    topMm: bounds.maxY,
  };
}

/** Compõe uma prévia tingida (RGBA com alfa, para conferência visual). Mesma ordem de camadas do app. */
function composite(t, tint = [0xee, 0xe3, 0xcd]) {
  const out = new Uint8Array(t.width * t.height * 4);
  for (let i = 0; i < t.width * t.height; i++) {
    const af = t.fill[i * 4 + 3] / 255;
    const as = t.shade[i * 4 + 3] / 255;
    const ag = t.gloss[i * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) {
      let v = tint[c] * (1 - as);
      v = v * (1 - ag) + 255 * ag;
      out[i * 4 + c] = Math.round(v);
    }
    out[i * 4 + 3] = Math.round(255 * af);
  }
  return out;
}

/** Desenha src sobre dst com mistura pelo alfa. */
function blit(dst, dw, src, sw, sh, ox, oy) {
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const si = (y * sw + x) * 4;
      const a = src[si + 3] / 255;
      if (a === 0) continue;
      const di = ((oy + y) * dw + ox + x) * 4;
      for (let c = 0; c < 3; c++) dst[di + c] = Math.round(src[si + c] * a + dst[di + c] * (1 - a));
      dst[di + 3] = 255;
    }
  }
}

function renderLibrary(lib) {
  const bow = readToothBow(path.join(REF, lib, 'upperjaw.xml'));
  for (const n of ['11', '12', '13', '21', '22', '16', '26']) if (!bow[n]) throw new Error(`${lib}: XML sem dente ${n}`);
  const arch = archFrame(bow);
  // escala: o central fica com CENTRAL_PX de altura
  const probe = renderTooth(lib, KINDS[0], bow, arch, 4);
  const crown = crownHeight(probe);
  const ppm = CENTRAL_PX / crown;
  const gumLineMm = probe.topMm - probe.hMm + crown; // linha da gengiva: incisal do central + altura da coroa
  const teeth = {};
  for (const spec of KINDS) teeth[spec.kind] = renderTooth(lib, spec, bow, arch, ppm, gumLineMm);
  return { teeth, ppm };
}

function previewImage({ teeth, ppm }) {
  // 13 12 11 lado a lado, alinhados pelo arco (posição real), + espelho para 21–23
  const order = ['canine', 'lateral', 'central'];
  const left = Math.min(...order.map((k) => teeth[k].leftMm));
  const top = Math.max(...order.map((k) => teeth[k].topMm));
  const right = Math.max(...order.map((k) => teeth[k].leftMm + teeth[k].wMm));
  const bottom = Math.min(...order.map((k) => teeth[k].topMm - teeth[k].hMm));
  const halfW = Math.ceil((right - left) * ppm) + 8;
  const H = Math.ceil((top - bottom) * ppm) + 8;
  const W = halfW * 2 + 6;
  const img = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) img.set([40, 30, 30, 255], i * 4);
  for (const k of order) {
    const t = teeth[k];
    const comp = composite(t);
    const ox = Math.round((t.leftMm - left) * ppm) + 4;
    const oy = Math.round((top - t.topMm) * ppm) + 4;
    blit(img, W, comp, t.width, t.height, ox, oy);
    // espelho
    const mir = new Uint8Array(comp.length);
    for (let y = 0; y < t.height; y++)
      for (let x = 0; x < t.width; x++) mir.set(comp.subarray((y * t.width + x) * 4, (y * t.width + x) * 4 + 4), (y * t.width + (t.width - 1 - x)) * 4);
    blit(img, W, mir, t.width, t.height, W - ox - t.width, oy);
  }
  return { width: W, height: H, rgba: img };
}

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function writePreview(lib, out) {
  const p = previewImage(renderLibrary(lib));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, encodePng(p.width, p.height, p.rgba));
  return p;
}

if (flag('--occlusal')) {
  // depuração: 13 12 11 vistos pela incisal (câmera abaixo do arco), para conferir rotação e curvatura
  const lib = opt('--occlusal');
  const bow = readToothBow(path.join(REF, lib, 'upperjaw.xml'));
  const arch = archFrame(bow);
  const pos = [];
  const idx = [];
  for (const spec of KINDS) {
    const m = placeMesh(readMesh(meshFile(lib, spec.file)), toothRotation(bow[spec.fdi]), bow[spec.fdi].position);
    const base = pos.length / 3;
    pos.push(...m.positions);
    for (const i of m.indices) idx.push(base + i);
  }
  const toward = arch.occlusal; // câmera embaixo olhando para cima
  const up = arch.anterior; // frente do arco no topo da imagem
  const right = norm(cross(toward, up));
  const r = rasterize({ positions: Float32Array.from(pos), indices: Uint32Array.from(idx) }, { right, up, toward }, 12, 4);
  const rgba = new Uint8Array(r.width * r.height * 4);
  for (let i = 0; i < r.width * r.height; i++) {
    if (r.front[i] === -Infinity) {
      rgba.set([30, 30, 30, 255], i * 4);
      continue;
    }
    const { d } = shade(norm([r.normals[i * 3], r.normals[i * 3 + 1], r.normals[i * 3 + 2]]));
    rgba.set([Math.round(230 * d), Math.round(220 * d), Math.round(200 * d), 255], i * 4);
  }
  fs.mkdirSync(PREVIEWS, { recursive: true });
  const out = path.join(PREVIEWS, `_oclusal-${slug(lib)}.png`);
  fs.writeFileSync(out, encodePng(r.width, r.height, rgba));
  console.log('vista oclusal (frente do arco em cima; esquerda da imagem = lado direito do paciente):', out);
} else if (flag('--previews')) {
  const only = opt('--only')?.split(',').map((s) => s.trim());
  const libs = fs.readdirSync(REF).filter((d) => fs.existsSync(path.join(REF, d, 'upperjaw.xml')) && (!only || only.includes(d)));
  fs.mkdirSync(PREVIEWS, { recursive: true });
  const ok = [];
  for (const lib of libs) {
    try {
      const p = writePreview(lib, path.join(PREVIEWS, `${slug(lib)}.png`));
      ok.push({ lib, p });
      console.log('ok ', lib, `${p.width}x${p.height}`);
    } catch (e) {
      console.log('ERRO', lib, e.message);
    }
  }
  // folha de contato: miniaturas em grade com rótulo (sem fonte: só o índice numérico via listagem)
  const cols = 6;
  const tw = 360;
  const th = 150;
  const rows = Math.ceil(ok.length / cols);
  const sheet = new Uint8Array(cols * tw * rows * th * 4);
  for (let i = 0; i < sheet.length; i += 4) sheet.set([20, 20, 20, 255], i);
  ok.forEach(({ p }, idx) => {
    const s = Math.min((tw - 8) / p.width, (th - 8) / p.height);
    const w = Math.floor(p.width * s);
    const h = Math.floor(p.height * s);
    const ox = (idx % cols) * tw + 4;
    const oy = Math.floor(idx / cols) * th + 4;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const sx = Math.min(p.width - 1, Math.floor(x / s));
        const sy = Math.min(p.height - 1, Math.floor(y / s));
        sheet.set(p.rgba.subarray((sy * p.width + sx) * 4, (sy * p.width + sx) * 4 + 4), ((oy + y) * cols * tw + ox + x) * 4);
      }
  });
  const sheetName = opt('--sheet') ? `_folha-de-contato-${opt('--sheet')}` : '_folha-de-contato';
  fs.writeFileSync(path.join(PREVIEWS, `${sheetName}.png`), encodePng(cols * tw, rows * th, sheet));
  fs.writeFileSync(path.join(PREVIEWS, `${sheetName}.txt`), ok.map(({ lib }, i) => `${i + 1}. ${lib}`).join('\n'));
  console.log(`\n${ok.length} prévias em ${PREVIEWS}`);
} else {
  const libs = JSON.parse(fs.readFileSync(LIBS_JSON, 'utf8'));
  fs.rmSync(ASSETS, { recursive: true, force: true });
  const entries = [];
  for (const { lib, name, shape } of libs) {
    const id = slug(lib);
    const { teeth, ppm } = renderLibrary(lib);
    const dir = path.join(ASSETS, id);
    fs.mkdirSync(dir, { recursive: true });
    const c = teeth.central;
    const teethMeta = {};
    for (const [kind, t] of Object.entries(teeth)) {
      for (const layer of ['fill', 'shade', 'gloss']) fs.writeFileSync(path.join(dir, `${kind}-${layer}.png`), encodePng(t.width, t.height, t[layer]));
      teethMeta[kind] = {
        width: t.width,
        height: t.height,
        wMm: +t.wMm.toFixed(3),
        hMm: +t.hMm.toFixed(3),
        // posição da caixa do dente (lado direito do paciente) em relação à caixa do central, em mm,
        // na vista frontal do arco: offsetX negativo = mais para a esquerda do observador; offsetY positivo = mais baixo
        offsetX: +(t.leftMm - c.leftMm).toFixed(3),
        offsetY: +(c.topMm - t.topMm).toFixed(3),
      };
    }
    const p = previewImage({ teeth, ppm });
    const thumb = downscale(p.rgba, p.width, p.height, 4);
    fs.writeFileSync(path.join(dir, 'thumb.png'), encodePng(thumb.width, thumb.height, thumb.rgba));
    fs.writeFileSync(path.join(PREVIEWS, `${id}.png`), encodePng(p.width, p.height, p.rgba));
    entries.push({ id, name, shape, teeth: teethMeta });
    console.log('ok ', lib, '→', id);
  }
  const ts = [
    '// Gerado por scripts/anatomia/render.mjs — não edite à mão.',
    "import type { AnatomyDef } from './anatomy';",
    '',
    'export const ANATOMY_CATALOG: AnatomyDef[] = [',
    ...entries.map((e) => {
      const tooth = (k) => {
        const t = e.teeth[k];
        return `    ${k}: {
      width: ${t.width}, height: ${t.height}, wMm: ${t.wMm}, hMm: ${t.hMm}, offsetX: ${t.offsetX}, offsetY: ${t.offsetY},
      fill: require('../../../assets/anatomia/${e.id}/${k}-fill.png'),
      shade: require('../../../assets/anatomia/${e.id}/${k}-shade.png'),
      gloss: require('../../../assets/anatomia/${e.id}/${k}-gloss.png'),
    },`;
      };
      return `  {
    id: '${e.id}',
    name: ${JSON.stringify(e.name)},
    shape: '${e.shape}',
    thumb: require('../../../assets/anatomia/${e.id}/thumb.png'),
    teeth: {\n${tooth('central')}\n${tooth('lateral')}\n${tooth('canine')}\n    },
  },`;
    }),
    '];',
    '',
  ].join('\n');
  fs.writeFileSync(CATALOG_TS, ts);
  console.log(`\n${entries.length} anatomias em ${ASSETS}; catálogo em ${CATALOG_TS}`);
}
