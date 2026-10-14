/**
 * Rasterizador ortográfico por software: devolve, por pixel, a profundidade
 * da frente e do fundo e a normal interpolada da superfície da frente.
 */
import { vertexNormals } from './mesh.mjs';

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/**
 * @param mesh malha
 * @param frame { right, up, toward } vetores unitários no espaço da malha: eixo x da imagem,
 *   eixo y da imagem (para cima) e direção da câmera para o objeto.
 * @param ppm pixels por milímetro
 * @param margin pixels de margem
 */
export function rasterize(mesh, frame, ppm, margin = 2) {
  const { positions, indices } = mesh;
  const normals = vertexNormals(mesh);
  const nv = positions.length / 3;
  // coordenadas de câmera: x direita, y cima, z para a câmera (= -toward)
  const back = scale(frame.toward, -1);
  const cx = new Float32Array(nv);
  const cy = new Float32Array(nv);
  const cz = new Float32Array(nv);
  const nx = new Float32Array(nv);
  const ny = new Float32Array(nv);
  const nz = new Float32Array(nv);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < nv; i++) {
    const p = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
    const n = [normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]];
    cx[i] = dot(p, frame.right);
    cy[i] = dot(p, frame.up);
    cz[i] = dot(p, back);
    nx[i] = dot(n, frame.right);
    ny[i] = dot(n, frame.up);
    nz[i] = dot(n, back);
    if (cx[i] < minX) minX = cx[i];
    if (cx[i] > maxX) maxX = cx[i];
    if (cy[i] < minY) minY = cy[i];
    if (cy[i] > maxY) maxY = cy[i];
  }
  const width = Math.ceil((maxX - minX) * ppm) + margin * 2;
  const height = Math.ceil((maxY - minY) * ppm) + margin * 2;
  const toPx = (x) => (x - minX) * ppm + margin;
  const toPy = (y) => (maxY - y) * ppm + margin; // y da imagem cresce para baixo

  const front = new Float32Array(width * height).fill(-Infinity);
  const backZ = new Float32Array(width * height).fill(Infinity);
  const fn = new Float32Array(width * height * 3);
  // superfície mais próxima considerando também faces traseiras (preenche o colo aberto das coroas)
  const any = new Float32Array(width * height).fill(-Infinity);
  const anyN = new Float32Array(width * height * 3);

  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t];
    const b = indices[t + 1];
    const c = indices[t + 2];
    const ax = toPx(cx[a]);
    const ay = toPy(cy[a]);
    const bx = toPx(cx[b]);
    const by = toPy(cy[b]);
    const qx = toPx(cx[c]);
    const qy = toPy(cy[c]);
    const area = (bx - ax) * (qy - ay) - (qx - ax) * (by - ay);
    if (Math.abs(area) < 1e-9) continue;
    // faces de costas para a câmera (y da imagem cresce para baixo, por isso o sinal invertido) só
    // contribuem para a profundidade do fundo (espessura), não para a superfície visível
    const backFace = area > 0;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, qx)));
    const x1 = Math.min(width - 1, Math.ceil(Math.max(ax, bx, qx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, qy)));
    const y1 = Math.min(height - 1, Math.ceil(Math.max(ay, by, qy)));
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const w0 = ((bx - px) * (qy - py) - (qx - px) * (by - py)) / area;
        const w1 = ((qx - px) * (ay - py) - (ax - px) * (qy - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * cz[a] + w1 * cz[b] + w2 * cz[c];
        const i = y * width + x;
        if (z < backZ[i]) backZ[i] = z;
        if (z > any[i]) {
          any[i] = z;
          anyN[i * 3] = w0 * nx[a] + w1 * nx[b] + w2 * nx[c];
          anyN[i * 3 + 1] = w0 * ny[a] + w1 * ny[b] + w2 * ny[c];
          anyN[i * 3 + 2] = w0 * nz[a] + w1 * nz[b] + w2 * nz[c];
        }
        if (backFace) continue;
        if (z > front[i]) {
          front[i] = z;
          fn[i * 3] = w0 * nx[a] + w1 * nx[b] + w2 * nx[c];
          fn[i * 3 + 1] = w0 * ny[a] + w1 * ny[b] + w2 * ny[c];
          fn[i * 3 + 2] = w0 * nz[a] + w1 * nz[b] + w2 * nz[c];
        }
      }
    }
  }
  return { width, height, front, back: backZ, normals: fn, any, anyNormals: anyN, bounds: { minX, maxX, minY, maxY }, margin };
}
