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
  /** Foto recortada de cada tab real medido (arquivo em Paths.document/calib), para o PDF. */
  tabImages: Partial<Record<ShadeSystemId, Record<string, string>>>;
  /** Escala de gengiva (IPS Gingiva G1–G5): Lab medido e foto de cada tab. */
  gingivaCalibrations: Record<string, Lab>;
  gingivaTabImages: Record<string, string>;
  clinicName: string;
  dentistName: string;
  /** Chave da API do Google (Gemini) para "Gerar sorriso por IA"; fica só neste aparelho. */
  aiApiKey: string;
  /** Nome do modelo de imagem (ex.: gemini-2.5-flash-image). */
  aiModel: string;
};

export const DEFAULT_SETTINGS: Settings = {
  shadeSystem: 'vita-classical',
  referenceMode: 'none',
  referenceTab: 'A2',
  calibrations: {},
  calibrationThirds: {},
  tabImages: {},
  gingivaCalibrations: {},
  gingivaTabImages: {},
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

export async function saveCalibration(system: ShadeSystemId, shadeId: string, lab: Lab, thirds?: ThirdsProfile, imageUri?: string): Promise<Settings> {
  const current = await loadSettings();
  const forSystem = { ...(current.calibrations[system] ?? {}), [shadeId]: lab };
  const thirdsForSystem = { ...(current.calibrationThirds[system] ?? {}) };
  if (thirds) thirdsForSystem[shadeId] = thirds;
  const imagesForSystem = { ...(current.tabImages[system] ?? {}) };
  if (imageUri) imagesForSystem[shadeId] = imageUri;
  return saveSettings({
    calibrations: { ...current.calibrations, [system]: forSystem },
    calibrationThirds: { ...current.calibrationThirds, [system]: thirdsForSystem },
    tabImages: { ...current.tabImages, [system]: imagesForSystem },
  });
}

export async function saveGingivaCalibration(shadeId: string, lab: Lab, imageUri?: string): Promise<Settings> {
  const current = await loadSettings();
  const images = { ...current.gingivaTabImages };
  if (imageUri) images[shadeId] = imageUri;
  return saveSettings({ gingivaCalibrations: { ...current.gingivaCalibrations, [shadeId]: lab }, gingivaTabImages: images });
}

export async function clearGingivaCalibration(): Promise<Settings> {
  return saveSettings({ gingivaCalibrations: {}, gingivaTabImages: {} });
}

export async function clearCalibration(system: ShadeSystemId): Promise<Settings> {
  const current = await loadSettings();
  const next = { ...current.calibrations };
  delete next[system];
  const nextThirds = { ...current.calibrationThirds };
  delete nextThirds[system];
  const nextImages = { ...current.tabImages };
  delete nextImages[system];
  return saveSettings({ calibrations: next, calibrationThirds: nextThirds, tabImages: nextImages });
}
