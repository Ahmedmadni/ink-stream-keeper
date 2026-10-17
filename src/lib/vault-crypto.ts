const enc = new TextEncoder();
const dec = new TextDecoder();
const VERIFIER_PLAINTEXT = "MEMOFLOW_VAULT_OK_v1";
const PBKDF2_ITERATIONS = 150_000;
const VAULT_FIELD_PREFIX = "memoflow:vault:v2:";

export type VaultEncryptedField = "label" | "username" | "url" | "notes" | "category_name";

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64decode(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function deriveKey(pin: string, saltB64: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(pin), { name: "PBKDF2" }, false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: b64decode(saltB64),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function randomSaltB64(): string {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  return b64encode(salt);
}

export async function encryptString(
  plain: string,
  key: CryptoKey,
  additionalData?: string,
): Promise<{ iv: string; ct: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const algorithm: AesGcmParams = { name: "AES-GCM", iv };
  if (additionalData) algorithm.additionalData = enc.encode(additionalData);
  const ct = await crypto.subtle.encrypt(algorithm, key, enc.encode(plain));
  return { iv: b64encode(iv), ct: b64encode(ct) };
}

export async function decryptString(
  ivB64: string,
  ctB64: string,
  key: CryptoKey,
  additionalData?: string,
): Promise<string> {
  const algorithm: AesGcmParams = { name: "AES-GCM", iv: b64decode(ivB64) };
  if (additionalData) algorithm.additionalData = enc.encode(additionalData);
  const pt = await crypto.subtle.decrypt(algorithm, key, b64decode(ctB64));
  return dec.decode(pt);
}

function fieldContext(field: VaultEncryptedField): string {
  return `${VAULT_FIELD_PREFIX}${field}`;
}

export function isEncryptedVaultField(value: string): boolean {
  return value.startsWith(VAULT_FIELD_PREFIX);
}

export async function encryptVaultField(
  plain: string,
  field: VaultEncryptedField,
  key: CryptoKey,
): Promise<string> {
  const encrypted = await encryptString(plain, key, fieldContext(field));
  return `${VAULT_FIELD_PREFIX}${encrypted.iv}.${encrypted.ct}`;
}

export async function decryptVaultField(
  stored: string,
  field: VaultEncryptedField,
  key: CryptoKey,
): Promise<{ value: string; encrypted: boolean }> {
  if (!isEncryptedVaultField(stored)) return { value: stored, encrypted: false };
  const payload = stored.slice(VAULT_FIELD_PREFIX.length);
  const separator = payload.indexOf(".");
  if (separator <= 0 || separator === payload.length - 1) {
    throw new Error("بيانات الخزنة المشفرة تالفة");
  }
  const iv = payload.slice(0, separator);
  const ciphertext = payload.slice(separator + 1);
  return {
    value: await decryptString(iv, ciphertext, key, fieldContext(field)),
    encrypted: true,
  };
}

export async function makeVerifier(key: CryptoKey) {
  return encryptString(VERIFIER_PLAINTEXT, key);
}

export async function checkVerifier(
  ivB64: string,
  ctB64: string,
  key: CryptoKey,
): Promise<boolean> {
  try {
    const plain = await decryptString(ivB64, ctB64, key);
    return plain === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}
