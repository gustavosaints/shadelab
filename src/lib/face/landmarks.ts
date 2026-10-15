/**
 * Mapeia os 478 marcos do MediaPipe Face Landmarker para o que o Smile Design usa:
 * contorno da boca (lábio interno), marcos do face-bow digital e caixa do rosto.
 * Tudo em frações da imagem (x, y em 0..1), como o resto do módulo.
 */
import type { FacePoints } from '@/lib/smile/frame';
import type { MouthPoint } from '@/lib/smile/teeth';

export type Landmark = { x: number; y: number; z?: number };

/** Índices do MediaPipe Face Mesh (lado "R" = direito do paciente, "L" = esquerdo). */
export const IDX = {
  irisR: 468,
  irisL: 473,
  glabella: 9,
  philtrum: 0, // centro do arco do cupido (lábio superior)
  noseTip: 1,
  chin: 152,
  mouthCornerR: 61,
  mouthCornerL: 291,
  innerCornerR: 78,
  innerCornerL: 308,
  innerUpperR: 82,
  innerUpperMid: 13,
  innerUpperL: 312,
  innerLowerL: 317,
  innerLowerMid: 14,
  innerLowerR: 87,
  /** Lábio interno completo, sentido horário a partir da comissura direita. */
  innerLipLoop: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95],
} as const;

export const LANDMARK_COUNT = 478;

const P = (lm: Landmark[], i: number): MouthPoint => ({ x: lm[i].x, y: lm[i].y });

/** Verdadeiro se a foto está espelhada (o lado direito do paciente aparece à direita da imagem). */
export function isMirrored(lm: Landmark[]): boolean {
  return lm[IDX.innerCornerR].x > lm[IDX.innerCornerL].x;
}

/**
 * Contorno da boca com os 8 pontos do app (comissura R, lábio superior R/meio/L, comissura L,
 * lábio inferior L/meio/R), sempre começando pelo lado esquerdo da IMAGEM.
 */
export function mouthFromLandmarks(lm: Landmark[]): MouthPoint[] {
  if (lm.length < LANDMARK_COUNT) throw new Error('marcos incompletos');
  const m = isMirrored(lm);
  const pick = (r: number, l: number) => (m ? l : r);
  return [
    P(lm, pick(IDX.innerCornerR, IDX.innerCornerL)),
    P(lm, pick(IDX.innerUpperR, IDX.innerUpperL)),
    P(lm, IDX.innerUpperMid),
    P(lm, pick(IDX.innerUpperL, IDX.innerUpperR)),
    P(lm, pick(IDX.innerCornerL, IDX.innerCornerR)),
    P(lm, pick(IDX.innerLowerL, IDX.innerLowerR)),
    P(lm, IDX.innerLowerMid),
    P(lm, pick(IDX.innerLowerR, IDX.innerLowerL)),
  ];
}

/** Marcos do face-bow digital ("R" = lado esquerdo da imagem, como o app assume). */
export function facePointsFromLandmarks(lm: Landmark[]): FacePoints {
  if (lm.length < LANDMARK_COUNT) throw new Error('marcos incompletos');
  const m = isMirrored(lm);
  const pick = (r: number, l: number) => (m ? l : r);
  const corner = (i: number) => P(lm, i);
  return {
    pupilR: P(lm, pick(IDX.irisR, IDX.irisL)),
    pupilL: P(lm, pick(IDX.irisL, IDX.irisR)),
    glabella: P(lm, IDX.glabella),
    philtrum: P(lm, IDX.philtrum),
    commissureR: corner(pick(IDX.mouthCornerR, IDX.mouthCornerL)),
    commissureL: corner(pick(IDX.mouthCornerL, IDX.mouthCornerR)),
    // distais dos centrais: estimativa a 1/4 da largura da boca interna para cada lado do meio
    centralsDistalR: {
      x: lm[IDX.innerUpperMid].x - 0.11 * Math.abs(lm[IDX.innerCornerL].x - lm[IDX.innerCornerR].x),
      y: (lm[IDX.innerUpperMid].y + lm[IDX.innerLowerMid].y) / 2,
    },
    centralsDistalL: {
      x: lm[IDX.innerUpperMid].x + 0.11 * Math.abs(lm[IDX.innerCornerL].x - lm[IDX.innerCornerR].x),
      y: (lm[IDX.innerUpperMid].y + lm[IDX.innerLowerMid].y) / 2,
    },
  };
}

export type FaceBox = { x: number; y: number; w: number; h: number; mouthCx: number; mouthCy: number; mouthW: number; mouthOpen: number };

/** Caixa do rosto e da boca (frações), para conferir o enquadramento. */
export function faceBoxFromLandmarks(lm: Landmark[]): FaceBox {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of lm) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const cR = lm[IDX.innerCornerR];
  const cL = lm[IDX.innerCornerL];
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    mouthCx: (cR.x + cL.x) / 2,
    mouthCy: (lm[IDX.innerUpperMid].y + lm[IDX.innerLowerMid].y) / 2,
    mouthW: Math.abs(cL.x - cR.x),
    mouthOpen: Math.abs(lm[IDX.innerLowerMid].y - lm[IDX.innerUpperMid].y),
  };
}

export type FramingGuide = {
  /** Elipse do rosto (frações da área de prévia). */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Faixa da boca (frações). */
  mouthCy: number;
  mouthH: number;
};

/** Guia padrão de enquadramento: rosto centralizado ocupando ~55% da largura, boca no terço inferior. */
export const DEFAULT_GUIDE: FramingGuide = { cx: 0.5, cy: 0.47, rx: 0.3, ry: 0.36, mouthCy: 0.66, mouthH: 0.1 };

export type FramingCheck = { ok: boolean; issues: string[] };

/** Avalia se o rosto detectado cabe no guia: centralizado, tamanho certo, boca na faixa e aberta. */
export function checkFraming(box: FaceBox, guide: FramingGuide = DEFAULT_GUIDE): FramingCheck {
  const issues: string[] = [];
  const faceCx = box.x + box.w / 2;
  const faceCy = box.y + box.h / 2;
  if (Math.abs(faceCx - guide.cx) > 0.08) issues.push(faceCx < guide.cx ? 'Rosto muito à esquerda' : 'Rosto muito à direita');
  if (Math.abs(faceCy - guide.cy) > 0.1) issues.push(faceCy < guide.cy ? 'Rosto muito alto' : 'Rosto muito baixo');
  const sizeRatio = box.w / (guide.rx * 2);
  if (sizeRatio < 0.75) issues.push('Aproxime a câmera');
  if (sizeRatio > 1.3) issues.push('Afaste a câmera');
  if (Math.abs(box.mouthCy - guide.mouthCy) > guide.mouthH) issues.push('Boca fora da faixa');
  if (box.mouthOpen < 0.012) issues.push('Sorria mostrando os dentes');
  return { ok: issues.length === 0, issues };
}
