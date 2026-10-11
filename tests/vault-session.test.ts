import { describe, expect, test } from "bun:test";
import { VaultSession } from "../src/features/vault/session";
import { encryptString, decryptString, deriveKey, randomSaltB64 } from "../src/lib/vault-crypto";

const makeKey = () =>
  crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
describe("vault session isolation", () => {
  test("a lock during identity verification also invalidates setup and unlock", () => {
    const session = new VaultSession();
    session.setUser("user-a");
    const ticket = session.beginUnlock();
    session.lock();
    expect(() => session.assertUnlockCurrent(ticket)).toThrow();
    expect(() => session.access()).toThrow();
    session.setUser(null);
    expect(() => session.beginUnlock()).toThrow();
  });
  test("account changes drop the key and reject a previous user's key", async () => {
    const session = new VaultSession();
    session.setUser("user-a");
    const key = await makeKey();
    const ticket = session.beginUnlock("user-a");
    expect(session.completeUnlock(ticket, key)).toBe(true);
    session.setUser("user-b");
    expect(session.isLocked()).toBe(true);
    expect(() => session.requireKey("user-a")).toThrow();
    expect(() => session.requireKey("user-b")).toThrow();
  });
  test("a pending unlock cannot reopen a manually or background-locked vault", async () => {
    const session = new VaultSession();
    session.setUser("user-a");
    const ticket = session.beginUnlock("user-a");
    session.lock();
    expect(session.completeUnlock(ticket, await makeKey())).toBe(false);
    expect(session.isLocked()).toBe(true);
  });
  test("a pending unlock cannot survive sign-out then signing into the same account", async () => {
    const session = new VaultSession();
    session.setUser("user-a");
    const ticket = session.beginUnlock("user-a");
    session.setUser(null);
    session.setUser("user-a");
    expect(session.completeUnlock(ticket, await makeKey())).toBe(false);
  });
  test("replacing the key invalidates an in-flight reveal and older unlock attempts", async () => {
    const session = new VaultSession();
    session.setUser("user-a");
    const key = await makeKey();
    const first = session.beginUnlock("user-a");
    session.completeUnlock(first, key);
    const later = session.beginUnlock("user-a");
    expect(session.completeUnlock(first, key)).toBe(false);
    session.completeUnlock(later, await makeKey());
    expect(() => session.assertCurrent("user-a", key)).toThrow();
  });
  test("refreshing the same authenticated identity preserves a valid session", async () => {
    const session = new VaultSession();
    session.setUser("user-a");
    const key = await makeKey();
    session.completeUnlock(session.beginUnlock("user-a"), key);
    session.setUser("user-a");
    expect(session.requireKey("user-a")).toBe(key);
  });
});

test("legacy encrypted passwords remain readable; corrupted ciphertext is rejected", async () => {
  const key = await deriveKey("123456", randomSaltB64());
  const encrypted = await encryptString("synthetic-secret", key);
  expect(await decryptString(encrypted.iv, encrypted.ct, key)).toBe("synthetic-secret");
  const bytes = Uint8Array.from(atob(encrypted.ct), (c) => c.charCodeAt(0));
  bytes[0] ^= 1;
  await expect(
    decryptString(encrypted.iv, btoa(String.fromCharCode(...bytes)), key),
  ).rejects.toThrow();
});
