/**
 * Exportar e importar os casos (pedido do Gustavo, 2026-10-23): cada "endereço" do app no Expo Go (servidor da
 * clínica, versão publicada) e, no futuro, o app instalado guardam os dados separados. O backup leva os casos com as
 * fotos num único arquivo .json para salvar no iCloud Drive ou mandar pelo WhatsApp, e a outra versão importa.
 * O arquivo é escrito caso a caso (append), sem montar tudo na memória.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { BACKUP_FORMAT, parseBackup, PHOTO_FIELDS, type BackupEntry, type BackupPhoto, type PhotoField } from './backupFormat';
import { isSmileCase, listCases, saveCase, type AnyCase } from './cases';

/** Gera o arquivo de backup no cache e devolve onde ficou e quantos casos levou. */
export async function exportCases(): Promise<{ uri: string; count: number }> {
  const list = await listCases();
  const stamp = new Date().toISOString().slice(0, 10);
  const out = new File(Paths.cache, `cypris-smile-casos-${stamp}.json`);
  if (out.exists) out.delete();
  out.create();
  out.write(`{"format":"${BACKUP_FORMAT}","version":1,"exportedAt":"${new Date().toISOString()}","cases":[`);
  let n = 0;
  for (const c of list) {
    const photos: BackupPhoto[] = [];
    for (const field of PHOTO_FIELDS) {
      const uri = (c as Partial<Record<PhotoField, string>>)[field];
      if (!uri) continue;
      try {
        const f = new File(uri);
        if (f.exists) photos.push({ field, b64: await f.base64() });
      } catch {
        // foto que não está mais no aparelho: o caso vai sem ela
      }
    }
    out.write(`${n ? ',' : ''}${JSON.stringify({ data: c, photos } satisfies BackupEntry)}`, { append: true });
    n++;
  }
  out.write(']}', { append: true });
  return { uri: out.uri, count: n };
}

/**
 * Importa os casos de um backup: grava as fotos na pasta do app e salva os casos que ainda não existem (mesmo id
 * = já importado antes, fica de fora).
 */
export async function importCases(uri: string): Promise<{ imported: number; skipped: number }> {
  const backup = parseBackup(await new File(uri).text());
  const existing = new Set((await listCases()).map((c) => c.id));
  const dir = new Directory(Paths.document, 'cases');
  if (!dir.exists) dir.create({ intermediates: true });
  let imported = 0;
  let skipped = 0;
  for (const entry of backup.cases) {
    const c = entry.data;
    if (!c?.id || existing.has(c.id)) {
      skipped++;
      continue;
    }
    const restored = { ...c } as AnyCase & Partial<Record<PhotoField, string>>;
    for (const p of entry.photos ?? []) {
      const f = new File(dir, `${c.id}${p.field === 'renderedUri' ? '-smile' : ''}-import.jpg`);
      if (f.exists) f.delete();
      f.create();
      f.write(p.b64, { encoding: 'base64' });
      restored[p.field] = f.uri;
    }
    // um caso de Smile Design sem a simulação continua abrindo (só a foto)
    if (isSmileCase(restored) && restored.renderedUri && !entry.photos?.some((p) => p.field === 'renderedUri')) restored.renderedUri = undefined;
    await saveCase(restored);
    imported++;
  }
  return { imported, skipped };
}
