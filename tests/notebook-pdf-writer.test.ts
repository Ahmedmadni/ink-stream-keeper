import { describe, expect, test } from "bun:test";
import { deflateSync } from "node:zlib";
import { buildNotebookPdf, MAX_EXPORT_BYTES, type PdfRasterPage } from "../src/features/notebook/pdf-writer";
import { pdfUnicodeHex } from "../src/features/notebook/pdf-text";
const page = (): PdfRasterPage => ({ bytes: new Uint8Array(deflateSync(new Uint8Array([255, 255, 255]))), width: 1, height: 1, widthPt: 420, heightPt: 595 });
const glyph = (text = "د") => ({ text, x: 10, y: 10, width: 10, height: 20 });
describe("notebook PDF container and optional Unicode layer", () => {
  test("plain export has exact dimensions and no note text or font layer", async () => {
    const pdf = await buildNotebookPdf([page()]).text();
    expect(pdf).toStartWith("%PDF-1.7"); expect(pdf).toContain("/MediaBox [0 0 420.000 595.000]");
    expect(pdf).not.toContain("/ToUnicode"); expect(pdf).not.toContain("/ActualText"); expect(pdf).toContain("/FlateDecode");
  });
  test("Unicode mapping retains supplementary codepoints and combining marks", async () => {
    expect(pdfUnicodeHex("دِ😀")).toBe("062F0650D83DDE00");
    const pdf = await buildNotebookPdf([{ ...page(), text: [glyph("😀"), glyph("ِ")] }]).text();
    expect(pdf).toContain("<D83DDE00>"); expect(pdf).toContain("<0650>"); expect(pdf).toContain("3 Tr");
  });
  test("replacement text is UTF16 hex, never executable PDF syntax", async () => {
    const s = "دراسة (x)\\ /JavaScript";
    const pdf = await buildNotebookPdf([{ ...page(), text: [{ ...glyph(), actualText: s, endText: true }] }]).text();
    expect(pdf).toContain("/ActualText <FEFF" + pdfUnicodeHex(s) + ">"); expect(pdf).not.toContain("/JavaScript");
  });
  test("font banks roll over at 255 codes and xref offsets remain accurate", async () => {
    const text = Array.from({ length: 300 }, (_, i) => ({ ...glyph(String.fromCodePoint(0x400 + i)), x: 20 }));
    const blob = buildNotebookPdf([{ ...page(), text }, page()]); const bytes = new Uint8Array(await blob.arrayBuffer());
    const s = new TextDecoder("latin1").decode(bytes);
    expect((s.match(/\/Subtype \/Type3/g) ?? []).length).toBe(2);
    const xref = Number(/startxref\n(\d+)/.exec(s)![1]); expect(s.slice(xref, xref + 4)).toBe("xref");
    const records = s.slice(xref).split("\n"); const n = Number(records[1].split(" ")[1]);
    for (let id = 1; id < n; id++) { const offset = Number(records[id + 2].slice(0, 10)); expect(s.slice(offset)).toStartWith(id + " 0 obj"); }
  });
  test("invalid glyph geometry and malformed replacement blocks fail closed", () => {
    for (const g of [{ ...glyph(), x: -1 }, { ...glyph(), height: 0 }, { ...glyph(), height: 1e-300 }, { ...glyph(), width: Infinity }, glyph("word"), glyph("\ud800"),
      { ...glyph(), endText: true }, { ...glyph(), actualText: "unclosed" }])
      expect(() => buildNotebookPdf([{ ...page(), text: [g] }])).toThrow();
  });
  test("page count, dimensions, total glyphs and final byte budget are bounded", () => {
    expect(() => buildNotebookPdf([])).toThrow(); expect(() => buildNotebookPdf(Array(37).fill(page()))).toThrow();
    expect(() => buildNotebookPdf([{ ...page(), widthPt: NaN }])).toThrow();
    expect(() => buildNotebookPdf([{ ...page(), text: Array(250001).fill(glyph()) }])).toThrow("كبيرة");
    expect(() => buildNotebookPdf([{ ...page(), bytes: new Uint8Array(MAX_EXPORT_BYTES) }])).toThrow("كبير");
  });
});
