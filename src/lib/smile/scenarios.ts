/**
 * Cenários de tratamento com um toque (ideia vinda do SmileFy): cada cenário é um
 * preset dos parâmetros do Smile Design e, quando faz sentido, uma cor sugerida.
 * Posição (linha média, gengiva, largura) do caso atual é preservada.
 */
import type { ShadeSystemId } from '@/lib/color/shades';
import { NO_EDIT, type SmileParams } from './teeth';

export type ScenarioId = 'natural' | 'veneers' | 'whitening' | 'gingivectomy' | 'diastema' | 'alignment';

export type ScenarioContext = {
  /** Escala ativa, para sugerir a cor certa. */
  system: ShadeSystemId;
  /** Id da anatomia padrão para cenários que trocam a forma (undefined = contorno). */
  /** Largura/altura da área da foto, para converter altura do dente em fração da altura. */
  aspect: number;
};

/** Altura do central como fração da altura da imagem. */
const centralHeightFrac = (p: SmileParams, aspect: number) => p.centralWidth * p.heightRatio * aspect;

export type ScenarioResult = { params: SmileParams; shade?: string };

export type Scenario = {
  id: ScenarioId;
  name: string;
  description: string;
  apply: (p: SmileParams, ctx: ScenarioContext) => ScenarioResult;
};

/** Tom "claro natural" e "clareado" por escala. */
const LIGHT_SHADE: Record<ShadeSystemId, { natural: string; bright: string }> = {
  'vita-classical': { natural: 'A1', bright: 'B1' },
  'vita-3d-master': { natural: '1M2', bright: '1M1' },
};

const lightShade = (system: ShadeSystemId, kind: 'natural' | 'bright') => LIGHT_SHADE[system]?.[kind];

export const SCENARIOS: Scenario[] = [
  {
    id: 'natural',
    name: 'Natural',
    description: 'Proporções naturais, leve espaçamento, bordas suaves. Boa base para começar.',
    apply: (p, ctx) => ({
      params: { ...p, proportion: 'natural', spacing: 0.02, heightRatio: 1.2, curve: 0.08, opacity: 0.92, edits: undefined },
    }),
  },
  {
    id: 'veneers',
    name: 'Facetas',
    description: 'Dentes um pouco mais longos e cheios, sem espaços, proporção RED, cor clara.',
    apply: (p, ctx) => ({
      params: { ...p, proportion: 'red', spacing: 0, heightRatio: 1.28, curve: 0.1, opacity: 0.96, edits: undefined },
      shade: lightShade(ctx.system, 'bright'),
    }),
  },
  {
    id: 'whitening',
    name: 'Clareamento',
    description: 'Mesma forma e posição; só a cor sobe para o tom mais claro da escala.',
    apply: (p, ctx) => ({ params: { ...p }, shade: lightShade(ctx.system, 'bright') }),
  },
  {
    id: 'gingivectomy',
    name: 'Gengivectomia',
    description: 'Sobe a linha gengival e alonga as coroas, como após cirurgia de sorriso gengival.',
    apply: (p, ctx) => ({
      params: { ...p, gumY: p.gumY - 0.08 * centralHeightFrac(p, ctx.aspect), heightRatio: Math.min(1.6, p.heightRatio + 0.1) },
    }),
  },
  {
    id: 'diastema',
    name: 'Fechar diastema',
    description: 'Fecha os espaços e alarga levemente os centrais para ocupar o arco.',
    apply: (p) => ({ params: { ...p, spacing: 0, centralWidth: p.centralWidth * 1.04, edits: undefined } }),
  },
  {
    id: 'alignment',
    name: 'Alinhar',
    description: 'Zera rotações e deslocamentos individuais e nivela a curva do sorriso.',
    apply: (p) => ({
      params: { ...p, curve: 0.08, edits: p.edits ? Object.fromEntries(Object.keys(p.edits).map((k) => [k, { ...NO_EDIT }])) : undefined },
    }),
  },
];

export function applyScenario(id: ScenarioId, p: SmileParams, ctx: ScenarioContext): ScenarioResult {
  const s = SCENARIOS.find((x) => x.id === id);
  return s ? s.apply(p, ctx) : { params: p };
}
