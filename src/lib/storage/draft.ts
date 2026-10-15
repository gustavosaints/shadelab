/**
 * Rascunho automático do Smile Design: tudo o que está sendo editado fica gravado no
 * aparelho a cada alteração, para a tela voltar de onde parou mesmo depois de sair,
 * reabrir o app ou recarregar. É apagado ao salvar o caso ou ao descartar.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FacePoints } from '@/lib/smile/frame';
import type { SmileParams } from '@/lib/smile/teeth';
import type { SmileVariant } from './cases';

export type SmileDraft = {
  photo: { uri: string; width: number; height: number };
  params: SmileParams;
  targetShade: string;
  step: string;
  face?: FacePoints;
  centralsWidthMm?: string;
  variants?: SmileVariant[];
  patientName?: string;
  notes?: string;
  /** Caso que estava sendo editado (reabrir salva por cima). */
  editingId?: string;
  createdAt?: string;
  updatedAt: string;
};

const KEY = 'shadelab.smile.draft.v1';

export async function saveSmileDraft(d: Omit<SmileDraft, 'updatedAt'>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...d, updatedAt: new Date().toISOString() }));
  } catch {
    // sem espaço ou armazenamento indisponível: segue sem rascunho
  }
}

export async function loadSmileDraft(): Promise<SmileDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SmileDraft) : null;
  } catch {
    return null;
  }
}

export async function clearSmileDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}
