import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, parseBackup } from '@/lib/storage/backupFormat';

describe('backup dos casos', () => {
  it('aceita o arquivo do Cypris Smile', () => {
    const b = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: '2026-10-23', cases: [] }));
    expect(b.cases).toEqual([]);
  });
  it('recusa outro arquivo com mensagem clara', () => {
    expect(() => parseBackup('{"foo":1}')).toThrow(/não é um backup/);
    expect(() => parseBackup('não é json')).toThrow(/não é um backup/);
  });
});
