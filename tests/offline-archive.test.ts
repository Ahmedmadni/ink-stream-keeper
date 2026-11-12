import { describe, expect, test } from "bun:test";
import {
  decryptOfflineSnapshot,
  encryptOfflineSnapshot,
  parseOfflineSnapshot,
  type OfflineSnapshot,
} from "../src/features/offline-archive/crypto";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const PASSWORD = "مفكرة آمنة محلية 2026!";

function fixture(): OfflineSnapshot {
  return {
    version: 1,
    accountId: USER,
    createdAt: "2026-11-12T12:00:00.000Z",
    notes: [{
      id: "33333333-3333-4333-8333-333333333333", user_id: USER,
      title: "مذكرة الميزانية", content: "<p>إيرادات ومصاريف المشروع</p>",
      updated_at: "2026-11-12T12:00:00.000Z",
    }],
    tasks: [{
      id: "44444444-4444-4444-8444-444444444444", user_id: USER,
      title: "مراجعة الفواتير", description: "تسوية حسابات العملاء", notes: "يوم الخميس",
      done: false, due_at: null, reminder_at: null, priority: "high",
      updated_at: "2026-11-12T12:00:00.000Z",
    }],
  };
}

describe("encrypted offline read-only archive", () => {
  test("Arabic titles and notes round-trip, without leaking plaintext", async () => {
    const record = fixture();
    const text = await encryptOfflineSnapshot(record, PASSWORD);
    expect(text).not.toContain("مذكرة الميزانية");
    expect(text).not.toContain("مراجعة الفواتير");
    expect(text).not.toContain("إيرادات");
    expect(await decryptOfflineSnapshot(text, PASSWORD, USER)).toEqual(record);
  }, 20_000);

  test("different random salt/nonce on each save", async () => {
    const original = fixture();
    const a = await encryptOfflineSnapshot(original, PASSWORD);
    const b = await encryptOfflineSnapshot(original, PASSWORD);
    expect(a).not.toBe(b);
    expect(JSON.parse(a).iv).not.toEqual(JSON.parse(b).iv);
  }, 20_000);

  test("rejects wrong password, tampering and another account", async () => {
    const a = await encryptOfflineSnapshot(fixture(), PASSWORD);
    await expect(decryptOfflineSnapshot(a, "incorrect passphrase 2026")).rejects.toThrow();
    await expect(decryptOfflineSnapshot(a, PASSWORD, OTHER)).rejects.toThrow("مختلفًا");
    const damaged = JSON.parse(a);
    damaged.ciphertext = (damaged.ciphertext[0] === "A" ? "B" : "A") + damaged.ciphertext.slice(1);
    await expect(decryptOfflineSnapshot(JSON.stringify(damaged), PASSWORD)).rejects.toThrow();
    damaged.iterations = 1;
    await expect(decryptOfflineSnapshot(JSON.stringify(damaged), PASSWORD)).rejects.toThrow("غير مدعومة");
    damaged.iterations = 600_000;
    damaged.accountId = OTHER;
    await expect(decryptOfflineSnapshot(JSON.stringify(damaged), PASSWORD)).rejects.toThrow();
  }, 25_000);

  test("rejects weak passwords and foreign or repeated row identities", async () => {
    await expect(encryptOfflineSnapshot(fixture(), "123456")).rejects.toThrow();
    const foreign = fixture();
    foreign.notes[0].user_id = OTHER;
    expect(() => parseOfflineSnapshot(foreign)).toThrow();
    const duplicate = fixture();
    duplicate.tasks.push({ ...duplicate.tasks[0] });
    expect(() => parseOfflineSnapshot(duplicate)).toThrow();
  });
  test("rejects invalid version, malformed fields and oversized records", () => {
    const wrong: unknown = { ...fixture(), version: 2 };
    expect(() => parseOfflineSnapshot(wrong)).toThrow();
    const wrongField: unknown = { ...fixture(), password: "should never be stored" };
    expect(() => parseOfflineSnapshot(wrongField)).toThrow();
    const tooLong = fixture();
    tooLong.notes[0].content = "x".repeat(4_000_001);
    expect(() => parseOfflineSnapshot(tooLong)).toThrow();
  });
});
