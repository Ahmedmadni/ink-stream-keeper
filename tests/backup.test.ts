import { describe, test, expect } from "bun:test";
import { encryptBackup, decryptBackup } from "../src/features/backup/crypto";
import { decode64, digest, encode64, parseBackup } from "../src/features/backup/format";
import {
  exportBackup,
  previewBackup,
  restoreBackup,
  type BackupPort,
} from "../src/features/backup/service";
import { ACCOUNT, OTHER, NOTE, fixture } from "./backup-fixture";
const PASSWORD = "strong backup phrase 2026";
async function withFile() {
  const b = fixture();
  const bytes = new TextEncoder().encode("ملف عربي");
  const path = `${ACCOUNT}/note/file.txt`;
  b.files.push({
    path,
    size: bytes.length,
    mime: "text/plain",
    sha256: await digest(bytes),
    data: encode64(bytes),
  });
  b.tables.attachments.push({
    id: "44444444-4444-4444-8444-444444444444",
    user_id: ACCOUNT,
    note_id: NOTE,
    name: "مرفق.txt",
    mime_type: "text/plain",
    size_bytes: bytes.length,
    storage_path: path,
    created_at: b.createdAt,
  });
  return b;
}
function portFor(b = fixture()) {
  const calls: string[] = [];
  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  const port: BackupPort = {
    async assertAccount() {
      calls.push("account");
    },
    async snapshot() {
      return b;
    },
    async download(path) {
      calls.push("read");
      return files.get(path) ?? null;
    },
    async upload(path, bytes) {
      calls.push("upload");
      files.set(path, bytes);
    },
    async restore() {
      calls.push("restore");
      return { inserted: 1, skipped: 0 };
    },
  };
  return { port, calls, files };
}
describe("encrypted backups", () => {
  test("Arabic content and attachment bytes round trip with randomized ciphertext", async () => {
    const b = await withFile();
    const first = await encryptBackup(b, PASSWORD),
      second = await encryptBackup(b, PASSWORD);
    expect(first).not.toBe(second);
    expect(first).not.toContain("مذكرة");
    expect(first).not.toContain(ACCOUNT);
    expect(await decryptBackup(first, PASSWORD)).toEqual(b);
  });
  test("wrong password, altered ciphertext and changed KDF version rejected", async () => {
    const text = await encryptBackup(fixture(), PASSWORD);
    await expect(decryptBackup(text, "different password long")).rejects.toThrow();
    const changed = JSON.parse(text);
    changed.ciphertext = (changed.ciphertext[0] === "A" ? "B" : "A") + changed.ciphertext.slice(1);
    await expect(decryptBackup(JSON.stringify(changed), PASSWORD)).rejects.toThrow();
    changed.iterations = 999999999;
    await expect(decryptBackup(JSON.stringify(changed), PASSWORD)).rejects.toThrow("غير مدعوم");
  });
  test("weak password and another account rejected", async () => {
    await expect(encryptBackup(fixture(), "123456")).rejects.toThrow();
    const text = await encryptBackup(fixture(), PASSWORD);
    await expect(previewBackup(text, PASSWORD, OTHER)).rejects.toThrow("حسابًا آخر");
  });
  test("unknown sections, unknown columns, foreign rows and duplicate IDs rejected", () => {
    const b = fixture();
    b.tables.notes[0].surprise = true;
    expect(() => parseBackup(b)).toThrow();
    delete b.tables.notes[0].surprise;
    b.tables.notes[0].user_id = OTHER;
    expect(() => parseBackup(b)).toThrow();
    b.tables.notes[0].user_id = ACCOUNT;
    b.tables.notes.push(b.tables.notes[0]);
    expect(() => parseBackup(b)).toThrow();
  });
  test("missing attachments and unsafe paths rejected before download", async () => {
    const b = await withFile();
    b.files = [];
    expect(() => parseBackup(b)).toThrow();
    b.tables.attachments[0].storage_path = `${ACCOUNT}/../other`;
    const { port, calls } = portFor(b);
    await expect(exportBackup(port, ACCOUNT, PASSWORD)).rejects.toThrow();
    expect(calls).not.toContain("read");
  });
  test("absent attachment blocks export instead of producing incomplete backup", async () => {
    const { port } = portFor(await withFile());
    await expect(exportBackup(port, ACCOUNT, PASSWORD)).rejects.toThrow("ناقصة");
  });
  test("all attachment hashes verified before any upload or database write", async () => {
    const b = await withFile();
    b.files[0].sha256 = "0".repeat(64);
    const { port, calls } = portFor(b);
    await expect(restoreBackup(port, b)).rejects.toThrow("تالف");
    expect(calls).toEqual([]);
  });
  test("restore uploads missing file; retries verify identical bytes without reupload", async () => {
    const b = await withFile();
    const { port, calls } = portFor(b);
    await restoreBackup(port, b);
    await restoreBackup(port, b);
    expect(calls.filter((x) => x === "upload")).toHaveLength(1);
    expect(calls.filter((x) => x === "restore")).toHaveLength(2);
  });
  test("existing different file is never overwritten", async () => {
    const b = await withFile();
    const { port, calls, files } = portFor(b);
    files.set(b.files[0].path, new Uint8Array([1]));
    await expect(restoreBackup(port, b)).rejects.toThrow("مختلف");
    expect(calls).not.toContain("upload");
    expect(calls).not.toContain("restore");
  });
  test("network error reading storage does not become a missing object", async () => {
    const b = await withFile();
    const { port, calls } = portFor(b);
    port.download = async () => {
      throw new Error("offline");
    };
    await expect(restoreBackup(port, b)).rejects.toThrow();
    expect(calls).not.toContain("upload");
    expect(calls).not.toContain("restore");
  });
  test("account change after an upload stops database restore", async () => {
    const b = await withFile();
    const { port, calls } = portFor(b);
    let active = true;
    const upload = port.upload;
    port.upload = async (...args) => {
      await upload(...args);
      active = false;
    };
    port.assertAccount = async () => {
      if (!active) throw new Error("account changed");
    };
    await expect(restoreBackup(port, b)).rejects.toThrow("account changed");
    expect(calls).not.toContain("restore");
  });
  test("lost database response keeps uploaded bytes for a safe retry", async () => {
    const b = await withFile();
    const { port, files } = portFor(b);
    port.restore = async () => {
      throw new Error("lost response");
    };
    await expect(restoreBackup(port, b)).rejects.toThrow();
    expect(files.has(b.files[0].path)).toBe(true);
  });
  test("large binary base64 is validated without regex stack overflow", () => {
    const bytes = new Uint8Array(2 * 1024 * 1024).fill(42);
    expect(decode64(encode64(bytes), bytes.length)).toEqual(bytes);
  });
});
