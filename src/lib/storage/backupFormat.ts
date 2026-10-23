/** Formato do arquivo de backup dos casos (parte pura, testável). Ver `backup.ts`. */
import type { AnyCase } from './cases';

export const BACKUP_FORMAT = 'cypris-smile-casos';
export const PHOTO_FIELDS = ['photoUri', 'renderedUri'] as const;
export type PhotoField = (typeof PHOTO_FIELDS)[number];

export type BackupPhoto = { field: PhotoField; b64: string };
export type BackupEntry = { data: AnyCase; photos: BackupPhoto[] };
export type BackupFile = { format: typeof BACKUP_FORMAT; version: 1; exportedAt: string; cases: BackupEntry[] };

/** Confere se o texto é um backup do Cypris Smile. */
export function parseBackup(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Esse arquivo não é um backup de casos do Cypris Smile.');
  }
  const b = parsed as Partial<BackupFile>;
  if (b?.format !== BACKUP_FORMAT || !Array.isArray(b.cases)) throw new Error('Esse arquivo não é um backup de casos do Cypris Smile.');
  return b as BackupFile;
}

