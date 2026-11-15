import { describe, expect, test } from "bun:test";
import {
  appendHtmlToNotebook, createPage, dimensionsMm, fromLegacyNote, inkPath,
  isNotebookContent, parseNotebook, serializeNotebook, validateNotebook,
  type Notebook,
} from "../src/features/notebook/model";

function notebook(): Notebook {
  return {
    version: 1,
    pages: [
      { ...createPage({ paper: "ledger", size: "a4", tint: "ivory" }),
        html: "<p>القيد المحاسبي <strong>المدين</strong> والدائن</p>",
        strokes: [{
          id: crypto.randomUUID(), tool: "pen", color: "#001122", width: 3,
          points: [[0, 0], [20, 22], [35, 48], [80, 70]],
        }],
        stickers: [{
          id: crypto.randomUUID(), kind: "calculator", color: "#224466", x: .54, y: .26, scale: .12,
        }],
      },
      { ...createPage({ paper: "cornell", size: "letter", orientation: "landscape" }),
        html: "<h2>الفصل الثاني</h2><p>المادة العلمية</p>",
      },
    ],
  };
}

describe("notebook data format", () => {
  test("Arabic multi-page HTML, sticker position and pen points round-trip", () => {
    const value = notebook();
    const html = serializeNotebook(value);
    expect(isNotebookContent(html)).toBe(true);
    expect(html).toContain("data-mf-notebook-v1");
    expect(html).toContain("القيد المحاسبي");
    expect(parseNotebook(html)).toEqual(value);
    expect(html).not.toContain("224466"); // Raw structured payload is encoded, not embedded as attrs.
  });
  test("convert a legacy note without changing its HTML body", () => {
    const original = '<h2>محاضرة</h2><p>حسابات العملاء <strong>2026</strong></p>';
    const value = fromLegacyNote(original, { paper: "grid", size: "a5" });
    expect(value.pages).toHaveLength(1);
    expect(value.pages[0].html).toBe(original);
    expect(value.pages[0].paper).toBe("grid");
    expect(parseNotebook(serializeNotebook(value))).toEqual(value);
    expect(parseNotebook(original)).toBeNull();
  });
  test("lecture transcript append preserves page count and existing drawings", () => {
    const value = notebook();
    const changed = parseNotebook(appendHtmlToNotebook(serializeNotebook(value), "<p>سؤال جديد</p>"))!;
    expect(changed.pages).toHaveLength(2);
    expect(changed.pages[0]).toEqual(value.pages[0]);
    expect(changed.pages[1].html).toContain("سؤال جديد");
    expect(appendHtmlToNotebook("<p>legacy</p>", "<p>after</p>")).toBe("<p>legacy</p><p>after</p>");
  });
  test("reject invalid document, duplicate pages, oversized content and invalid stickers", () => {
    const a = notebook();
    a.pages[1].id = a.pages[0].id;
    expect(() => validateNotebook(a)).toThrow("مكرر");
    const b = notebook();
    b.pages[0].html = "x".repeat(1_000_001);
    expect(() => serializeNotebook(b)).toThrow();
    const c = notebook();
    c.pages[0].stickers[0].x = 2;
    expect(() => validateNotebook(c)).toThrow();
    expect(() => parseNotebook('<div data-mf-notebook-v1="1" data-json="broken"></div>')).toThrow();
    expect(() => parseNotebook('<div data-mf-notebook-v1="1" data-json="!!"></div>')).toThrow();
  });
  test("all paper physical sizes and landscape mode", () => {
    expect(dimensionsMm("a4", "portrait")).toEqual([210, 297]);
    expect(dimensionsMm("a4", "landscape")).toEqual([297, 210]);
    expect(dimensionsMm("a5", "portrait")).toEqual([148, 210]);
    expect(dimensionsMm("square", "landscape")).toEqual([210, 210]);
  });
  test("damaged envelopes and unknown markers never fall through to legacy editing", () => {
    const html = serializeNotebook(notebook());
    expect(() => parseNotebook(html.slice(0, -6))).toThrow();
    expect(() => parseNotebook(html + "<p>تعديل أحدث خارج الصفحات</p>")).toThrow();
    expect(() => parseNotebook(html.replace('data-mf-notebook-v1="1"', 'class="sheet" data-mf-notebook-v1="1"'))).toThrow();
    const future = html.replace("data-mf-notebook-v1", "data-mf-notebook-v2");
    expect(isNotebookContent(future)).toBe(true);
    expect(() => parseNotebook(future)).toThrow();
    expect(parseNotebook("<p>المذكرة القديمة كما هي</p>")).toBeNull();
  });
  test("pen path smoothing never introduces NaN or undefined points", () => {
    const points: [number, number][] = [[10, 10], [20, 30], [40, 50], [80, 70]];
    expect(inkPath(points, true)).toContain(" Q ");
    expect(inkPath(points, false)).toContain(" L ");
    expect(inkPath(points, true)).not.toMatch(/NaN|undefined/);
    expect(inkPath([])).toBe("");
  });
});
