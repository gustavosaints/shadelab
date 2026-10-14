import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { Lab } from '@/lib/color/convert';
import type { ShadeSystemId } from '@/lib/color/shades';
import type { SmileParams } from '@/lib/smile/teeth';

export type StoredMatch = { shadeId: string; deltaE: number; quality: string };

export type ShadeCase = {
  kind?: 'shade';
  id: string;
  createdAt: string; // ISO
  patientName: string;
  tooth: string; // notação FDI, ex.: "11"
  notes: string;
  photoUri: string;
  photoWidth: number;
  photoHeight: number;
  shadeSystem: ShadeSystemId;
  referenceLabel: string;
  calibrated: boolean;
  toothLab: Lab;
  toothHex: string;
  gingivaLab?: Lab;
  gingivaHex?: string;
  matches: StoredMatch[];
  confidence: number;
};

export type SmileCase = {
  kind: 'smile';
  id: string;
  createdAt: string;
  patientName: string;
  notes: string;
  /** Foto original do sorriso. */
  photoUri: string;
  /** Simulação renderizada (foto + dentes). */
  renderedUri?: string;
  params: SmileParams;
  targetShade: string;
};

export type AnyCase = ShadeCase | SmileCase;

export function isSmileCase(c: AnyCase): c is SmileCase {
  return c.kind === 'smile';
}

const KEY = 'shadelab.cases.v1';

export async function listCases(): Promise<AnyCase[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as AnyCase[]) : [];
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function getCase(id: string): Promise<AnyCase | undefined> {
  return (await listCases()).find((c) => c.id === id);
}

export function newCaseId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Copia a foto temporária para a pasta permanente do app. */
export async function persistPhoto(uri: string, caseId: string, suffix = ''): Promise<string> {
  if (Platform.OS === 'web') return uri;
  try {
    const dir = new Directory(Paths.document, 'cases');
    if (!dir.exists) dir.create({ intermediates: true });
    const dest = new File(dir, `${caseId}${suffix}.jpg`);
    await new File(uri).copy(dest, { overwrite: true });
    return dest.uri;
  } catch {
    return uri;
  }
}

export async function saveCase(c: AnyCase): Promise<void> {
  const list = (await listCases()).filter((x) => x.id !== c.id);
  list.unshift(c);
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function deleteCase(id: string): Promise<void> {
  const list = await listCases();
  const target = list.find((c) => c.id === id);
  await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((c) => c.id !== id)));
  if (target && Platform.OS !== 'web') {
    const uris = [target.photoUri, isSmileCase(target) ? target.renderedUri : undefined];
    for (const uri of uris) {
      if (!uri) continue;
      try {
        const f = new File(uri);
        if (f.exists) f.delete();
      } catch {
        // foto já removida
      }
    }
  }
}
