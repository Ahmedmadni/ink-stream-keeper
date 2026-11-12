import { z } from "zod";
import { decode64, encode64 } from "@/features/backup/format";

/**
 * An opt-in read-only offline copy. No vault entries, attachments or tokens.
 * The password is NEVER persisted. The envelope binds the account UUID as AAD
 * and checks ownership of every row before encryption and after decryption.
 */
export const MAX_OFFLINE_PLAIN_BYTES = 8 * 1024 * 1024;
export const MAX_OFFLINE_ITEMS = 10_000;
const ITERATIONS = 600_000;
const FORMAT = "memoflow-offline-snapshot";
const encoder = new TextEncoder();
const noteSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().max(2_000),
  content: z.string().max(4_000_000),
  updated_at: z.string().max(64),
}).strict();
const taskSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().max(2_000),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  done: z.boolean(),
  due_at: z.string().nullable(),
  reminder_at: z.string().nullable(),
  priority: z.enum(["low", "med", "high"]),
  updated_at: z.string().max(64),
}).strict();
const snapshotSchema = z.object({
  version: z.literal(1),
  accountId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  notes: z.array(noteSchema).max(MAX_OFFLINE_ITEMS),
  tasks: z.array(taskSchema).max(MAX_OFFLINE_ITEMS),
}).strict();
const envelopeSchema = z.object({
  format: z.literal(FORMAT),
  version: z.literal(1),
  accountId: z.string().uuid(),
  kdf: z.literal("PBKDF2-SHA256"),
  iterations: z.literal(ITERATIONS),
  cipher: z.literal("AES-256-GCM"),
  salt: z.string().length(24),
  iv: z.string().length(16),
  ciphertext: z.string().max(Math.ceil((MAX_OFFLINE_PLAIN_BYTES + 16) / 3) * 4),
}).strict();

export type OfflineSnapshot = z.infer<typeof snapshotSchema>;
export type OfflineNote = OfflineSnapshot["notes"][number];
export type OfflineTask = OfflineSnapshot["tasks"][number];

export function parseOfflineSnapshot(input: unknown): OfflineSnapshot {
  const value = snapshotSchema.parse(input);
  if (value.notes.length + value.tasks.length > MAX_OFFLINE_ITEMS)
    throw new Error("عدد العناصر يتجاوز الحد المسموح.");
  const noteIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const note of value.notes) {
    if (note.user_id !== value.accountId || noteIds.has(note.id))
      throw new Error("المذكرات لا تخص الحساب أو تحتوي معرفات مكررة.");
    noteIds.add(note.id);
  }
  for (const task of value.tasks) {
    if (task.user_id !== value.accountId || taskIds.has(task.id))
      throw new Error("المهام لا تخص الحساب أو تحتوي معرفات مكررة.");
    taskIds.add(task.id);
  }
  return value;
}

function validatePassword(password: string) {
  if (password.length < 12 || password.trim().length < 12 || password.length > 256)
    throw new Error("استخدم كلمة مرور قوية من 12 إلى 256 حرفًا، ولا تستخدم رمز التطبيق.");
}
function authenticatedData(accountId: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(`${FORMAT}|v1|PBKDF2-SHA256:600000|AES-256-GCM|account:${accountId}`);
}
async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS, salt },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

export async function encryptOfflineSnapshot(input: OfflineSnapshot, password: string): Promise<string> {
  validatePassword(password);
  const data = parseOfflineSnapshot(input);
  const plain = encoder.encode(JSON.stringify(data));
  if (plain.length > MAX_OFFLINE_PLAIN_BYTES) throw new Error("حجم النسخة كبير جدًا للحفظ المحلي.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  try {
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: authenticatedData(data.accountId), tagLength: 128 },
      await deriveKey(password, salt), plain,
    );
    return JSON.stringify({
      format: FORMAT, version: 1, accountId: data.accountId,
      kdf: "PBKDF2-SHA256", iterations: ITERATIONS, cipher: "AES-256-GCM",
      salt: encode64(salt), iv: encode64(iv),
      ciphertext: encode64(new Uint8Array(ciphertext)),
    });
  } finally {
    plain.fill(0);
  }
}

export async function decryptOfflineSnapshot(
  encrypted: string, password: string, expectedAccountId?: string,
): Promise<OfflineSnapshot> {
  validatePassword(password);
  if (encrypted.length > Math.ceil((MAX_OFFLINE_PLAIN_BYTES + 16) / 3) * 4 + 4096)
    throw new Error("النسخة المحلية أكبر من الحد المسموح.");
  let envelope: z.infer<typeof envelopeSchema>;
  try {
    envelope = envelopeSchema.parse(JSON.parse(encrypted));
  } catch {
    throw new Error("صيغة النسخة المحلية غير صالحة أو غير مدعومة.");
  }
  if (expectedAccountId && envelope.accountId !== expectedAccountId)
    throw new Error("النسخة تخص حسابًا مختلفًا.");
  const salt = decode64(envelope.salt, 16);
  const iv = decode64(envelope.iv, 12);
  if (salt.length !== 16 || iv.length !== 12) throw new Error("النسخة المحلية غير صالحة.");
  let plain: Uint8Array<ArrayBuffer>;
  try {
    plain = new Uint8Array(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: authenticatedData(envelope.accountId), tagLength: 128 },
      await deriveKey(password, salt),
      decode64(envelope.ciphertext, MAX_OFFLINE_PLAIN_BYTES + 16),
    ));
  } catch {
    throw new Error("كلمة مرور النسخة غير صحيحة أو محتواها تالف.");
  }
  try {
    const result = parseOfflineSnapshot(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plain)));
    if (result.accountId !== envelope.accountId)
      throw new Error("معرّف الحساب لا يطابق النسخة المشفّرة.");
    return result;
  } finally {
    plain.fill(0);
  }
}
