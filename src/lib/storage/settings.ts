import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lab } from '@/lib/color/convert';
import type { ThirdsProfile } from '@/lib/color/match';
import type { NeutralReferenceId, ShadeSystemId } from '@/lib/color/shades';

export type ReferenceMode = 'none' | NeutralReferenceId | 'tab';

export type Settings = {
  shadeSystem: ShadeSystemId;
  referenceMode: ReferenceMode;
  /** Tab usado como referência quando referenceMode === 'tab'. */
  referenceTab: string;
  /** Lab medido de cada tab, por escala, no aparelho do usuário. */
  calibrations: Partial<Record<ShadeSystemId, Record<string, Lab>>>;
  /** Lab por terços (cervical, médio, incisal) de cada tab medido no aparelho — comparação do dente inteiro. */
  calibrationThirds: Partial<Record<ShadeSystemId, Record<string, ThirdsProfile>>>;
  clinicName: string;
  dentistName: string;
  /** Chave da API do Google (Gemini) para "Gerar sorriso por IA"; fica só neste aparelho. */
  aiApiKey: string;
  /** Nome do modelo de imagem (ex.: gemini-2.5-flash-image). */
  aiModel: string;
};

export const DEFAULT_SETTINGS: Settings = {
  shadeSystem: 'vita-classical',
  referenceMode: 'gray18',
  referenceTab: 'A2',
  calibrations: {},
  calibrationThirds: {},
  clinicName: '',
  dentistName: '',
  aiApiKey: '',
  aiModel: 'gemini-2.5-flash-image',
};

const KEY = 'shadelab.settings.v1';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function saveCalibration(system: ShadeSystemId, shadeId: string, lab: Lab, thirds?: ThirdsProfile): Promise<Settings> {
  const current = await loadSettings();
  const forSystem = { ...(current.calibrations[system] ?? {}), [shadeId]: lab };
  const thirdsForSystem = { ...(current.calibrationThirds[system] ?? {}) };
  if (thirds) thirdsForSystem[shadeId] = thirds;
  return saveSettings({
    calibrations: { ...current.calibrations, [system]: forSystem },
    calibrationThirds: { ...current.calibrationThirds, [system]: thirdsForSystem },
  });
}

export async function clearCalibration(system: ShadeSystemId): Promise<Settings> {
  const current = await loadSettings();
  const next = { ...current.calibrations };
  delete next[system];
  const nextThirds = { ...current.calibrationThirds };
  delete nextThirds[system];
  return saveSettings({ calibrations: next, calibrationThirds: nextThirds });
}
