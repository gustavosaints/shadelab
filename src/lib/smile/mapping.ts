/**
 * Mapeamento dos dentes 15 a 25 na foto do sorriso e as silhuetas da forma escolhida (pedido do Gustavo,
 * 2026-10-22): o dentista vê sobre os próprios dentes do paciente como fica a forma quadrada, arredondada ou
 * triangular antes de gerar com a IA, e pode alongar/encurtar cada dente (ou todos) pela incisal e pela cervical.
 * O arco inteiro é ajustado direto na silhueta (como no SmileCloud): mover, largura, abrir/fechar (corredor
 * bucal: dentes de trás mais largos ou mais estreitos) e curva do sorriso; e pode seguir a proporção áurea.
 *
 * Geometria em PIXELS DA FOTO. A base vem do encaixe automático (`autofit`, pela boca detectada) ou, sem ele, só
 * da largura da boca. Os contornos reaproveitam `toothPath` de `teeth.ts` (pré-molares usam o contorno do canino).
 */
import { mouthBounds } from './mouth';
import { toothPath, type MouthPoint, type Side, type SmileParams, type ToothKind } from './teeth';

export const MAPPED_TEETH = ['15', '14', '13', '12', '11', '21', '22', '23', '24', '25'] as const;
export type Fdi = (typeof MAPPED_TEETH)[number];
/** Incisivos onde a prévia da textura aparece. */
export const TEXTURE_TEETH: Fdi[] = ['12', '11', '21', '22'];

type MapKind = ToothKind | 'premolar1' | 'premolar2';
/**
 * Largura visível na foto (relativa ao central, já com a perspectiva do arco), topo (gengiva, fração da altura do
 * central; positivo = mais baixo) e altura relativa. A borda incisal sobe dos centrais para os pré-molares.
 */
const PROFILE: Record<MapKind, { w: number; top: number; h: number; outline: ToothKind }> = {
  central: { w: 1, top: 0, h: 1, outline: 'central' },
  lateral: { w: 0.78, top: 0.07, h: 0.83, outline: 'lateral' },
  canine: { w: 0.72, top: -0.02, h: 0.97, outline: 'canine' },
  premolar1: { w: 0.56, top: 0.0, h: 0.85, outline: 'canine' },
  premolar2: { w: 0.46, top: 0.03, h: 0.75, outline: 'canine' },
};
const ORDER: MapKind[] = ['central', 'lateral', 'canine', 'premolar1', 'premolar2'];
/**
 * Proporção áurea das larguras VISTAS DE FRENTE: central 1, lateral 0,618, canino 0,382 (1,618 : 1 : 0,618). Os
 * pré-molares não entram na regra clássica; ficam um pouco menores que o canino para o arco continuar decrescendo.
 */
const GOLDEN_W: Record<MapKind, number> = { central: 1, lateral: 0.618, canine: 0.382, premolar1: 0.33, premolar2: 0.27 };

/** Largura real típica do incisivo central (mm): dá a escala px/mm da foto. */
export const CENTRAL_WIDTH_MM = 8.5;
/** Fração da largura da boca (comissura a comissura) ocupada de 15 a 25 num sorriso típico (sobra o corredor bucal). */
export const MAPPED_TO_MOUTH = 0.95;
/** Espaço entre dentes, fração da largura do central. */
const GAP = 0.02;

export type MappedTooth = { fdi: Fdi; kind: MapKind; outline: ToothKind; side: Side; x: number; y: number; w: number; h: number };
/** Encaixe na foto (px): linha média, colo dos centrais, largura e altura/largura do central, larguras medidas. */
export type MapBase = { midX: number; gumY: number; centralW: number; heightRatio: number; widthScale: Partial<Record<Fdi, number>> };
export type ToothMap = { base: MapBase; pxPerMm: number; source: 'autofit' | 'boca'; /** selfie: números trocados de lado */ mirrored: boolean };

/**
 * Ajuste do arco inteiro: largura do central (mm, escala todas as larguras), deslocamento (mm; dx + = para a
 * direita da foto, dy + = desce), abertura (−1 fechado … 1 aberto: largura aparente de caninos e pré-molares, o
 * corredor bucal), curva (mm que os pré-molares sobem; + = sorriso mais convexo) e proporção áurea.
 * HEMIARCOS (pedido do Gustavo, 2026-10-23): `left`/`right` = ajuste extra de cada metade do arco (lado esquerdo /
 * direito DA FOTO; com foto normal, esquerdo = 11–15): largura (fração), abertura e curva, somados aos valores
 * simétricos.
 */
export type HemiArch = { widthPct: number; open: number; curveMm: number };
export type ArchEdit = {
  centralMm: number;
  dxMm: number;
  dyMm: number;
  open: number;
  curveMm: number;
  golden: boolean;
  left: HemiArch;
  right: HemiArch;
};
const NO_HEMI: HemiArch = { widthPct: 0, open: 0, curveMm: 0 };
export const DEFAULT_ARCH: ArchEdit = { centralMm: 8.5, dxMm: 0, dyMm: 0, open: 0, curveMm: 0, golden: false, left: NO_HEMI, right: NO_HEMI };
/** Quanto cada dente responde à abertura (largura) e à curva (subida), do central ao 2º pré-molar. */
const OPEN_W: Record<MapKind, number> = { central: 0, lateral: 0.08, canine: 0.25, premolar1: 0.38, premolar2: 0.5 };
const CURVE_Y: Record<MapKind, number> = { central: 0, lateral: 0.12, canine: 0.35, premolar1: 0.65, premolar2: 1 };

/** Comprimento extra em mm: incisal positivo = borda desce (alonga); cervical positivo = colo sobe (alonga). */
/** Ajuste de um dente (mm): comprimento pela incisal e pela cervical e, opcional, largura visível. */
export type LengthEdit = { incisal: number; cervical: number; width?: number };
export type LengthEdits = Partial<Record<Fdi, LengthEdit>>;
export const LENGTH_STEP_MM = 0.5;
export const LENGTH_LIMIT_MM = 3;

/**
 * Monta os 10 dentes a partir da linha média, da linha cervical dos centrais, da largura e da proporção
 * altura/largura do central (pixels da foto). `widthScale` corrige a largura de dentes medidos pelo autofit;
 * `widthFactor` fecha/abre o arco só na largura (a altura fica); `golden` usa as larguras da proporção áurea.
 */
export function layoutMapped(
  midX: number,
  gumY: number,
  centralW: number,
  heightRatio: number,
  widthScale: Partial<Record<Fdi, number>> = {},
  widthFactor: number | readonly [number, number] = 1,
  golden = false,
  openBySide: number | readonly [number, number] = 0,
  curveBySide: number | readonly [number, number] = 0,
  extraW: Partial<Record<Fdi, number>> = {},
): MappedTooth[] {
  // valores por lado da foto: [esquerdo, direito] (um número = igual nos dois)
  const pick = (v: number | readonly [number, number], dir: -1 | 1) => (typeof v === 'number' ? v : v[dir < 0 ? 0 : 1]);
  const ch = centralW * heightRatio;
  const teeth: MappedTooth[] = [];
  for (const dir of [-1, 1] as const) {
    const side: Side = dir < 0 ? 'right' : 'left';
    const cw = centralW * pick(widthFactor, dir);
    const open = pick(openBySide, dir);
    const curvePx = pick(curveBySide, dir);
    const gap = centralW * GAP; // igual nos dois lados: a linha média não anda quando só um hemiarco muda
    let edge = midX + (dir * gap) / 2;
    ORDER.forEach((kind, k) => {
      const fdi = `${dir < 0 ? 1 : 2}${k + 1}` as Fdi;
      const p = PROFILE[kind];
      const ratio = golden ? GOLDEN_W[kind] : p.w * (widthScale[fdi] ?? 1);
      const w = Math.max(cw * 0.2, cw * ratio * (1 + open * OPEN_W[kind]) + (extraW[fdi] ?? 0));
      const x = dir > 0 ? edge : edge - w;
      teeth.push({ fdi, kind, outline: p.outline, side, x, y: gumY + p.top * ch - curvePx * CURVE_Y[kind], w, h: ch * p.h });
      edge = dir > 0 ? x + w + gap : x - gap;
    });
  }
  return teeth.sort((a, b) => a.x - b.x);
}

/** Mapa a partir do encaixe automático (parâmetros em frações da foto, como `autoFitToParams` devolve). */
export function mapFromParams(p: SmileParams, imgW: number, imgH: number): ToothMap {
  const centralW = p.centralWidth * imgW;
  const scale: Partial<Record<Fdi, number>> = {};
  for (const fdi of ['12', '13', '22', '23'] as const) {
    const sw = p.edits?.[fdi]?.sw;
    if (sw) scale[fdi] = sw;
  }
  const base: MapBase = { midX: p.midlineX * imgW, gumY: p.gumY * imgH, centralW, heightRatio: p.heightRatio, widthScale: scale };
  return { base, pxPerMm: centralW / CENTRAL_WIDTH_MM, source: 'autofit', mirrored: false };
}

/** Mapa só pela boca: os 10 dentes ocupam a largura entre as comissuras, colo um pouco acima do lábio superior. */
export function mapFromMouth(mouth: MouthPoint[], imgW: number, imgH: number, midX?: number): ToothMap {
  const b = mouthBounds(mouth, imgW, imgH);
  // 10 larguras + 9 espaços (a linha média conta como um)
  const sum = ORDER.reduce((s, k) => s + PROFILE[k].w, 0) * 2 + 9 * GAP;
  const centralW = (b.widthPx * MAPPED_TO_MOUTH) / sum;
  const heightRatio = 1.2;
  const gumY = b.upperMidY - 0.12 * centralW * heightRatio;
  return { base: { midX: midX ?? b.centerX, gumY, centralW, heightRatio, widthScale: {} }, pxPerMm: centralW / CENTRAL_WIDTH_MM, source: 'boca', mirrored: false };
}

/** Foto espelhada (selfie): o lado direito do paciente fica à direita da imagem, então os números trocam de lado. */
export function mirrorLabels(map: ToothMap): ToothMap {
  return { ...map, mirrored: !map.mirrored };
}

const swapSide = (fdi: Fdi) => `${fdi[0] === '1' ? '2' : '1'}${fdi[1]}` as Fdi;

/**
 * Os 10 dentes do mapa com o ajuste do arco e as larguras individuais (`edits[fdi].width`, mm; os vizinhos se
 * acomodam). Os comprimentos individuais entram depois, com `applyLength`.
 */
export function archTeeth(map: ToothMap, arch: ArchEdit = DEFAULT_ARCH, edits: LengthEdits = {}): MappedTooth[] {
  const b = map.base;
  const k = map.pxPerMm;
  const extraW: Partial<Record<Fdi, number>> = {};
  for (const fdi of MAPPED_TEETH) {
    const wmm = edits[fdi]?.width;
    // o layout numera sem espelho; com foto espelhada o dente 11 da tela é o 21 do layout
    if (wmm) extraW[map.mirrored ? swapSide(fdi) : fdi] = wmm * k;
  }
  const teeth = layoutMapped(
    b.midX + arch.dxMm * k,
    b.gumY + arch.dyMm * k,
    b.centralW,
    b.heightRatio,
    b.widthScale,
    [(arch.centralMm / CENTRAL_WIDTH_MM) * (1 + arch.left.widthPct), (arch.centralMm / CENTRAL_WIDTH_MM) * (1 + arch.right.widthPct)],
    arch.golden,
    [arch.open + arch.left.open, arch.open + arch.right.open],
    [(arch.curveMm + arch.left.curveMm) * k, (arch.curveMm + arch.right.curveMm) * k],
    extraW,
  );
  if (!map.mirrored) return teeth;
  return teeth.map((t) => ({ ...t, fdi: swapSide(t.fdi) }));
}

export function clampArch(a: ArchEdit): ArchEdit {
  const c = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    ...a,
    centralMm: c(a.centralMm, 6.5, 11),
    dxMm: c(a.dxMm, -6, 6),
    dyMm: c(a.dyMm, -6, 6),
    open: c(a.open, -1, 1),
    curveMm: c(a.curveMm, -3, 4),
    left: clampHemi(a.left),
    right: clampHemi(a.right),
  };
}

function clampHemi(h: HemiArch): HemiArch {
  const c = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return { widthPct: c(h.widthPct, -0.25, 0.25), open: c(h.open, -1, 1), curveMm: c(h.curveMm, -3, 3) };
}

const isNoHemi = (h: HemiArch) => h.widthPct === 0 && h.open === 0 && h.curveMm === 0;

export function isDefaultArch(a: ArchEdit): boolean {
  const flat = (['centralMm', 'dxMm', 'dyMm', 'open', 'curveMm', 'golden'] as const).every((k) => a[k] === DEFAULT_ARCH[k]);
  return flat && isNoHemi(a.left) && isNoHemi(a.right);
}

export type ArchHandle = 'move' | 'widthL' | 'widthR' | 'distalL' | 'distalR';

/**
 * Arrasto de uma alça do arco na foto: `dx`/`dy` = deslocamento total desde o toque (px da foto), `from` = arco no
 * começo do arrasto, `archW` = largura do arco (px). L/R = alça à esquerda/direita da foto. `linked` = simétrico
 * (as duas metades juntas); sem ele, a alça mexe só no hemiarco do seu lado.
 */
export function dragArch(from: ArchEdit, handle: ArchHandle, dx: number, dy: number, pxPerMm: number, archW: number, linked = true): ArchEdit {
  const out = handle.endsWith('L') ? -dx : dx; // para fora do arco = positivo
  const sideKey = handle.endsWith('L') ? 'left' : 'right';
  const W = Math.max(1, archW);
  switch (handle) {
    case 'move':
      return clampArch({ ...from, dxMm: from.dxMm + dx / pxPerMm, dyMm: from.dyMm + dy / pxPerMm });
    case 'widthL':
    case 'widthR': {
      if (linked) return clampArch({ ...from, centralMm: from.centralMm * (1 + (2 * out) / W) });
      // só a metade: a mudança de largura conta sobre a meia largura do arco
      const h = from[sideKey];
      return clampArch({ ...from, [sideKey]: { ...h, widthPct: (1 + h.widthPct) * (1 + (2 * out) / W) - 1 } });
    }
    default: {
      // alça distal: para fora abre o arco (1/4 da largura do arco = do neutro ao máximo); para cima aumenta a curva
      const dOpen = out / (W * 0.25);
      const dCurve = -dy / pxPerMm;
      if (linked) return clampArch({ ...from, open: from.open + dOpen, curveMm: from.curveMm + dCurve });
      const h = from[sideKey];
      return clampArch({ ...from, [sideKey]: { ...h, open: h.open + dOpen, curveMm: h.curveMm + dCurve } });
    }
  }
}

/** Descreve o arco planejado para a IA (vazio quando não mudou nada). `mirrored` = foto espelhada (selfie). */
export function describeArch(a: ArchEdit, mirrored = false): string {
  const parts: string[] = [];
  if (a.golden)
    parts.push('use the GOLDEN PROPORTION for the visible tooth widths seen from the front: central incisor 1.618, lateral incisor 1, canine 0.618');
  if (Math.abs(a.centralMm - DEFAULT_ARCH.centralMm) >= 0.1)
    parts.push(`make the central incisors about ${a.centralMm.toLocaleString('en-US', { maximumFractionDigits: 1 })} mm wide (${a.centralMm < DEFAULT_ARCH.centralMm ? 'a narrower, more closed arch' : 'a wider, more open arch'}), keeping the width proportions`);
  const mm = (v: number) => `${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 1 })} mm`;
  if (Math.abs(a.dyMm) >= 0.25)
    parts.push(`move the whole incisal plane about ${mm(a.dyMm)} ${a.dyMm > 0 ? 'lower (more tooth display)' : 'higher (less tooth display)'}`);
  if (Math.abs(a.dxMm) >= 0.25) parts.push(`shift the dental midline about ${mm(a.dxMm)} to the ${a.dxMm > 0 ? 'right' : 'left'} side of the image`);
  if (Math.abs(a.open) >= 0.1)
    parts.push(
      a.open > 0
        ? 'open the arch: broader canines and premolars, filling the buccal corridors'
        : 'close the arch: narrower-looking canines and premolars, with wider dark buccal corridors',
    );
  if (Math.abs(a.curveMm) >= 0.25)
    parts.push(`${a.curveMm > 0 ? 'a more convex' : 'a flatter'} smile curve (premolars about ${mm(a.curveMm)} ${a.curveMm > 0 ? 'higher' : 'lower'} relative to the central incisors)`);
  // hemiarcos ajustados separadamente
  for (const [key, imgSide] of [
    ['left', 'left'],
    ['right', 'right'],
  ] as const) {
    const h = a[key];
    if (isNoHemi(h)) continue;
    const fdi = (imgSide === 'left') !== mirrored ? '11–15' : '21–25';
    const hp: string[] = [];
    if (Math.abs(h.widthPct) >= 0.02) hp.push(`teeth about ${Math.round(Math.abs(h.widthPct) * 100)}% ${h.widthPct > 0 ? 'wider' : 'narrower'}`);
    if (Math.abs(h.open) >= 0.1) hp.push(h.open > 0 ? 'more open (broader premolars, smaller buccal corridor)' : 'more closed (narrower premolars, wider buccal corridor)');
    if (Math.abs(h.curveMm) >= 0.25) hp.push(`posterior teeth about ${mm(h.curveMm)} ${h.curveMm > 0 ? 'higher' : 'lower'}`);
    if (hp.length) parts.push(`hemi-arch ${fdi} (${imgSide} side of the image) only: ${hp.join(', ')}`);
  }
  return parts.length ? `Arch plan: ${parts.join('; ')}.` : '';
}

/** O encaixe automático é plausível? (largura do central entre 9 % e 22 % da boca) */
export function plausibleFit(p: SmileParams, mouth: MouthPoint[], imgW: number, imgH: number): boolean {
  const b = mouthBounds(mouth, imgW, imgH);
  const ratio = (p.centralWidth * imgW) / Math.max(1, b.widthPx);
  return ratio > 0.09 && ratio < 0.22;
}

/** Aplica os ajustes de comprimento (mm) a um dente. */
export function applyLength(t: MappedTooth, e: LengthEdit | undefined, pxPerMm: number): MappedTooth {
  if (!e) return t;
  const up = e.cervical * pxPerMm;
  const down = e.incisal * pxPerMm;
  const h = Math.max(t.h * 0.4, t.h + up + down);
  return { ...t, y: t.y - up, h };
}

export function clampLength(v: number): number {
  return Math.max(-LENGTH_LIMIT_MM, Math.min(LENGTH_LIMIT_MM, Math.round(v / LENGTH_STEP_MM) * LENGTH_STEP_MM));
}

const isZero = (e: LengthEdit) => e.incisal === 0 && e.cervical === 0 && !e.width;

/** Arrasto na silhueta: valor livre (passo de 0,1 mm), limitado a ±3 mm. */
export function clampLengthFine(v: number): number {
  return Math.max(-LENGTH_LIMIT_MM, Math.min(LENGTH_LIMIT_MM, Math.round(v * 10) / 10));
}

/** Troca partes do ajuste de um dente (já limitadas); some quando volta a zero. */
export function setToothEdit(edits: LengthEdits, fdi: Fdi, patch: Partial<LengthEdit>): LengthEdits {
  const cur = edits[fdi] ?? { incisal: 0, cervical: 0 };
  const v: LengthEdit = { ...cur };
  for (const [k, val] of Object.entries(patch) as [keyof LengthEdit, number][]) v[k] = clampLengthFine(val);
  const next: LengthEdits = { ...edits };
  if (isZero(v)) delete next[fdi];
  else next[fdi] = v;
  return next;
}

/** Soma `delta` (mm) na incisal, na cervical ou na largura dos dentes `targets`. */
export function bumpLength(edits: LengthEdits, targets: readonly Fdi[], which: keyof LengthEdit, delta: number): LengthEdits {
  const next: LengthEdits = { ...edits };
  for (const fdi of targets) {
    const cur = next[fdi] ?? { incisal: 0, cervical: 0 };
    const v = { ...cur, [which]: clampLength((cur[which] ?? 0) + delta) };
    if (isZero(v)) delete next[fdi];
    else next[fdi] = v;
  }
  return next;
}

/** Valor comum de `which` nos dentes `targets`, ou null se forem diferentes. */
export function commonLength(edits: LengthEdits, targets: readonly Fdi[], which: keyof LengthEdit): number | null {
  const vals = targets.map((f) => edits[f]?.[which] ?? 0);
  return vals.every((v) => v === vals[0]) ? vals[0] : null;
}

/** Contorno SVG do dente na forma escolhida (0 quadrada, 0,5 arredondada, 1 triangular), em px da foto. */
export function silhouette(t: MappedTooth, shapeMix: number): string {
  return toothPath(t.x, t.y, t.w, t.h, shapeMix, t.outline, t.side);
}

const mm = (v: number) => `${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 1 })} mm`;

/**
 * Descreve os ajustes de comprimento para o modelo de imagem, em inglês. Agrupa dentes com o mesmo ajuste.
 * Vazio quando não há ajuste.
 */
export function describeLengths(edits: LengthEdits): string {
  const groups = new Map<string, Fdi[]>();
  for (const fdi of MAPPED_TEETH) {
    const e = edits[fdi];
    if (!e) continue;
    const parts: string[] = [];
    if (e.incisal) parts.push(e.incisal > 0 ? `incisal edge lengthened by ${mm(e.incisal)}` : `incisal edge shortened by ${mm(e.incisal)}`);
    if (e.cervical)
      parts.push(
        e.cervical > 0
          ? `gingival margin moved ${mm(e.cervical)} apically (longer clinical crown, gingival recontouring)`
          : `gingival margin moved ${mm(e.cervical)} incisally (shorter clinical crown)`,
      );
    if (e.width) parts.push(e.width > 0 ? `visible width increased by ${mm(e.width)}` : `visible width reduced by ${mm(e.width)}`);
    const key = parts.join(' and ');
    groups.set(key, [...(groups.get(key) ?? []), fdi]);
  }
  if (!groups.size) return '';
  const all = [...groups.values()];
  const items = [...groups.entries()].map(([what, teeth]) =>
    all.length === 1 && teeth.length === MAPPED_TEETH.length ? `all upper teeth from 15 to 25: ${what}` : `tooth ${teeth.join(', ')}: ${what}`,
  );
  return `Tooth size changes planned by the dentist (FDI numbering): ${items.join('; ')}.`;
}
