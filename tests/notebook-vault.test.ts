import { describe, expect, test } from "bun:test";
import { createPage, serializeNotebook } from "../src/features/notebook/model";
import { MAX_VAULT_NOTE_CONTENT_LENGTH, isVaultNoteCopy, parseVaultNoteCopy, serializeVaultNoteCopy, vaultNotePages } from "../src/features/notebook/vault-note";
import { encryptString, encryptVaultField } from "../src/lib/vault-crypto";
import { verifyStoredVaultNoteCopy, type EncryptedNoteCopyRow } from "../src/features/notebook/verify-vault-copy";

describe("secure note copy inside the encrypted vault", () => {
  test("retains all paged content, pen paths and stickers for encrypted notes field", () => {
    const page = createPage();
    page.html = "<p>مذكرة ضريبية VAT</p>";
    page.strokes.push({ id: crypto.randomUUID(), tool: "pen", width: 4, color: "#142134", points: [[1, 1], [5, 10]] });
    page.stickers.push({ id: crypto.randomUUID(), kind: "calculator", color: "#142134", x: .5, y: .5, scale: .12 });
    const html = serializeNotebook({ version: 1, pages: [page] });
    const payload = serializeVaultNoteCopy("معلومات خاصة", html, "2026-11-15T00:00:00.000Z");
    expect(isVaultNoteCopy(payload)).toBe(true);
    const copy = parseVaultNoteCopy(payload)!;
    expect(copy.content).toBe(html);
    expect(vaultNotePages(copy.content)?.pages[0].strokes).toEqual(page.strokes);
    expect(vaultNotePages(copy.content)?.pages[0].stickers).toEqual(page.stickers);
  });
  test("legacy HTML notes remain valid, and non-note passwords are not misidentified", () => {
    const payload = serializeVaultNoteCopy("ملاحظة قديمة", "<p>بيانات</p>");
    expect(parseVaultNoteCopy(payload)?.content).toEqual("<p>بيانات</p>");
    expect(parseVaultNoteCopy("plain password")).toBeNull();
  });
  test("malformed or oversized records fail closed", () => {
    expect(() => serializeVaultNoteCopy("x", "z".repeat(MAX_VAULT_NOTE_CONTENT_LENGTH + 1))).toThrow();
    expect(() => serializeVaultNoteCopy("x", '<div data-mf-notebook-v1="1" data-json="bad"></div>')).toThrow();
    expect(() => parseVaultNoteCopy("MF_ENCRYPTED_NOTE_COPY_V1:{")).toThrow();
  });
  test("valid large notebooks no longer fail at the smaller vault-copy limit", () => {
    const first = { ...createPage(), html: "a".repeat(900_000) };
    const second = { ...createPage(), html: "b".repeat(900_000) };
    const content = serializeNotebook({ version: 1, pages: [first, second] });
    expect(content.length).toBeGreaterThan(1_500_000);
    expect(parseVaultNoteCopy(serializeVaultNoteCopy("دفتر كبير", content))?.content).toBe(content);
  });
  test("read-after-write verification rejects tampering, plaintext, wrong owner, truncation and missing writes", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const expected = { id: crypto.randomUUID(), userId: crypto.randomUUID(), label: "مذكرة محمية", notes: serializeVaultNoteCopy("عنوان سري", "<p>المحتوى</p>") };
    const password = await encryptString("", key);
    const row: EncryptedNoteCopyRow = { id: expected.id, user_id: expected.userId,
      label: await encryptVaultField(expected.label, "label", key), username: await encryptVaultField("", "username", key),
      url: await encryptVaultField("", "url", key), notes: await encryptVaultField(expected.notes, "notes", key),
      password_iv: password.iv, password_ct: password.ct };
    await verifyStoredVaultNoteCopy(row, expected, key);
    expect(row.notes).not.toContain("المحتوى");
    await expect(verifyStoredVaultNoteCopy(undefined, expected, key)).rejects.toThrow();
    await expect(verifyStoredVaultNoteCopy({ ...row, user_id: crypto.randomUUID() }, expected, key)).rejects.toThrow();
    await expect(verifyStoredVaultNoteCopy({ ...row, notes: expected.notes }, expected, key)).rejects.toThrow();
    await expect(verifyStoredVaultNoteCopy({ ...row, notes: row.notes.slice(0, -8) }, expected, key)).rejects.toThrow();
    await expect(verifyStoredVaultNoteCopy({ ...row, notes: await encryptVaultField(expected.notes + "x", "notes", key) }, expected, key)).rejects.toThrow();
  });
});
