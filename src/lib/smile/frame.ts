/**
 * "Face-bow digital" e smile frame no estilo DSD (Digital Smile Design):
 * marcos faciais arrastáveis sobre a foto, calibração em milímetros pela largura
 * real dos dois centrais e análise numérica (desvio de linha média, inclinação
 * do plano, proporção largura/comprimento). Tudo em frações da imagem, para ser
 * independente do aparelho.
 */
import type { SmileParams } from './teeth';

export type Pt = { x: number; y: number };

/** Marcos faciais (frações da imagem). "R" = lado direito do paciente = esquerda do observador. */
export type FacePoints = {
  pupilR: Pt;
  pupilL: Pt;
  glabella: Pt;
  philtrum: Pt;
  commissureR: Pt;
  commissureL: Pt;
  /** Distal do 11 e distal do 21: a distância entre eles é a largura real dos dois centrais. */
  centralsDistalR: Pt;
  centralsDistalL: Pt;
};

export const FACE_POINT_LABELS: Record<keyof FacePoints, string> = {
  pupilR: 'Pupila direita',
  pupilL: 'Pupila esquerda',
  glabella: 'Glabela',
  philtrum: 'Filtro',
  commissureR: 'Comissura direita',
  commissureL: 'Comissura esquerda',
  centralsDistalR: 'Distal do 11',
  centralsDistalL: 'Distal do 21',
};

/** Largura real típica dos dois centrais somados (2 × 8,5 mm). */
export const DEFAULT_CENTRALS_WIDTH_MM = 17;

/** Posições iniciais para uma foto frontal de sorriso enquadrando o rosto. */
export function defaultFacePoints(): FacePoints {
  return {
    pupilR: { x: 0.38, y: 0.3 },
    pupilL: { x: 0.62, y: 0.3 },
    glabella: { x: 0.5, y: 0.27 },
    philtrum: { x: 0.5, y: 0.58 },
    commissureR: { x: 0.4, y: 0.7 },
    commissureL: { x: 0.6, y: 0.7 },
    centralsDistalR: { x: 0.465, y: 0.72 },
    centralsDistalL: { x: 0.535, y: 0.72 },
  };
}

/** Limites clínicos usados nas recomendações. */
export const LIMITS = {
  /** Desvio de linha média perceptível em foto da face inteira (mm). */
  midlineShiftMm: 1,
  /** Inclinação do plano incisal em relação à bipupilar (graus). */
  cantDeg: 2,
  /** Relação largura/comprimento do central (%): ideal ~80, aceitável 70–90. */
  widthHeightPct: { min: 70, max: 90, ideal: 80 },
};

export type FrameAnalysis = {
  /** Pixels por milímetro na área exibida (0 se a calibração for inválida). */
  pxPerMm: number;
  /** Ângulo da linha bipupilar (graus; positivo = lado esquerdo do paciente mais baixo). */
  bipupillaryDeg: number;
  /** Ângulo da linha intercomissural (graus). */
  commissuralDeg: number;
  /** Ângulo da linha média facial em relação à vertical (graus). */
  facialMidlineDeg: number;
  /** X (px) da linha média facial no nível da borda incisal dos centrais. */
  facialMidlineXAtIncisal: number;
  /** Desvio da linha média dental da simulação em relação à facial (mm; positivo = para a esquerda do paciente). */
  midlineShiftMm: number;
  /** Relação largura/comprimento do central na simulação (%). */
  widthHeightPct: number;
  /** Largura do central na simulação (mm). */
  centralWidthMm: number;
  /** Comprimento do central na simulação (mm). */
  centralHeightMm: number;
  /** Observações em linguagem clínica. */
  notes: string[];
};

const deg = (rad: number) => (rad * 180) / Math.PI;

/** Ponto em pixels. */
const px = (p: Pt, w: number, h: number) => ({ x: p.x * w, y: p.y * h });

/** Ângulo de uma linha entre dois pontos em relação à horizontal, em graus. */
export function lineAngleDeg(a: Pt, b: Pt, w: number, h: number): number {
  const pa = px(a, w, h);
  const pb = px(b, w, h);
  return deg(Math.atan2(pb.y - pa.y, pb.x - pa.x));
}

/** X da reta que passa por a e b na altura y (px). Reta vertical devolve o x de a. */
export function lineXAtY(a: Pt, b: Pt, y: number, w: number, h: number): number {
  const pa = px(a, w, h);
  const pb = px(b, w, h);
  if (Math.abs(pb.y - pa.y) < 1e-6) return pa.x;
  const t = (y - pa.y) / (pb.y - pa.y);
  return pa.x + t * (pb.x - pa.x);
}

/**
 * Analisa a foto calibrada em relação à simulação atual.
 * `centralsWidthMm` é a largura real (distal a distal) dos dois centrais.
 */
export function analyzeFrame(face: FacePoints, centralsWidthMm: number, params: SmileParams, width: number, height: number): FrameAnalysis {
  const dR = px(face.centralsDistalR, width, height);
  const dL = px(face.centralsDistalL, width, height);
  const spanPx = Math.hypot(dL.x - dR.x, dL.y - dR.y);
  const pxPerMm = centralsWidthMm > 0 && spanPx > 1 ? spanPx / centralsWidthMm : 0;

  const bipupillaryDeg = lineAngleDeg(face.pupilR, face.pupilL, width, height);
  const commissuralDeg = lineAngleDeg(face.commissureR, face.commissureL, width, height);
  const facialMidlineDeg = lineAngleDeg(face.glabella, face.philtrum, width, height) - 90;

  const cw = params.centralWidth * width;
  const ch = cw * params.heightRatio;
  const incisalY = params.gumY * height + ch;
  const facialMidlineXAtIncisal = lineXAtY(face.glabella, face.philtrum, incisalY, width, height);
  const dentalMidlineX = params.midlineX * width;
  const midlineShiftMm = pxPerMm ? (dentalMidlineX - facialMidlineXAtIncisal) / pxPerMm : 0;

  const widthHeightPct = 100 / params.heightRatio;
  const centralWidthMm = pxPerMm ? cw / pxPerMm : 0;
  const centralHeightMm = pxPerMm ? ch / pxPerMm : 0;

  const notes: string[] = [];
  if (!pxPerMm) notes.push('Calibração inválida: afaste os pontos distais dos centrais e informe a largura real.');
  if (Math.abs(midlineShiftMm) >= LIMITS.midlineShiftMm) {
    notes.push(
      `Linha média dental ${Math.abs(midlineShiftMm).toFixed(1)} mm para a ${midlineShiftMm > 0 ? 'esquerda' : 'direita'} da facial (perceptível a partir de 1 mm na face inteira).`,
    );
  }
  if (Math.abs(bipupillaryDeg - commissuralDeg) >= LIMITS.cantDeg) {
    notes.push(
      `Bipupilar e intercomissural divergem ${Math.abs(bipupillaryDeg - commissuralDeg).toFixed(1)}°: escolha qual referência horizontal adotar.`,
    );
  }
  if (Math.abs(bipupillaryDeg) >= LIMITS.cantDeg) {
    notes.push(`Foto inclinada ${Math.abs(bipupillaryDeg).toFixed(1)}° em relação à bipupilar: nivele a foto ou considere a inclinação.`);
  }
  const { min, max, ideal } = LIMITS.widthHeightPct;
  if (widthHeightPct < min || widthHeightPct > max) {
    notes.push(`Relação largura/comprimento do central em ${widthHeightPct.toFixed(0)}% (ideal ~${ideal}%, aceitável ${min}–${max}%).`);
  }
  return {
    pxPerMm,
    bipupillaryDeg,
    commissuralDeg,
    facialMidlineDeg,
    facialMidlineXAtIncisal,
    midlineShiftMm,
    widthHeightPct,
    centralWidthMm,
    centralHeightMm,
    notes,
  };
}

/** Move a linha média da simulação para a linha média facial (no nível incisal). */
export function alignMidlineToFace(params: SmileParams, face: FacePoints, width: number, height: number): SmileParams {
  const a = analyzeFrame(face, DEFAULT_CENTRALS_WIDTH_MM, params, width, height);
  return { ...params, midlineX: a.facialMidlineXAtIncisal / width };
}

/** Ajusta a largura do central para a medida real em mm (precisa de calibração válida). */
export function setCentralWidthMm(params: SmileParams, face: FacePoints, centralsWidthMm: number, widthMm: number, width: number, height: number): SmileParams {
  const a = analyzeFrame(face, centralsWidthMm, params, width, height);
  if (!a.pxPerMm) return params;
  return { ...params, centralWidth: (widthMm * a.pxPerMm) / width };
}

export type Box = { fdi: string; x: number; y: number; w: number; h: number };

export type FrameCurves = {
  /** Curva do sorriso: bordas incisais dos seis anteriores. */
  smile: Pt[];
  /** Curva gengival: margens cervicais. */
  gingival: Pt[];
  /** Linha das papilas: ~40% da altura da coroa a partir do colo. */
  papilla: Pt[];
};

/** Curvas do smile frame a partir das caixas dos dentes (px), da esquerda para a direita do observador. */
export function frameCurves(teeth: Box[]): FrameCurves {
  const sorted = [...teeth].sort((a, b) => a.x - b.x);
  return {
    smile: sorted.map((t) => ({ x: t.x + t.w / 2, y: t.y + t.h })),
    gingival: sorted.map((t) => ({ x: t.x + t.w / 2, y: t.y })),
    papilla: sorted.map((t) => ({ x: t.x + t.w / 2, y: t.y + t.h * 0.4 })),
  };
}

/** Caminho SVG suave (Catmull-Rom → Bézier) por uma sequência aberta de pontos em px. */
export function smoothPath(pts: Pt[], tension = 0.5): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  const f = (n: number) => n.toFixed(1);
  const parts = [`M ${f(pts[0].x)} ${f(pts[0].y)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = { x: p1.x + ((p2.x - p0.x) * tension) / 3, y: p1.y + ((p2.y - p0.y) * tension) / 3 };
    const c2 = { x: p2.x - ((p3.x - p1.x) * tension) / 3, y: p2.y - ((p3.y - p1.y) * tension) / 3 };
    parts.push(`C ${f(c1.x)} ${f(c1.y)}, ${f(c2.x)} ${f(c2.y)}, ${f(p2.x)} ${f(p2.y)}`);
  }
  return parts.join(' ');
}
