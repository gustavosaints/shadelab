/** Leitura de malhas: .eoff (OFF binário do exocad) e .stl (ASCII ou binário). */
import fs from 'node:fs';
import path from 'node:path';

/** @typedef {{ positions: Float32Array, indices: Uint32Array }} Mesh */

export function readMesh(file) {
  const ext = path.extname(file).toLowerCase();
  const buf = fs.readFileSync(file);
  if (ext === '.eoff') return ensureOutward(readEoff(buf));
  if (ext === '.stl') return ensureOutward(readStl(buf));
  throw new Error(`Formato não suportado: ${file}`);
}

/** Garante faces no sentido anti-horário vistas de fora (volume assinado positivo). */
function ensureOutward(mesh) {
  const { positions: p, indices } = mesh;
  let vol = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    vol +=
      p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
      p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
      p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  if (vol >= 0) return mesh;
  const flipped = new Uint32Array(indices.length);
  for (let t = 0; t < indices.length; t += 3) {
    flipped[t] = indices[t];
    flipped[t + 1] = indices[t + 2];
    flipped[t + 2] = indices[t + 1];
  }
  return { positions: p, indices: flipped };
}

/**
 * OFF binário: "OFF BINARY\n", nV nF nE (uint32 LE), vértices float32 x3,
 * faces = uint16 (nº de vértices) + índices uint32. Extensões no fim são ignoradas.
 */
function readEoff(b) {
  const magic = 'OFF BINARY\n';
  if (b.subarray(0, magic.length).toString('latin1') !== magic) throw new Error('não é OFF BINARY');
  let o = magic.length;
  const nv = b.readUInt32LE(o);
  const nf = b.readUInt32LE(o + 4);
  o += 12;
  const positions = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) positions[i] = b.readFloatLE(o + i * 4);
  o += nv * 12;
  const idx = [];
  for (let f = 0; f < nf; f++) {
    const n = b.readUInt16LE(o);
    o += 2;
    const face = [];
    for (let k = 0; k < n; k++) {
      face.push(b.readUInt32LE(o));
      o += 4;
    }
    for (let k = 1; k + 1 < n; k++) idx.push(face[0], face[k], face[k + 1]); // leque para n > 3
  }
  return { positions, indices: Uint32Array.from(idx) };
}

function readStl(b) {
  const head = b.subarray(0, 5).toString('latin1');
  const looksAscii = head === 'solid' && b.subarray(0, Math.min(b.length, 2000)).toString('latin1').includes('facet');
  if (!looksAscii) return readStlBinary(b);
  const text = b.toString('latin1');
  const re = /vertex\s+([-+\deE.]+)\s+([-+\deE.]+)\s+([-+\deE.]+)/g;
  const pos = [];
  let m;
  while ((m = re.exec(text))) pos.push(+m[1], +m[2], +m[3]);
  return weld(Float32Array.from(pos));
}

function readStlBinary(b) {
  const n = b.readUInt32LE(80);
  const pos = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50 + 12;
    for (let k = 0; k < 9; k++) pos[i * 9 + k] = b.readFloatLE(o + k * 4);
  }
  return weld(pos);
}

/** Une vértices repetidos (STL é "sopa de triângulos") para calcular normais suaves. */
function weld(pos) {
  const map = new Map();
  const positions = [];
  const indices = new Uint32Array(pos.length / 3);
  for (let i = 0; i < pos.length / 3; i++) {
    const key = `${pos[i * 3].toFixed(4)},${pos[i * 3 + 1].toFixed(4)},${pos[i * 3 + 2].toFixed(4)}`;
    let id = map.get(key);
    if (id === undefined) {
      id = positions.length / 3;
      map.set(key, id);
      positions.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    }
    indices[i] = id;
  }
  return { positions: Float32Array.from(positions), indices };
}

/** Normais por vértice (média ponderada pela área das faces). */
export function vertexNormals({ positions, indices }) {
  const n = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) {
      n[i] += nx;
      n[i + 1] += ny;
      n[i + 2] += nz;
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l;
    n[i + 1] /= l;
    n[i + 2] /= l;
  }
  return n;
}

/** Lê do upperjaw.xml a posição e os eixos (oclusal, mesial) de cada dente. */
export function readToothBow(xmlFile) {
  const xml = fs.readFileSync(xmlFile, 'utf8');
  const teeth = {};
  const vec = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}>\\s*<x>([^<]*)</x>\\s*<y>([^<]*)</y>\\s*<z>([^<]*)</z>`));
    return m ? [+m[1], +m[2], +m[3]] : null;
  };
  for (const m of xml.matchAll(/<ModelTooth>([\s\S]*?)<\/ModelTooth>/g)) {
    const block = m[1];
    const num = block.match(/<Number>(\d+)<\/Number>/)?.[1];
    if (!num) continue;
    teeth[num] = {
      position: vec(block, 'Position'),
      occlusal: vec(block, 'AxisOcclusal'),
      mesial: vec(block, 'AxisMesial'),
    };
  }
  return teeth;
}
