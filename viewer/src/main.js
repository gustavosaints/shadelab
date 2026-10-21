/**
 * Visualizador 3D do Smile Design (roda dentro de um WebView no app e no navegador do PC para testes).
 * Carrega um arco completo (.bin gerado por scripts/anatomia/export3d.mjs), ilumina como estúdio e desenha
 * sobre a foto (o fundo é transparente; a foto fica por trás, no app). O recorte pela boca e a sombra do
 * lábio superior são CSS (clip-path) por cima do canvas.
 *
 * API (window.ShadeLab3D): loadArch(ArrayBuffer | base64), setParams(partial), snapshot() → dataURL.
 * Mensagens para o app: { type: 'ready' | 'loaded' | 'snapshot' | 'error', ... }.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const post = (o) => {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o));
  else if (window.onShadeLabMessage) window.onShadeLabMessage(o);
};

/** Parâmetros em frações da vista (como SmileParams) + ângulos em graus + mm. */
const DEFAULTS = {
  midlineX: 0.5, // linha média (fração da largura)
  incisalY: 0.6, // borda incisal dos centrais (fração da altura)
  centralWidth: 0.08, // largura de UM central (fração da largura da vista)
  rotX: 0, // inclinação para cima/baixo (graus)
  rotY: 0, // giro esquerda/direita
  rotZ: 0, // plano oclusal (cant)
  curve: 0, // reservado (curva do sorriso); hoje a curva é a da própria biblioteca
  color: '#f1e9dd',
  opacity: 1,
  gloss: 0.6, // 0..1 brilho (clearcoat)
  showLower: true,
  lowerGap: 0, // abertura extra do inferior (mm)
  lipShadow: 0.5, // intensidade da sombra do lábio superior (0 desliga)
  lipShadowSize: 0.3, // largura da sombra em fração da altura da boca
  crownMm: 10.5, // altura visível da coroa do central: acima disso o dente esmaece (gengiva da foto aparece)
  gumFadeMm: 1.5, // transição da gengiva (mm)
  mouth: null, // [{x,y}] frações da vista; null = sem recorte
};

const state = { params: { ...DEFAULTS }, arch: null, centralWidthMm: 8.5 };

// ---------- cena ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
// sem tone mapping: a cor da escala escolhida chega à tela como está (fidelidade de cor importa aqui)
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// câmera ortográfica em mm: a largura da vista é derivada da largura pedida para o central
const camera = new THREE.OrthographicCamera(-50, 50, 50, -50, -500, 500);
camera.position.set(0, 0, 200);
camera.lookAt(0, 0, 0);

// luz de estúdio: principal alta à esquerda, preenchimento quente à direita e um toque por cima
const key = new THREE.DirectionalLight(0xffffff, 1.35);
key.position.set(-40, 60, 120);
const fill = new THREE.DirectionalLight(0xfff1e0, 0.5);
fill.position.set(60, -10, 100);
const top = new THREE.DirectionalLight(0xffffff, 0.3);
top.position.set(0, 100, 30);
scene.add(key, fill, top, new THREE.AmbientLight(0xffffff, 0.2));

const root = new THREE.Group(); // pivô: borda incisal dos centrais superiores (origem do .bin)
const upper = new THREE.Group();
const lower = new THREE.Group();
root.add(upper, lower);
scene.add(root);

const material = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color(DEFAULTS.color),
  roughness: 0.38,
  metalness: 0,
  clearcoat: 0.6,
  clearcoatRoughness: 0.3,
  envMapIntensity: 0.45,
  transparent: true,
  opacity: 1,
});

// ---------- carga do arco ----------
function parseArch(buf) {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'SL3D') throw new Error('arquivo de arco inválido');
  const jsonLen = dv.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jsonLen)));
  let off = 8 + jsonLen;
  const vTotal = header.teeth.reduce((s, t) => s + t.vCount, 0);
  const iTotal = header.teeth.reduce((s, t) => s + t.iCount, 0);
  const pos = new Int16Array(buf.slice(off, off + vTotal * 6));
  off += vTotal * 6;
  const idx = new Uint16Array(buf.slice(off, off + iTotal * 2));
  return { header, pos, idx };
}

function base64ToBuffer(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function loadArch(data) {
  const buf = typeof data === 'string' ? base64ToBuffer(data) : data;
  const { header, pos, idx } = parseArch(buf);
  upper.clear();
  lower.clear();
  const s = header.scale;
  let w11 = null;
  for (const t of header.teeth) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(t.vCount * 3);
    for (let i = 0; i < p.length; i++) p[i] = pos[t.vOff * 3 + i] * s;
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setIndex(new THREE.BufferAttribute(idx.slice(t.iOff, t.iOff + t.iCount), 1));
    g.computeVertexNormals();
    g.computeBoundingBox();
    const mesh = new THREE.Mesh(g, material);
    mesh.name = t.fdi;
    (t.jaw === 'upper' ? upper : lower).add(mesh);
    if (t.fdi === '11') w11 = g.boundingBox.max.x - g.boundingBox.min.x;
  }
  state.arch = header;
  state.centralWidthMm = w11 || 8.5;
  applyParams();
  post({ type: 'loaded', id: header.id, teeth: header.teeth.length, centralWidthMm: state.centralWidthMm });
}

// ---------- parâmetros → cena ----------
function applyParams() {
  const p = state.params;
  const W = canvas.clientWidth || window.innerWidth;
  const H = canvas.clientHeight || window.innerHeight;
  if (W === 0 || H === 0) return;
  renderer.setSize(W, H, false);
  // largura da vista em mm tal que um central ocupe centralWidth da largura
  const viewWmm = state.centralWidthMm / Math.max(0.005, p.centralWidth);
  const viewHmm = (viewWmm * H) / W;
  camera.left = -viewWmm / 2;
  camera.right = viewWmm / 2;
  camera.top = viewHmm / 2;
  camera.bottom = -viewHmm / 2;
  camera.updateProjectionMatrix();
  // posição do pivô (borda incisal) na vista
  root.position.set((p.midlineX - 0.5) * viewWmm, (0.5 - p.incisalY) * viewHmm, 0);
  root.rotation.set(THREE.MathUtils.degToRad(p.rotX), THREE.MathUtils.degToRad(p.rotY), THREE.MathUtils.degToRad(p.rotZ));
  lower.visible = !!p.showLower;
  lower.position.y = -(p.lowerGap || 0);
  material.color.set(p.color);
  material.opacity = p.opacity;
  material.clearcoat = 0.2 + 0.8 * p.gloss;
  material.needsUpdate = true;
  applyMask();
  render();
}

/** Recorte pela boca (clip-path), esmaecimento acima da linha da gengiva (mask-image) e sombra do lábio (SVG). */
function applyMask() {
  const p = state.params;
  const lip = document.getElementById('lip');
  const W = canvas.clientWidth || window.innerWidth;
  const H = canvas.clientHeight || window.innerHeight;
  // gengiva: acima de (incisal − coroa) o dente some gradualmente, deixando a gengiva da foto
  const viewWmm = state.centralWidthMm / Math.max(0.005, p.centralWidth);
  const pxPerMm = W / viewWmm;
  const gumPx = p.incisalY * H - p.crownMm * pxPerMm;
  const fadePx = p.gumFadeMm * pxPerMm;
  canvas.style.maskImage = canvas.style.webkitMaskImage = `linear-gradient(to bottom, rgba(0,0,0,0) ${gumPx - fadePx}px, #000 ${gumPx}px)`;
  if (p.mouth && p.mouth.length >= 3) {
    const poly = p.mouth.map((m) => `${(m.x * 100).toFixed(2)}% ${(m.y * 100).toFixed(2)}%`).join(',');
    canvas.style.clipPath = `polygon(${poly})`;
    lip.style.clipPath = `polygon(${poly})`;
    // sombra: a borda do lábio superior (do canto direito ao esquerdo passando pelo alto) traçada grossa e borrada
    const xs = p.mouth.map((m) => m.x);
    const iL = xs.indexOf(Math.min(...xs));
    const iR = xs.indexOf(Math.max(...xs));
    const upperEdge = [];
    for (let i = iL; ; i = (i + 1) % p.mouth.length) {
      upperEdge.push(p.mouth[i]);
      if (i === iR) break;
    }
    const ys = p.mouth.map((m) => m.y);
    const mouthH = (Math.max(...ys) - Math.min(...ys)) * H;
    const sw = Math.max(4, mouthH * p.lipShadowSize);
    const pts = upperEdge.map((m) => `${(m.x * W).toFixed(1)},${(m.y * H).toFixed(1)}`).join(' ');
    lip.style.display = p.lipShadow > 0 ? 'block' : 'none';
    lip.innerHTML =
      `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0">` +
      `<defs><filter id="b" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${(sw * 0.35).toFixed(1)}"/></filter></defs>` +
      `<polyline points="${pts}" fill="none" stroke="rgba(45,12,12,${p.lipShadow})" stroke-width="${sw.toFixed(1)}" stroke-linejoin="round" stroke-linecap="round" filter="url(#b)"/></svg>`;
  } else {
    canvas.style.clipPath = 'none';
    lip.style.display = 'none';
  }
}

function render() {
  renderer.render(scene, camera);
}

function setParams(partial) {
  Object.assign(state.params, partial);
  applyParams();
}

function snapshot() {
  render();
  const url = renderer.domElement.toDataURL('image/png');
  post({ type: 'snapshot', dataUrl: url });
  return url;
}

window.addEventListener('resize', applyParams);
window.ShadeLab3D = { loadArch, setParams, snapshot, state, THREE, scene, root, renderer, material, lights: { key, fill, top }, render };
// mensagens vindas do app (injectJavaScript é o caminho normal; postMessage fica como alternativa)
window.addEventListener('message', (e) => {
  try {
    const m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    if (m.type === 'params') setParams(m.params);
    else if (m.type === 'arch') loadArch(m.base64);
    else if (m.type === 'snapshot') snapshot();
  } catch (err) {
    post({ type: 'error', message: String(err) });
  }
});
applyParams();
post({ type: 'ready' });
