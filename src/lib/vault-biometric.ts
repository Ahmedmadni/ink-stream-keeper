// Biometric (fingerprint / Face ID) unlock for the vault.
// The PIN is wrapped with a NON-EXTRACTABLE AES key kept in IndexedDB on this
// device only, and can only be unwrapped after a successful WebAuthn
// platform-authenticator check with user verification.

const DB = "mf-vault-bio";
const STORE = "kv";
const REC = "record";

type Rec = { credId: ArrayBuffer; iv: Uint8Array<ArrayBuffer>; ct: ArrayBuffer; key: CryptoKey };

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise((res, rej) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => res(req.result as T);
    req.onerror = () => rej(req.error);
  });
}

export async function isBiometricSupported(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

export async function isBiometricEnabled(): Promise<boolean> {
  try { return !!(await idb<Rec | undefined>("readonly", (s) => s.get(REC))); } catch { return false; }
}

export async function disableBiometric() {
  await idb("readwrite", (s) => s.delete(REC));
}

export async function enableBiometric(pin: string, userLabel = "MemoFlow") {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "MemoFlow Vault" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: userLabel, displayName: userLabel },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("cancelled");
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(pin));
  const rec: Rec = { credId: cred.rawId, iv, ct, key };
  await idb("readwrite", (s) => s.put(rec, REC));
}

export async function unlockWithBiometric(): Promise<string> {
  const rec = await idb<Rec | undefined>("readonly", (s) => s.get(REC));
  if (!rec) throw new Error("not-enabled");
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: rec.credId }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  if (!assertion) throw new Error("cancelled");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: rec.iv }, rec.key, rec.ct);
  return new TextDecoder().decode(pt);
}

// PIN held in memory only for the current unlocked session, so the user can
// opt into biometrics right after a PIN unlock. Cleared on lock.
let pendingPin: string | null = null;
export const setPendingPin = (p: string | null) => { pendingPin = p; };
export const getPendingPin = () => pendingPin;
