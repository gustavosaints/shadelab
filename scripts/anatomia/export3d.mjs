/**
 * Exporta um ARCO COMPLETO (superior 17–27 e inferior 37–47) de uma biblioteca de dentes do exocad para um
 * arquivo binário compacto que o visualizador 3D do app (WebView + three.js) carrega.
 *
 *   node scripts/anatomia/export3d.mjs --lib "BRYAN AVELAR - X1" --id avelar-x1 --name "Avelar X1" [--tris 2500]
 *   node scripts/anatomia/export3d.mjs --all            # todas as entradas de scripts/anatomia/arcos.json
 *
 * Origem: a biblioteca "teeth" da instalação do exocad (malhas 1..8 = dentes do lado direito; o lado esquerdo é
 * o espelho) + o XML do arco (posição e eixos de cada dente), na própria pasta ou em library/metadata/<nome>/.
 *
 * Referencial de saída (mm): x = esquerda do paciente (direita de quem olha), y = para cima (cabeça),
 * z = para a frente (observador). Origem: linha média, borda incisal dos centrais superiores em y = 0 e face
 * vestibular dos centrais superiores em z = 0. O inferior entra com 2 mm de sobremordida.
 *
 * Formato do .bin: "SL3D" | uint32 tamanho do JSON | JSON (cabeçalho) | int16 posições | uint16 índices.
 * Cabeçalho: { id, name, scale (mm por unidade), teeth: [{ fdi, jaw, vOff, vCount, iOff, iCount }] }.
 */
import fs from 'node:fs';
import path from 'node:path';
import { MeshoptSimplifier } from 'meshoptimizer';
import { readMesh, readToothBow } from './mesh.mjs';

const SRC = 'C:/exocad-DentalCAD3.3-SR1-2026-01-16/DentalCADApp/library/teeth';
const META = path.join(SRC, '..', 'metadata');
const OUT = path.resolve('assets/arcos');
const CATALOG_TS = path.resolve('src/lib/smile/archCatalog.ts');
const LIST = path.resolve('scripts/anatomia/arcos.json');

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const TRIS = +opt('--tris', 2500);
const OVERBITE_MM = 2;

// ---------- vetores ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Eixos locais do dente a partir do XML: m = mesial, o = oclusal (ortogonal a m), f = vestibular. */
function toothFrame(t, left) {
  const m = norm(t.mesial);
  const o = norm(sub(norm(t.occlusal), scale(m, dot(norm(t.occlusal), m))));
  // dente direito: frame destro (f = o × m). Esquerdo: a malha do direito é ESPELHADA (f = m × o, det < 0).
  const f = left ? cross(m, o) : cross(o, m);
  return { m, f, o };
}

function findMesh(lib, jaw, n) {
  for (const f of [`${n}.eoff`, `${n}.stl`]) {
    const p = path.join(SRC, lib, jaw, f);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
function findXml(lib, jaw) {
  for (const p of [path.join(SRC, lib, `${jaw}.xml`), path.join(META, lib, `${jaw}.xml`)]) if (fs.existsSync(p)) return p;
  return null;
}

/** Simplifica para ~TRIS triângulos preservando a borda cervical; devolve malha compacta. */
function simplify(mesh) {
  const target = Math.min(mesh.indices.length, TRIS * 3);
  const [idx] = MeshoptSimplifier.simplify(mesh.indices, mesh.positions, 3, target, 0.02, ['LockBorder']);
  const [remap, unique] = MeshoptSimplifier.compactMesh(idx);
  const positions = new Float32Array(unique * 3);
  for (let v = 0; v < remap.length; v++) {
    const r = remap[v];
    if (r === 0xffffffff) continue;
    positions[r * 3] = mesh.positions[v * 3];
    positions[r * 3 + 1] = mesh.positions[v * 3 + 1];
    positions[r * 3 + 2] = mesh.positions[v * 3 + 2];
  }
  // compactMesh já reescreve `idx` com os novos índices; `remap` serve só para mover os vértices
  return { positions, indices: idx };
}

/** Aplica rotação (colunas m,f,o) + translação; inverte o sentido das faces quando é espelho. */
function place(mesh, fr, pos, mirrored) {
  const out = new Float32Array(mesh.positions.length);
  for (let i = 0; i < out.length; i += 3) {
    const x = mesh.positions[i];
    const y = mesh.positions[i + 1];
    const z = mesh.positions[i + 2];
    out[i] = pos[0] + x * fr.m[0] + y * fr.f[0] + z * fr.o[0];
    out[i + 1] = pos[1] + x * fr.m[1] + y * fr.f[1] + z * fr.o[1];
    out[i + 2] = pos[2] + x * fr.m[2] + y * fr.f[2] + z * fr.o[2];
  }
  let indices = mesh.indices;
  if (mirrored) {
    indices = new Uint32Array(mesh.indices.length);
    for (let t = 0; t < indices.length; t += 3) {
      indices[t] = mesh.indices[t];
      indices[t + 1] = mesh.indices[t + 2];
      indices[t + 2] = mesh.indices[t + 1];
    }
  }
  return { positions: out, indices };
}

/** Do referencial do XML (z = oclusal da arcada, y = anterior) para o do app (y = cabeça, z = frente). */
function toWorld(mesh, jaw) {
  const p = mesh.positions;
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    out[i] = p[i];
    out[i + 1] = jaw === 'upper' ? -p[i + 2] : p[i + 2];
    out[i + 2] = p[i + 1];
  }
  return { positions: out, indices: mesh.indices };
}

export async function exportLibrary({ lib, id, name }) {
  await MeshoptSimplifier.ready;
  const teeth = [];
  for (const [jaw, jawName, rightQ, leftQ] of [
    ['upper', 'upperjaw', 1, 2],
    ['lower', 'lowerjaw', 4, 3],
  ]) {
    const xmlFile = findXml(lib, jawName);
    if (!xmlFile) {
      console.warn(`  ${lib}: sem ${jawName}.xml — arcada ${jaw} pulada`);
      continue;
    }
    const bow = readToothBow(xmlFile);
    for (let n = 1; n <= 7; n++) {
      const file = findMesh(lib, jawName, n);
      if (!file) continue;
      const raw = readMesh(file);
      const small = simplify(raw);
      for (const [q, left] of [
        [rightQ, false],
        [leftQ, true],
      ]) {
        const fdi = `${q}${n}`;
        const t = bow[fdi];
        if (!t) continue;
        const placed = toWorld(place(small, toothFrame(t, left), t.position, left), jaw);
        teeth.push({ fdi, jaw, ...placed });
      }
    }
  }
  if (!teeth.length) throw new Error(`${lib}: nenhum dente exportado`);

  // origem: linha média x = 0, borda incisal dos centrais superiores y = 0, vestibular dos centrais z = 0
  const centrals = teeth.filter((t) => t.fdi === '11' || t.fdi === '21');
  let yU = Infinity;
  let zU = -Infinity;
  for (const t of centrals)
    for (let i = 0; i < t.positions.length; i += 3) {
      yU = Math.min(yU, t.positions[i + 1]);
      zU = Math.max(zU, t.positions[i + 2]);
    }
  const lowerIncisors = teeth.filter((t) => t.fdi === '31' || t.fdi === '41');
  let yLtip = -Infinity;
  for (const t of lowerIncisors) for (let i = 0; i < t.positions.length; i += 3) yLtip = Math.max(yLtip, t.positions[i + 1]);
  const dyLower = lowerIncisors.length ? yU + OVERBITE_MM - yLtip : 0;
  for (const t of teeth)
    for (let i = 0; i < t.positions.length; i += 3) {
      t.positions[i + 1] += (t.jaw === 'lower' ? dyLower : 0) - yU;
      t.positions[i + 2] -= zU;
    }

  // quantização int16
  let ext = 0;
  for (const t of teeth) for (const v of t.positions) ext = Math.max(ext, Math.abs(v));
  const q = ext / 32000;
  let vTotal = 0;
  let iTotal = 0;
  for (const t of teeth) {
    vTotal += t.positions.length / 3;
    iTotal += t.indices.length;
  }
  const pos16 = new Int16Array(vTotal * 3);
  const idx16 = new Uint16Array(iTotal);
  const header = { id, name, scale: q, teeth: [] };
  let vOff = 0;
  let iOff = 0;
  for (const t of teeth) {
    const vCount = t.positions.length / 3;
    if (vCount > 65535) throw new Error(`${t.fdi}: ${vCount} vértices > 65535`);
    for (let i = 0; i < t.positions.length; i++) pos16[vOff * 3 + i] = Math.round(t.positions[i] / q);
    for (let i = 0; i < t.indices.length; i++) idx16[iOff + i] = t.indices[i];
    header.teeth.push({ fdi: t.fdi, jaw: t.jaw, vOff, vCount, iOff, iCount: t.indices.length });
    vOff += vCount;
    iOff += t.indices.length;
  }
  const json = Buffer.from(JSON.stringify(header), 'utf8');
  const head = Buffer.alloc(8);
  head.write('SL3D', 0, 'ascii');
  head.writeUInt32LE(json.length, 4);
  const posBuf = Buffer.from(pos16.buffer);
  const idxBuf = Buffer.from(idx16.buffer);
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${id}.bin`);
  fs.writeFileSync(file, Buffer.concat([head, json, posBuf, idxBuf]));
  console.log(`${id}: ${teeth.length} dentes, ${vTotal} vértices, ${iTotal / 3} triângulos → ${(fs.statSync(file).size / 1e6).toFixed(2)} MB`);
  return { id, name };
}

function writeCatalog(entries) {
  const lines = entries.map((e) => `  { id: '${e.id}', name: ${JSON.stringify(e.name)}, bin: require('../../../assets/arcos/${e.id}.bin') },`);
  fs.writeFileSync(
    CATALOG_TS,
    `/* eslint-disable @typescript-eslint/no-require-imports */
// GERADO por scripts/anatomia/export3d.mjs — não editar à mão.\n// Arcos completos (superior + inferior) das bibliotecas do exocad, em assets/arcos/<id>.bin.\nexport type ArchEntry = { id: string; name: string; bin: number };\nexport const ARCH_CATALOG: ArchEntry[] = [\n${lines.join('\n')}\n];\n`,
  );
  console.log(`catálogo: ${CATALOG_TS} (${entries.length} arcos)`);
}

if (args.includes('--all') || args.includes('--lib')) {
  const list = fs.existsSync(LIST) ? JSON.parse(fs.readFileSync(LIST, 'utf8')) : [];
  const todo = args.includes('--all') ? list : [{ lib: opt('--lib'), id: opt('--id'), name: opt('--name', opt('--id')) }];
  if (!todo[0]?.lib) {
    console.error('use --lib "Nome" --id slug --name "Nome bonito", ou --all');
    process.exit(1);
  }
  for (const e of todo) await exportLibrary(e);
  // catálogo sempre a partir da lista (para o app só ver o que está em arcos.json)
  if (args.includes('--all')) writeCatalog(list);
  else if (!list.some((e) => e.id === opt('--id'))) console.log('(não está em arcos.json; o catálogo do app não foi alterado)');
  else writeCatalog(list);
}
