import { z } from "zod";
import { TABLES, rowSchemas, type BackupTables } from "./rows";

export const MAX_FILE_BYTES = 70 * 1024 * 1024;
export const MAX_PLAIN_BYTES = 50 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 32 * 1024 * 1024;
export const MAX_ROWS = 10_000;
export const fileSchema = z
  .object({
    path: z.string().min(1).max(1024),
    mime: z.string().max(255),
    size: z.number().int().nonnegative().max(MAX_ATTACHMENT_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    data: z.string(),
  })
  .strict();
const headerSchema = z
  .object({
    format: z.literal("memoflow-backup"),
    version: z.literal(1),
    accountId: z.string().uuid(),
    createdAt: z.string().datetime({ offset: true }),
    tables: z.record(z.array(z.record(z.unknown()))),
    files: z.array(fileSchema),
  })
  .strict();
export type Backup = Omit<z.infer<typeof headerSchema>, "tables"> & { tables: BackupTables };
export function parseBackup(input: unknown): Backup {
  const backup = headerSchema.parse(input);
  if (Object.keys(backup.tables).length !== TABLES.length || TABLES.some((t) => !backup.tables[t]))
    throw new Error("النسخة لا تحتوي جميع أقسام البيانات المدعومة.");
  let count = 0;
  for (const table of TABLES) {
    const ids = new Set<string>();
    for (const row of backup.tables[table]) {
      rowSchemas[table].parse(row);
      if (++count > MAX_ROWS) throw new Error("عدد عناصر النسخة يتجاوز الحد المدعوم (10 آلاف).");
      const owner = table === "profiles" ? row.id : row.user_id;
      const id = String(table === "vault_settings" ? row.user_id : row.id);
      if (owner !== backup.accountId || ids.has(id))
        throw new Error("ملكية أو معرّفات غير صالحة في النسخة.");
      ids.add(id);
    }
  }
  const settings = backup.tables.vault_settings;
  if (settings.length > 1 || (backup.tables.vault_entries.length && settings.length !== 1))
    throw new Error("إعداد تشفير الخزنة مفقود أو غير صالح.");
  const paths = new Map<string, { size: number; mime: string }>();
  for (const row of [...backup.tables.attachments, ...backup.tables.item_attachments]) {
    const path = String(row.storage_path);
    if (!validPath(path, backup.accountId)) throw new Error("مسار مرفق غير صالح.");
    const existing = paths.get(path);
    if (existing && (existing.size !== row.size_bytes || existing.mime !== row.mime_type))
      throw new Error("بيانات المرفقات متعارضة.");
    paths.set(path, { size: Number(row.size_bytes), mime: String(row.mime_type) });
  }
  const seen = new Set<string>();
  let total = 0;
  for (const file of backup.files) {
    const expected = paths.get(file.path);
    if (
      !expected ||
      seen.has(file.path) ||
      expected.size !== file.size ||
      expected.mime !== file.mime
    )
      throw new Error("مرفق مفقود أو مكرر أو غير مطابق.");
    if (!validPath(file.path, backup.accountId)) throw new Error("مسار مرفق غير صالح.");
    seen.add(file.path);
    total += file.size;
  }
  if (seen.size !== paths.size || total > MAX_ATTACHMENT_BYTES)
    throw new Error("المرفقات غير مكتملة أو تتجاوز 32 ميجابايت.");
  return backup as Backup;
}
export function validPath(path: string, owner: string) {
  return (
    path.startsWith(`${owner}/`) &&
    !path.includes("\\") &&
    !path.includes("%") &&
    path.split("/").every((part) => part !== "" && part !== "." && part !== "..")
  );
}
export function encode64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function decode64(value: string, max: number): Uint8Array<ArrayBuffer> {
  if (
    value.length > Math.ceil(max / 3) * 4 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  )
    throw new Error("ترميز ملف غير صالح.");
  const binary = atob(value);
  if (binary.length > max) throw new Error("الملف أكبر من الحد المدعوم.");
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
export async function digest(bytes: Uint8Array<ArrayBuffer>) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function validateFiles(backup: Backup) {
  for (const file of backup.files) {
    const bytes = decode64(file.data, MAX_ATTACHMENT_BYTES);
    if (bytes.length !== file.size || (await digest(bytes)) !== file.sha256)
      throw new Error("محتوى أحد المرفقات تالف؛ لم تبدأ الاستعادة.");
  }
}
