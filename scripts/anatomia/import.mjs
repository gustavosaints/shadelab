/**
 * Copia para reference/anatomia só o que o Smile Design usa da biblioteca de
 * dentes do exocad: os três anteriores superiores (1 = central, 2 = lateral,
 * 3 = canino) em .eoff ou .stl, o upperjaw.xml (posição/eixos de cada dente)
 * e as imagens de pré-visualização.
 *
 *   node scripts/anatomia/import.mjs [pasta-de-origem]
 *
 * Origem padrão: a biblioteca "teeth" da instalação do exocad.
 * Bibliotecas em .csdfa (formato cifrado) ou sem malha são puladas.
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] ?? 'C:/exocad-DentalCAD3.3-SR1-2026-01-16/DentalCADApp/library/teeth';
const DST = path.resolve('reference/anatomia');

const meshCandidates = (lib, n) => [
  path.join(lib, 'upperjaw', `${n}.eoff`),
  path.join(lib, 'upperjaw', `${n}.stl`),
  path.join(lib, 'upperjaw', 'stl', `${n}.stl`),
];

let copied = 0;
let skipped = [];
for (const name of fs.readdirSync(SRC)) {
  const lib = path.join(SRC, name);
  if (!fs.statSync(lib).isDirectory()) continue;
  const meshes = [1, 2, 3].map((n) => meshCandidates(lib, n).find((p) => fs.existsSync(p)));
  const xml = path.join(lib, 'upperjaw.xml');
  if (meshes.some((m) => !m)) {
    skipped.push(name);
    continue;
  }
  const out = path.join(DST, name, 'upperjaw');
  fs.mkdirSync(out, { recursive: true });
  meshes.forEach((m, i) => fs.copyFileSync(m, path.join(out, `${i + 1}${path.extname(m).toLowerCase()}`)));
  // o XML do arco é opcional: sem ele, o renderizador alinha os dentes pelo próprio referencial da malha
  if (fs.existsSync(xml)) fs.copyFileSync(xml, path.join(DST, name, 'upperjaw.xml'));
  for (const extra of ['preview.png', 'upperjaw/1.png', 'upperjaw/2.png', 'upperjaw/3.png']) {
    const p = path.join(lib, extra);
    if (fs.existsSync(p)) fs.copyFileSync(p, path.join(DST, name, extra));
  }
  copied++;
}
console.log(`Copiadas ${copied} bibliotecas para ${DST}`);
console.log(`Puladas (${skipped.length}, sem malha legível): ${skipped.join(' | ')}`);
