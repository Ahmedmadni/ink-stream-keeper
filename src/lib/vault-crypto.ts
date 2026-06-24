const enc = new TextEncoder();
const dec = new TextDecoder();
const VERIFIER_PLAINTEXT = "MEMOFLOW_VAULT_OK_v1";
const PBKDF2_ITERATIONS = 150_000;

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
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
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

export async function encryptString(plain: string, key: CryptoKey): Promise<{ iv: string; ct: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
  return { iv: b64encode(iv), ct: b64encode(ct) };
}

export async function decryptString(ivB64: string, ctB64: string, key: CryptoKey): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(ivB64) },
    key,
    b64decode(ctB64),
  );
  return dec.decode(pt);
}

export async function makeVerifier(key: CryptoKey) {
  return encryptString(VERIFIER_PLAINTEXT, key);
}

export async function checkVerifier(ivB64: string, ctB64: string, key: CryptoKey): Promise<boolean> {
  try {
    const plain = await decryptString(ivB64, ctB64, key);
    return plain === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}