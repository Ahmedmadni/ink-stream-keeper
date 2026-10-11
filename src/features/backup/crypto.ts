import { z } from "zod";
import {
  decode64,
  encode64,
  MAX_FILE_BYTES,
  MAX_PLAIN_BYTES,
  parseBackup,
  validateFiles,
  type Backup,
} from "./format";

const ITERATIONS = 600_000;
const AAD = new TextEncoder().encode("MemoFlow backup|v1|PBKDF2-SHA256:600000|AES-256-GCM");
const envelope = z
  .object({
    format: z.literal("memoflow-encrypted-backup"),
    version: z.literal(1),
    kdf: z.literal("PBKDF2-SHA256"),
    iterations: z.literal(ITERATIONS),
    cipher: z.literal("AES-256-GCM"),
    salt: z.string().length(24),
    iv: z.string().length(16),
    ciphertext: z.string().max(MAX_FILE_BYTES),
  })
  .strict();
function checkPassword(password: string) {
  if (password.length < 12 || password.length > 256 || password.trim().length < 12)
    throw new Error("استخدم كلمة مرور للنسخة من 12 إلى 256 حرفًا، مختلفة عن رمز الخزنة.");
}
async function key(password: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS, salt },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptBackup(input: Backup, password: string): Promise<string> {
  checkPassword(password);
  const backup = parseBackup(input);
  await validateFiles(backup);
  const plain = new TextEncoder().encode(JSON.stringify(backup));
  if (plain.length > MAX_PLAIN_BYTES)
    throw new Error("النسخة تتجاوز الحجم المدعوم (50 ميجابايت قبل التشفير).");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  try {
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: AAD, tagLength: 128 },
      await key(password, salt),
      plain,
    );
    return JSON.stringify({
      format: "memoflow-encrypted-backup",
      version: 1,
      kdf: "PBKDF2-SHA256",
      iterations: ITERATIONS,
      cipher: "AES-256-GCM",
      salt: encode64(salt),
      iv: encode64(iv),
      ciphertext: encode64(new Uint8Array(ciphertext)),
    });
  } finally {
    plain.fill(0);
  }
}
export async function decryptBackup(text: string, password: string): Promise<Backup> {
  checkPassword(password);
  if (text.length > MAX_FILE_BYTES) throw new Error("الملف أكبر من الحد المدعوم (70 ميجابايت).");
  const parsed = envelope.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("صيغة أو إصدار النسخة غير مدعوم.");
  const value = parsed.data;
  const salt = decode64(value.salt, 16),
    iv = decode64(value.iv, 12);
  if (salt.length !== 16 || iv.length !== 12) throw new Error("ملف غير صالح.");
  let plain: Uint8Array<ArrayBuffer>;
  try {
    plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: AAD, tagLength: 128 },
        await key(password, salt),
        decode64(value.ciphertext, MAX_PLAIN_BYTES + 16),
      ),
    );
  } catch {
    throw new Error("كلمة مرور النسخة غير صحيحة أو الملف تالف.");
  }
  try {
    const backup = parseBackup(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plain)));
    await validateFiles(backup);
    return backup;
  } finally {
    plain.fill(0);
  }
}
