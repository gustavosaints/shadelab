/**
 * Valor, croma e matiz (pedido do Gustavo, 2026-10-23: "sempre leve em consideração a matiz, croma e valor").
 * Valor = L* (claridade), croma = C* (saturação), matiz = h° (tonalidade: 0° vermelho … 90° amarelo).
 * A comparação dente × tab usa as parcelas do CIEDE2000 (`deltaE2000Parts`), na mesma escala do ΔE00, e diz em
 * palavras o que muda — na ordem clássica da tomada de cor: valor primeiro, depois croma, depois matiz.
 */
import type { Lab } from './convert';
import { deltaE2000Parts, PERCEPTIBILITY_THRESHOLD } from './deltaE';

export type Hcv = { value: number; chroma: number; hue: number };

export function hcvOf(lab: Lab): Hcv {
  const h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  return { value: lab.L, chroma: Math.hypot(lab.a, lab.b), hue: h < 0 ? h + 360 : h };
}

export type HcvDiff = {
  /** Parcelas com sinal = dente − tab (positivo: dente mais claro / mais saturado / mais amarelado). */
  value: number;
  chroma: number;
  hue: number;
  /** Frases curtas para a tela e o PDF. */
  text: { value: string; chroma: string; hue: string };
};

const fmt = (v: number) => Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Compara o dente com o tab nas três dimensões. Abaixo de 0,8 (perceptibilidade) conta como igual. */
export function compareHcv(tooth: Lab, tab: Lab): HcvDiff {
  // parcelas de tab → dente: positivo = o dente tem mais
  const p = deltaE2000Parts(tab, tooth);
  // no CIEDE2000 o ΔH' tem o sinal do ângulo; nos dentes (h ~ 70–100°) ângulo maior = mais amarelado
  const same = (v: number) => Math.abs(v) < PERCEPTIBILITY_THRESHOLD;
  return {
    value: p.dL,
    chroma: p.dC,
    hue: p.dH,
    text: {
      value: same(p.dL) ? 'igual ao tab' : `dente ${p.dL > 0 ? 'mais claro' : 'mais escuro'} (${fmt(p.dL)})`,
      chroma: same(p.dC) ? 'igual ao tab' : `dente ${p.dC > 0 ? 'mais saturado' : 'menos saturado'} (${fmt(p.dC)})`,
      hue: same(p.dH) ? 'igual ao tab' : `dente ${p.dH > 0 ? 'mais amarelado' : 'mais avermelhado'} (${fmt(p.dH)})`,
    },
  };
}

/**
 * Desempate entre tabs quase iguais no total (diferença < perceptibilidade): ganha o de valor mais próximo, depois
 * o de croma, depois o de matiz — a ordem que o dentista usa na escala (VITA 3D-Master é organizada assim).
 */
export function hcvTieBreak(tooth: Lab, a: Lab, b: Lab): number {
  const pa = deltaE2000Parts(a, tooth);
  const pb = deltaE2000Parts(b, tooth);
  for (const k of ['dL', 'dC', 'dH'] as const) {
    const d = Math.abs(pa[k]) - Math.abs(pb[k]);
    if (Math.abs(d) >= 0.2) return d;
  }
  return pa.dE - pb.dE;
}

/** 3D-Master: o nome do tab já diz valor (grupo 0–5), matiz (L/M/R) e croma (1–3). */
export function describe3dMaster(id: string): string | null {
  const m = /^([0-5])([LMR])(\d(?:\.\d)?)$/.exec(id);
  if (!m) return null;
  const hue = m[2] === 'L' ? 'L, mais amarelado' : m[2] === 'R' ? 'R, mais avermelhado' : 'M, médio';
  return `valor ${m[1]} (0 = mais claro, 5 = mais escuro) · matiz ${hue} · croma ${m[3].replace('.', ',')} (1 = pouco, 3 = muito saturado)`;
}
