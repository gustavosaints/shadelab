/**
 * Mapeamento dos dentes 15 a 25 na foto do sorriso e as silhuetas da forma escolhida (pedido do Gustavo,
 * 2026-10-22): o dentista vê sobre os próprios dentes do paciente como fica a forma quadrada, arredondada ou
 * triangular antes de gerar com a IA, e pode alongar/encurtar cada dente (ou todos) pela incisal e pela cervical.
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

/** Largura real típica do incisivo central (mm): dá a escala px/mm da foto. */
export const CENTRAL_WIDTH_MM = 8.5;
/** Fração da largura da boca (comissura a comissura) ocupada de 15 a 25 num sorriso típico (sobra o corredor bucal). */
export const MAPPED_TO_MOUTH = 0.95;
/** Espaço entre dentes, fração da largura do central. */
const GAP = 0.02;

export type MappedTooth = { fdi: Fdi; kind: MapKind; outline: ToothKind; side: Side; x: number; y: number; w: number; h: number };
export type ToothMap = { teeth: MappedTooth[]; pxPerMm: number; source: 'autofit' | 'boca' };

/** Comprimento extra em mm: incisal positivo = borda desce (alonga); cervical positivo = colo sobe (alonga). */
export type LengthEdit = { incisal: number; cervical: number };
export type LengthEdits = Partial<Record<Fdi, LengthEdit>>;
export const LENGTH_STEP_MM = 0.5;
export const LENGTH_LIMIT_MM = 3;

/**
 * Monta os 10 dentes a partir da linha média, da linha cervical dos centrais, da largura e da proporção
 * altura/largura do central (pixels da foto). `widthScale` corrige a largura de dentes medidos pelo autofit.
 */
export function layoutMapped(midX: number, gumY: number, centralW: number, heightRatio: number, widthScale: Partial<Record<Fdi, number>> = {}): MappedTooth[] {
  const ch = centralW * heightRatio;
  const gap = centralW * GAP;
  const teeth: MappedTooth[] = [];
  for (const dir of [-1, 1] as const) {
    const side: Side = dir < 0 ? 'right' : 'left';
    let edge = midX + (dir * gap) / 2;
    ORDER.forEach((kind, k) => {
      const fdi = `${dir < 0 ? 1 : 2}${k + 1}` as Fdi;
      const p = PROFILE[kind];
      const w = centralW * p.w * (widthScale[fdi] ?? 1);
      const x = dir > 0 ? edge : edge - w;
      teeth.push({ fdi, kind, outline: p.outline, side, x, y: gumY + p.top * ch, w, h: ch * p.h });
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
  return { teeth: layoutMapped(p.midlineX * imgW, p.gumY * imgH, centralW, p.heightRatio, scale), pxPerMm: centralW / CENTRAL_WIDTH_MM, source: 'autofit' };
}

/** Mapa só pela boca: os 10 dentes ocupam a largura entre as comissuras, colo um pouco acima do lábio superior. */
export function mapFromMouth(mouth: MouthPoint[], imgW: number, imgH: number, midX?: number): ToothMap {
  const b = mouthBounds(mouth, imgW, imgH);
  // 10 larguras + 9 espaços (a linha média conta como um)
  const sum = ORDER.reduce((s, k) => s + PROFILE[k].w, 0) * 2 + 9 * GAP;
  const centralW = (b.widthPx * MAPPED_TO_MOUTH) / sum;
  const heightRatio = 1.2;
  const gumY = b.upperMidY - 0.12 * centralW * heightRatio;
  return { teeth: layoutMapped(midX ?? b.centerX, gumY, centralW, heightRatio), pxPerMm: centralW / CENTRAL_WIDTH_MM, source: 'boca' };
}

/** Foto espelhada (selfie): o lado direito do paciente fica à direita da imagem, então os números trocam de lado. */
export function mirrorLabels(map: ToothMap): ToothMap {
  return { ...map, teeth: map.teeth.map((t) => ({ ...t, fdi: `${t.fdi[0] === '1' ? '2' : '1'}${t.fdi[1]}` as Fdi })) };
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

/** Soma `delta` (mm) na incisal ou na cervical dos dentes `targets`. */
export function bumpLength(edits: LengthEdits, targets: readonly Fdi[], which: keyof LengthEdit, delta: number): LengthEdits {
  const next: LengthEdits = { ...edits };
  for (const fdi of targets) {
    const cur = next[fdi] ?? { incisal: 0, cervical: 0 };
    const v = { ...cur, [which]: clampLength(cur[which] + delta) };
    if (v.incisal === 0 && v.cervical === 0) delete next[fdi];
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
    const key = parts.join(' and ');
    groups.set(key, [...(groups.get(key) ?? []), fdi]);
  }
  if (!groups.size) return '';
  const all = [...groups.values()];
  const items = [...groups.entries()].map(([what, teeth]) =>
    all.length === 1 && teeth.length === MAPPED_TEETH.length ? `all upper teeth from 15 to 25: ${what}` : `tooth ${teeth.join(', ')}: ${what}`,
  );
  return `Tooth length changes planned by the dentist (FDI numbering): ${items.join('; ')}.`;
}
