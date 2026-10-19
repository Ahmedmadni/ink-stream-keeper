import { describe, expect, test } from "bun:test";
import {
  deriveKey,
  makeVerifier,
  encryptString,
  decryptString,
  encryptVaultField,
  decryptVaultField,
  randomSaltB64,
  prepareVaultPinChange,
  unlockVaultKey,
  type VaultKeySettings,
} from "../src/lib/vault-crypto";
import { changeVaultPinWithStore, type VaultPinStore } from "../src/features/vault/change-pin";
import { VaultSession } from "../src/features/vault/session";

const USER = "11111111-1111-4111-8111-111111111111";
async function fixture() {
  const salt = randomSaltB64();
  const key = await deriveKey("123456", salt);
  const verifier = await makeVerifier(key);
  const settings: VaultKeySettings = {
    user_id: USER,
    kdf_salt: salt,
    verifier_iv: verifier.iv,
    verifier_ct: verifier.ct,
  };
  return { key, settings };
}

describe("vault PIN envelope compatibility", () => {
  test("changes a legacy PIN while preserving existing password and metadata ciphertext", async () => {
    const { key, settings } = await fixture();
    const password = await encryptString("synthetic-password", key);
    const label = await encryptVaultField("حساب تجريبي", "label", key);
    const next = await prepareVaultPinChange("123456", "654321", settings);
    const unlocked = await unlockVaultKey("654321", next);
    expect(unlocked.extractable).toBe(false);
    expect(await decryptString(password.iv, password.ct, unlocked)).toBe("synthetic-password");
    expect((await decryptVaultField(label, "label", unlocked)).value).toBe("حساب تجريبي");
    await expect(unlockVaultKey("123456", next)).rejects.toThrow();
    expect(
      await decryptString(password.iv, password.ct, await unlockVaultKey("123456", settings)),
    ).toBe("synthetic-password");
  });
  test("can change an already changed PIN and keeps normal session keys non-extractable", async () => {
    const { key, settings } = await fixture();
    const secret = await encryptString("retained", key);
    const first = await prepareVaultPinChange("123456", "654321", settings);
    const second = await prepareVaultPinChange("654321", "246810", first);
    const unlocked = await unlockVaultKey("246810", second);
    expect(await decryptString(secret.iv, secret.ct, unlocked)).toBe("retained");
    await expect(crypto.subtle.exportKey("raw", unlocked)).rejects.toThrow();
    await expect(unlockVaultKey("654321", second)).rejects.toThrow();
    expect(second.kdf_salt).not.toBe(first.kdf_salt);
    expect(second.verifier_iv).not.toBe(first.verifier_iv);
  });
  test("rejects incorrect current PINs, unchanged PINs, malformed PINs and tampered envelopes", async () => {
    const { settings } = await fixture();
    const before = JSON.stringify(settings);
    await expect(prepareVaultPinChange("111111", "654321", settings)).rejects.toThrow();
    await expect(prepareVaultPinChange("123456", "123456", settings)).rejects.toThrow();
    await expect(prepareVaultPinChange("123456", "12345", settings)).rejects.toThrow();
    expect(JSON.stringify(settings)).toBe(before);
    const next = await prepareVaultPinChange("123456", "654321", settings);
    await expect(
      unlockVaultKey("654321", { ...next, verifier_iv: randomSaltB64() }),
    ).rejects.toThrow();
    await expect(unlockVaultKey("654321", { ...next, user_id: "other-user" })).rejects.toThrow();
    await expect(
      unlockVaultKey("654321", { ...next, verifier_ct: next.verifier_ct.slice(0, -8) }),
    ).rejects.toThrow();
  });
});

describe("atomic PIN settings update", () => {
  async function setup() {
    const { settings } = await fixture();
    const session = new VaultSession();
    session.setUser(USER);
    let stored = { ...settings };
    let writes = 0;
    const store: VaultPinStore = {
      userId: async () => USER,
      read: async () => ({ ...stored }),
      compareAndSwap: async (previous, next) => {
        writes++;
        if (JSON.stringify(previous) !== JSON.stringify(stored)) return false;
        stored = { ...next };
        return true;
      },
    };
    return { session, store, settings, getStored: () => stored, getWrites: () => writes };
  }
  test("commits one conditional update and leaves the vault locked", async () => {
    const f = await setup();
    const next = await changeVaultPinWithStore("123456", "654321", f.store, f.session);
    expect(f.getWrites()).toBe(1);
    expect(f.getStored()).toEqual(next);
    expect(f.session.isLocked()).toBe(true);
    expect((await unlockVaultKey("654321", f.getStored())).extractable).toBe(false);
  });
  test("never writes after a wrong PIN, failed read, account switch or background lock", async () => {
    const f = await setup();
    await expect(changeVaultPinWithStore("000000", "654321", f.store, f.session)).rejects.toThrow();
    expect(f.getWrites()).toBe(0);
    f.store.read = async () => {
      f.session.lock();
      return f.settings;
    };
    await expect(changeVaultPinWithStore("123456", "654321", f.store, f.session)).rejects.toThrow();
    expect(f.getWrites()).toBe(0);
    f.store.read = async () => {
      f.session.setUser("other");
      return f.settings;
    };
    await expect(changeVaultPinWithStore("123456", "654321", f.store, f.session)).rejects.toThrow();
    expect(f.getWrites()).toBe(0);
    expect(f.getStored()).toEqual(f.settings);
  });
  test("stale or failed writes keep the previous PIN usable and never report success", async () => {
    const f = await setup();
    f.store.compareAndSwap = async () => false;
    await expect(changeVaultPinWithStore("123456", "654321", f.store, f.session)).rejects.toThrow(
      "نافذة أخرى",
    );
    f.store.compareAndSwap = async () => {
      throw new Error("network failed");
    };
    await expect(changeVaultPinWithStore("123456", "654321", f.store, f.session)).rejects.toThrow(
      "network failed",
    );
    expect((await unlockVaultKey("123456", f.getStored())).extractable).toBe(false);
    await expect(unlockVaultKey("654321", f.getStored())).rejects.toThrow();
  });
  test("a successful response cannot unlock or lock a different account", async () => {
    const f = await setup();
    const otherKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    f.store.compareAndSwap = async () => {
      f.session.setUser("other");
      f.session.completeUnlock(f.session.beginUnlock("other"), otherKey);
      return true;
    };
    await changeVaultPinWithStore("123456", "654321", f.store, f.session);
    expect(f.session.requireKey("other")).toBe(otherKey);
    expect(f.session.isCurrentUser(USER)).toBe(false);
  });
});
