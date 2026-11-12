import { describe, expect, test } from "bun:test";
import { forgetVerifiedUser, mayUseOfflineSession, rememberVerifiedUser } from "../src/lib/offline-verified-session";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
  };
}
const NOW = Date.UTC(2026, 10, 12, 8, 0);

describe("short-lived offline verification receipt", () => {
  test("accepts the exact previously verified user with a valid session", () => {
    const storage = fakeStorage();
    rememberVerifiedUser(storage, "verified-user", NOW);
    expect(mayUseOfflineSession(storage, "verified-user", NOW / 1000 + 3600, NOW)).toBe(true);
  });
  test("never grants access to a different account or missing session", () => {
    const storage = fakeStorage();
    rememberVerifiedUser(storage, "one", NOW);
    expect(mayUseOfflineSession(storage, "two", NOW / 1000 + 3600, NOW)).toBe(false);
    expect(mayUseOfflineSession(storage, "one", null, NOW)).toBe(false);
    expect(mayUseOfflineSession(storage, null, NOW / 1000 + 3600, NOW)).toBe(false);
  });
  test("rejects expired tokens, nearly expired tokens and stale verification", () => {
    const storage = fakeStorage();
    rememberVerifiedUser(storage, "one", NOW);
    expect(mayUseOfflineSession(storage, "one", NOW / 1000 - 1, NOW)).toBe(false);
    expect(mayUseOfflineSession(storage, "one", NOW / 1000 + 29, NOW)).toBe(false);
    expect(mayUseOfflineSession(storage, "one", (NOW + 9 * 3600_000) / 1000, NOW + 8 * 3600_000)).toBe(false);
  });
  test("rejects fabricated future or malformed receipts", () => {
    const storage = fakeStorage();
    rememberVerifiedUser(storage, "one", NOW + 60_000);
    expect(mayUseOfflineSession(storage, "one", NOW / 1000 + 3600, NOW)).toBe(false);
    storage.setItem("memoflow.offline-verified-user.v1", "{");
    expect(mayUseOfflineSession(storage, "one", NOW / 1000 + 3600, NOW)).toBe(false);
  });
  test("signout removes the trust receipt", () => {
    const storage = fakeStorage();
    rememberVerifiedUser(storage, "one", NOW);
    forgetVerifiedUser(storage);
    expect(mayUseOfflineSession(storage, "one", NOW / 1000 + 3600, NOW)).toBe(false);
  });
  test("storage failures never allow navigation", () => {
    const storage = {
      getItem: (_key: string): string | null => { throw Error("disabled"); },
      setItem: (_key: string, _value: string) => { throw Error("disabled"); },
      removeItem: (_key: string) => { throw Error("disabled"); },
    };
    rememberVerifiedUser(storage, "one", NOW);
    forgetVerifiedUser(storage);
    expect(mayUseOfflineSession(storage, "one", NOW / 1000 + 3600, NOW)).toBe(false);
  });
});
