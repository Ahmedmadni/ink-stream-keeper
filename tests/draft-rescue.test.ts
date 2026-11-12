import { describe, expect, test } from "bun:test";
import {
  decryptDraftBundle,
  encryptDraftBundle,
  legacyDraftsUnchanged,
  scanLegacyDrafts,
} from "../src/features/notes/draft-rescue";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const NOTE = "33333333-3333-4333-8333-333333333333";
const PASSWORD = "Strong recovery phrase 2026!";

class MemoryStorage implements Storage {
  private rows = new Map<string, string>();
  get length() { return this.rows.size; }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(key, value); }
  removeItem(key: string) { this.rows.delete(key); }
  clear() { this.rows.clear(); }
}
function record(owner = OWNER, title = "مذكرة المشروع") {
  const revision = "44444444-4444-4444-8444-444444444444";
  const key = "memoflow.note-draft.v1:" + owner + ":" + NOTE + ":tab-test:" + revision;
  const raw = JSON.stringify({
    version: 1, userId: owner, noteId: NOTE, revision,
    savedAt: 1790000000000,
    draft: { title, content: "<p>تعديل غير محفوظ</p>" },
    base: { title: "الأصل", content: "<p>محتوى أصلي</p>", updated_at: "2026-11-12T10:00:00.000Z" },
  });
  return { key, raw };
}
function bundle() {
  return {
    format: "memoflow-draft-rescue" as const,
    version: 1 as const, accountId: OWNER,
    createdAt: "2026-11-12T10:00:00.000Z",
    records: [record()],
  };
}
describe("safe recovery of legacy note drafts", () => {
  test("scan isolates account; preserves all raw revisions and detects concurrent changes", () => {
    const storage = new MemoryStorage();
    const one = record();
    storage.setItem(one.key, one.raw);
    const foreign = record(OTHER, "حساب آخر");
    storage.setItem(foreign.key, foreign.raw);
    const captured = scanLegacyDrafts(storage, OWNER);
    expect(captured).toEqual([one]);
    expect(legacyDraftsUnchanged(storage, OWNER, captured)).toBe(true);
    storage.setItem(one.key, record(OWNER, "تعديل متزامن").raw);
    expect(legacyDraftsUnchanged(storage, OWNER, captured)).toBe(false);
    expect(scanLegacyDrafts(storage, OTHER)).toEqual([foreign]);
  });
  test("malformed records fail closed instead of being silently destroyed", () => {
    const storage = new MemoryStorage();
    const item = record();
    storage.setItem(item.key, item.raw);
    storage.setItem(item.key + "-bad", "{");
    expect(() => scanLegacyDrafts(storage, OWNER)).toThrow("غير صالحة");
    expect(storage.getItem(item.key)).toBe(item.raw);
  });
  test("Arabic drafts round-trip with randomized ciphertext, no plaintext leak", async () => {
    const first = await encryptDraftBundle(bundle(), PASSWORD);
    const second = await encryptDraftBundle(bundle(), PASSWORD);
    expect(first).not.toEqual(second);
    expect(first).not.toContain("مذكرة المشروع");
    expect(first).not.toContain("غير محفوظ");
    expect(await decryptDraftBundle(first, PASSWORD, OWNER)).toEqual(bundle());
  }, 20_000);
  test("wrong password, other account, modified ciphertext and KDF are rejected", async () => {
    const encrypted = await encryptDraftBundle(bundle(), PASSWORD);
    await expect(decryptDraftBundle(encrypted, "Different password 2026!", OWNER)).rejects.toThrow();
    await expect(decryptDraftBundle(encrypted, PASSWORD, OTHER)).rejects.toThrow("حسابًا آخر");
    const changed = JSON.parse(encrypted);
    changed.ciphertext = (changed.ciphertext[0] === "A" ? "B" : "A") +
      changed.ciphertext.slice(1);
    await expect(decryptDraftBundle(JSON.stringify(changed), PASSWORD, OWNER)).rejects.toThrow();
    changed.iterations = 1;
    await expect(decryptDraftBundle(JSON.stringify(changed), PASSWORD, OWNER)).rejects.toThrow();
  }, 25_000);
  test("weak password and invalid ownership never produce a rescue", async () => {
    await expect(encryptDraftBundle(bundle(), "12345")).rejects.toThrow();
    const foreign = bundle();
    foreign.records = [record(OTHER)];
    await expect(encryptDraftBundle(foreign, PASSWORD)).rejects.toThrow();
  });
});
