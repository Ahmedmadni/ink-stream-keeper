import { describe, expect, test } from "bun:test";
import { createPage, serializeNotebook } from "../src/features/notebook/model";
import { isVaultNoteCopy, parseVaultNoteCopy, serializeVaultNoteCopy, vaultNotePages } from "../src/features/notebook/vault-note";

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
    expect(() => serializeVaultNoteCopy("x", "z".repeat(1_500_001))).toThrow();
    expect(() => serializeVaultNoteCopy("x", '<div data-mf-notebook-v1="1" data-json="bad"></div>')).toThrow();
    expect(() => parseVaultNoteCopy("MF_ENCRYPTED_NOTE_COPY_V1:{")).toThrow();
  });
});
