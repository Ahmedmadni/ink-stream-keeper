import { z } from "zod";
import { decode64, encode64 } from "@/features/backup/format";

const LEGACY_PREFIX = "memoflow.note-draft.v1:";
const DATABASE = "memoflow-encrypted-draft-rescue";
const STORE = "rescue";
const FORMAT = "memoflow-draft-rescue";
const ITERATIONS = 600_000;
const MAX_RECORDS = 1000;
const MAX_BYTES = 8 * 1024 * 1024;
const encoder = new TextEncoder();
const text = z.object({
  title: z.string().max(2000),
  content: z.string().max(4_000_000),
}).strict();
const draftRecord = z.object({
  version: z.literal(1),
  userId: z.string().uuid(),
  noteId: z.string().uuid(),
  revision: z.string().uuid(),
  savedAt: z.number().finite().positive(),
  draft: text,
  base: text.extend({ updated_at: z.string().min(1).max(64) }),
}).strict();
const bundleSchema = z.object({
  format: z.literal(FORMAT),
  version: z.literal(1),
  accountId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  records: z.array(z.object({ key: z.string().max(2048), raw: z.string() }).strict())
    .min(1).max(MAX_RECORDS),
}).strict();
const envelopeSchema = z.object({
  format: z.literal(FORMAT),
  version: z.literal(1),
  accountId: z.string().uuid(),
  iterations: z.literal(ITERATIONS),
  kdf: z.literal("PBKDF2-SHA256"),
  cipher: z.literal("AES-256-GCM"),
  salt: z.string().length(24),
  iv: z.string().length(16),
  ciphertext: z.string().max(Math.ceil((MAX_BYTES + 16) / 3) * 4),
}).strict();
type Bundle = z.infer<typeof bundleSchema>;
type Entry = Bundle["records"][number];
type Archive = {
  accountId: string;
  createdAt: string;
  count: number;
  encrypted: string;
  version: 1;
};

function safeAccount(accountId: string): void {
  if (!z.string().uuid().safeParse(accountId).success) throw new Error("معرف الحساب غير صالح.");
}
function validatePassword(password: string) {
  if (password.length < 12 || password.trim().length < 12 || password.length > 256)
    throw new Error("استخدم كلمة مرور مكونة من 12 إلى 256 حرفًا.");
}
function validateRecords(accountId: string, entries: Entry[]) {
  const seen = new Set<string>();
  let bytes = 0;
  for (const entry of entries) {
    if (seen.has(entry.key)) throw new Error("يوجد مفتاح مسودة مكرر.");
    seen.add(entry.key);
    let record: z.infer<typeof draftRecord>;
    try {
      record = draftRecord.parse(JSON.parse(entry.raw));
    } catch {
      throw new Error("إحدى المسودات القديمة غير صالحة؛ لم نحذف أي محتوى.");
    }
    const prefix = LEGACY_PREFIX + encodeURIComponent(accountId) + ":" +
      encodeURIComponent(record.noteId) + ":";
    if (record.userId !== accountId || !entry.key.startsWith(prefix) ||
        !entry.key.endsWith(":" + record.revision) || entry.key.length > 2048)
      throw new Error("ملكية مسودة أو معرفها غير مطابق. لم نحذف أي محتوى.");
    bytes += encoder.encode(entry.key).length + encoder.encode(entry.raw).length + 128;
    if (bytes > MAX_BYTES || seen.size > MAX_RECORDS)
      throw new Error("المسودات تتجاوز حد النسخ المشفرة البالغ 8 ميجابايت.");
  }
}
function validateBundle(input: unknown): Bundle {
  const bundle = bundleSchema.parse(input);
  validateRecords(bundle.accountId, bundle.records);
  return bundle;
}
export function scanLegacyDrafts(storage: Storage, accountId: string): Entry[] {
  safeAccount(accountId);
  const prefix = LEGACY_PREFIX + encodeURIComponent(accountId) + ":";
  const items: Entry[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const raw = storage.getItem(key);
    if (raw === null) throw new Error("تعذر قراءة مسودة. لم نغيّر أي محتوى.");
    items.push({ key, raw });
  }
  validateRecords(accountId, items);
  return items.sort((a, b) => a.key.localeCompare(b.key));
}
export function legacyDraftsUnchanged(storage: Storage, accountId: string, captured: Entry[]): boolean {
  const fresh = scanLegacyDrafts(storage, accountId);
  return fresh.length === captured.length &&
    fresh.every((entry, i) => entry.key === captured[i]?.key && entry.raw === captured[i]?.raw);
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
function aad(accountId: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(FORMAT + "|v1|PBKDF2-SHA256:600000|AES-256-GCM|account:" + accountId);
}
export async function encryptDraftBundle(input: Bundle, password: string): Promise<string> {
  validatePassword(password);
  const bundle = validateBundle(input);
  const plain = encoder.encode(JSON.stringify(bundle));
  if (plain.length > MAX_BYTES) throw new Error("الملف المشفر يتجاوز 8 ميجابايت.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  try {
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: aad(bundle.accountId), tagLength: 128 },
      await deriveKey(password, salt), plain,
    );
    return JSON.stringify({
      format: FORMAT, version: 1, accountId: bundle.accountId,
      kdf: "PBKDF2-SHA256", iterations: ITERATIONS, cipher: "AES-256-GCM",
      salt: encode64(salt), iv: encode64(iv),
      ciphertext: encode64(new Uint8Array(encrypted)),
    });
  } finally {
    plain.fill(0);
  }
}
export async function decryptDraftBundle(
  raw: string, password: string, expectedAccount: string,
): Promise<Bundle> {
  validatePassword(password);
  safeAccount(expectedAccount);
  if (raw.length > Math.ceil((MAX_BYTES + 16) / 3) * 4 + 4096)
    throw new Error("ملف الاستعادة المشفر كبير جدًا.");
  let envelope: z.infer<typeof envelopeSchema>;
  try {
    envelope = envelopeSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error("تنسيق ملف الاستعادة غير صالح.");
  }
  if (envelope.accountId !== expectedAccount)
    throw new Error("النسخة المشفرة تخص حسابًا آخر.");
  const salt = decode64(envelope.salt, 16);
  const iv = decode64(envelope.iv, 12);
  if (salt.length !== 16 || iv.length !== 12) throw new Error("بيانات التشفير غير صالحة.");
  let plain: Uint8Array<ArrayBuffer>;
  try {
    plain = new Uint8Array(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: aad(envelope.accountId), tagLength: 128 },
      await deriveKey(password, salt),
      decode64(envelope.ciphertext, MAX_BYTES + 16),
    ));
  } catch {
    throw new Error("كلمة المرور خاطئة أو بيانات المسودات تالفة.");
  }
  try {
    const bundle = validateBundle(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plain)));
    if (bundle.accountId !== envelope.accountId)
      throw new Error("بيانات المسودات تخص حسابًا مختلفًا.");
    return bundle;
  } finally {
    plain.fill(0);
  }
}

function database(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined")
    return Promise.reject(new Error("هذا الجهاز لا يدعم التخزين المحلي المشفر."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: "accountId" });
    };
    request.onerror = () => reject(request.error ?? new Error("تعذر فتح التخزين المحلي."));
    request.onblocked = () => reject(new Error("أغلق نوافذ MemoFlow الأخرى ثم أعد المحاولة."));
    request.onsuccess = () => resolve(request.result);
  });
}
async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, complete: (result: T) => void) => void,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    let result: T;
    try {
      const tx = db.transaction(STORE, mode);
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error ?? new Error("فشل حفظ المسودات.")); };
      tx.onabort = () => { db.close(); reject(tx.error ?? new Error("فشل تخزين المسودات المشفرة.")); };
      operation(tx.objectStore(STORE), (value) => { result = value; });
    } catch (error) { db.close(); reject(error); }
  });
}
async function getArchive(accountId: string): Promise<Archive | undefined> {
  return withStore<Archive | undefined>("readonly", (store, complete) => {
    const req = store.get(accountId);
    req.onsuccess = () => complete(req.result as Archive | undefined);
  });
}
export async function getDraftRescueStatus(accountId: string) {
  safeAccount(accountId);
  const archive = await getArchive(accountId);
  return archive
    ? { exists: true as const, createdAt: archive.createdAt, count: archive.count }
    : { exists: false as const, createdAt: null, count: 0 };
}
export async function protectLegacyDrafts(accountId: string, password: string, storage: Storage) {
  safeAccount(accountId);
  validatePassword(password);
  const captured = scanLegacyDrafts(storage, accountId);
  if (!captured.length) throw new Error("لا توجد مسودات غير محفوظة على هذا الجهاز.");
  if (await getArchive(accountId))
    throw new Error("توجد نسخة إنقاذ مشفرة سابقة. استعدها أولًا قبل حماية مسودات أخرى.");
  const createdAt = new Date().toISOString();
  const encrypted = await encryptDraftBundle({
    format: FORMAT, version: 1, accountId, createdAt, records: captured,
  }, password);
  // add(), not put(): an archive from another tab must never be overwritten.
  await withStore<void>("readwrite", (store) => { store.add({
    accountId, createdAt, count: captured.length, encrypted, version: 1,
  } satisfies Archive); });
  const saved = await getArchive(accountId);
  if (!saved || saved.encrypted !== encrypted ||
      (await decryptDraftBundle(saved.encrypted, password, accountId)).records.length !== captured.length)
    throw new Error("تعذر التحقق من النسخة المشفرة؛ لم تُحذف المسودات القديمة.");
  // A newer tab may have modified a draft during the encryption: never purge
  // records unless the *entire* captured set is still byte-for-byte identical.
  if (!legacyDraftsUnchanged(storage, accountId, captured))
    return { archived: captured.length, removed: 0, changedDuringEncryption: true };
  let removed = 0;
  for (const entry of captured) {
    if (storage.getItem(entry.key) !== entry.raw) break;
    storage.removeItem(entry.key);
    removed++;
  }
  return {
    archived: captured.length,
    removed,
    changedDuringEncryption: removed !== captured.length,
  };
}
export async function restoreLegacyDrafts(accountId: string, password: string, storage: Storage) {
  safeAccount(accountId);
  const archive = await getArchive(accountId);
  if (!archive) throw new Error("لا توجد نسخة إنقاذ مشفرة لهذا الحساب.");
  const bundle = await decryptDraftBundle(archive.encrypted, password, accountId);
  // Check for conflicting revisions before touching localStorage.
  for (const entry of bundle.records) {
    const current = storage.getItem(entry.key);
    if (current !== null && current !== entry.raw)
      throw new Error("توجد مسودة أحدث بالمفتاح نفسه؛ لم نستبدل أي بيانات.");
  }
  for (const entry of bundle.records) storage.setItem(entry.key, entry.raw);
  if (bundle.records.some((entry) => storage.getItem(entry.key) !== entry.raw))
    throw new Error("تعذر التحقق من استعادة جميع المسودات. النسخة المشفرة باقية.");
  // Only delete the exact encrypted revision that we successfully restored.
  await withStore<void>("readwrite", (store) => {
    const request = store.get(accountId);
    request.onsuccess = () => {
      if ((request.result as Archive | undefined)?.encrypted === archive.encrypted)
        store.delete(accountId);
    };
  });
  return { restored: bundle.records.length };
}
