import { z } from "zod";
import { decryptBackup, encryptBackup } from "./crypto";
import {
  decode64,
  digest,
  encode64,
  MAX_ATTACHMENT_BYTES,
  parseBackup,
  validateFiles,
  type Backup,
} from "./format";
import type { BackupTables } from "./rows";

export interface BackupPort {
  assertAccount(): Promise<void>;
  snapshot(): Promise<{ accountId: string; createdAt: string; version: 1; tables: BackupTables }>;
  download(path: string): Promise<Uint8Array<ArrayBuffer> | null>;
  upload(path: string, bytes: Uint8Array<ArrayBuffer>, mime: string): Promise<void>;
  restore(backup: Backup): Promise<unknown>;
}
export const restoreResult = z
  .object({ inserted: z.number().int().nonnegative(), skipped: z.number().int().nonnegative() })
  .strict();
export async function exportBackup(port: BackupPort, accountId: string, password: string) {
  await port.assertAccount();
  const snapshot = await port.snapshot();
  if (snapshot.version !== 1 || snapshot.accountId !== accountId)
    throw new Error("تغير الحساب. أعد المحاولة.");
  const backup: Backup = { format: "memoflow-backup", ...snapshot, files: [] };
  // Validate metadata before using paths from the server. parseBackup needs a complete file manifest.
  const paths = new Map<string, { mime: string; size: number }>();
  for (const row of [...snapshot.tables.attachments, ...snapshot.tables.item_attachments]) {
    paths.set(String(row.storage_path), {
      mime: String(row.mime_type),
      size: Number(row.size_bytes),
    });
  }
  backup.files = [...paths].map(([path, f]) => ({ path, ...f, sha256: "0".repeat(64), data: "" }));
  parseBackup(backup);
  let total = 0;
  for (const file of backup.files) {
    await port.assertAccount();
    const bytes = await port.download(file.path);
    if (!bytes || bytes.length !== file.size)
      throw new Error("تعذر قراءة أحد المرفقات بالكامل. لم تُنشأ نسخة ناقصة؛ حاول مجددًا.");
    total += bytes.length;
    if (total > MAX_ATTACHMENT_BYTES) throw new Error("المرفقات تتجاوز 32 ميجابايت.");
    file.data = encode64(bytes);
    file.sha256 = await digest(bytes);
  }
  const encrypted = await encryptBackup(backup, password);
  await port.assertAccount();
  return encrypted;
}
export async function previewBackup(text: string, password: string, accountId: string) {
  const backup = await decryptBackup(text, password);
  if (backup.accountId !== accountId)
    throw new Error("هذه النسخة تخص حسابًا آخر. سجّل الدخول بالحساب الذي أنشأها.");
  return backup;
}
export async function restoreBackup(port: BackupPort, input: Backup) {
  const backup = parseBackup(input);
  // Check ALL bytes before any write, not one file at a time during upload.
  await validateFiles(backup);
  await port.assertAccount();
  for (const file of backup.files) {
    await port.assertAccount();
    const existing = await port.download(file.path);
    if (existing) {
      if (existing.length !== file.size || (await digest(existing)) !== file.sha256)
        throw new Error(
          "يوجد مرفق مختلف في المسار نفسه. لم تتم الاستعادة ولم يُستبدل الملف الموجود.",
        );
    } else {
      await port.assertAccount();
      await port.upload(file.path, decode64(file.data, MAX_ATTACHMENT_BYTES), file.mime);
    }
  }
  await port.assertAccount();
  // Database transaction is additive and retry-safe. Never remove uploaded files after an
  // ambiguous network failure: the transaction may have committed despite a lost response.
  const result = restoreResult.parse(await port.restore(backup));
  await port.assertAccount();
  return result;
}
