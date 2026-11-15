import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PAPER_TYPES, STICKER_TYPES, createPage, parseNotebook, serializeNotebook } from "../src/features/notebook/model";
import { PaperGuides, paperTextStyle } from "../src/features/notebook/PaperGuides";
import { STICKER_GROUPS, searchStickers, stickerIcon } from "../src/features/notebook/sticker-packs";
import { recognitionInput, recognizedTextPage } from "../src/features/notebook/handwriting";
import { shapePoints } from "../src/features/notebook/ink";

describe("study templates and licensed stickers", () => {
  test("all 70 catalog entries have unique IDs, a renderer and an Arabic label", () => {
    const entries = STICKER_GROUPS.flatMap<readonly [typeof STICKER_TYPES[number], string]>((group) => group.items);
    expect(entries).toHaveLength(70);
    expect(new Set(entries.map(([kind]) => kind)).size).toBe(70);
    expect(new Set(entries.map(([kind]) => kind))).toEqual(new Set(STICKER_TYPES));
    for (const [kind, label] of entries) { expect(label.length).toBeGreaterThan(1); expect(stickerIcon(kind)).toBeDefined(); }
    expect(searchStickers("neuron", "accounting")[0][0]).toBe("sci-neuron");
    expect(searchStickers("ميزان", "study").some(([kind]) => kind === "scale")).toBe(true);
    expect(searchStickers("لا توجد نتيجة لهذا النص", "medical")).toHaveLength(0);
  });
  test("every bundled science SVG is self-contained and preserves provenance", () => {
    const manifest = JSON.parse(readFileSync(new URL("../src/features/notebook/assets/scisvg/manifest.json", import.meta.url), "utf8"));
    expect(manifest.license).toBe("CC-BY-4.0");
    expect(manifest.assets).toHaveLength(20);
    for (const asset of manifest.assets) {
      const svg = readFileSync(new URL("../src/features/notebook/assets/scisvg/" + asset.file, import.meta.url), "utf8");
      expect(svg).toContain("SciSVG");
      expect(svg).toContain("CC BY 4.0");
      const bytes = new TextEncoder().encode(svg);
      const hash = createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");
      expect(hash).toBe(asset.sourceBlobSha);
      expect(svg).not.toMatch(/<(script|foreignObject|image|style|use)\b|\bon\w+\s*=|(?:xlink:)?href\s*=|url\(/i);
    }
  });
  test("all 12 templates render finite geometry and save independent paper settings", () => {
    const pages = PAPER_TYPES.map((paper, i) => ({ ...createPage({ paper, lineSpacing: 24 + i % 9 * 4, texture: i % 2 ? "linen" : "grain", fontSize: 18 }),
      stickers: [{ id: crypto.randomUUID(), kind: "sci-neuron" as const, x: .5, y: .5, scale: .15, color: "#224466", rotation: -45, presentation: "cutout" as const }] }));
    const book = { version: 1 as const, pages };
    expect(parseNotebook(serializeNotebook(book))).toEqual(book);
    for (const page of pages) {
      const svg = renderToStaticMarkup(createElement(PaperGuides, { page }));
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      expect(paperTextStyle(page)["--notebook-line-height" as keyof ReturnType<typeof paperTextStyle>]).toBe(page.lineSpacing + "px");
    }
  });
  test("shapes close exactly, arrows respect aspect ratio, and timings survive serialization", () => {
    expect(shapePoints([10, 10], [40, 30], "rectangle").at(-1)).toEqual([10, 10]);
    expect(shapePoints([10, 10], [40, 30], "ellipse")).toHaveLength(49);
    expect(shapePoints([10, 10], [40, 30], "arrow", 1.4).flat().every(Number.isFinite)).toBe(true);
    const page = createPage();
    page.strokes = [{ id: crypto.randomUUID(), points: [[1, 2], [4, 5]], tool: "pen", color: "#112233", width: 4, times: [100, 150] }];
    expect(parseNotebook(serializeNotebook({ version: 1, pages: [page] }))?.pages[0].strokes[0].times).toEqual([100, 150]);
    page.strokes[0].times = [150, 100];
    expect(() => serializeNotebook({ version: 1, pages: [page] })).toThrow();
    page.strokes[0].times = [100.5, 150];
    expect(() => serializeNotebook({ version: 1, pages: [page] })).toThrow();
  });
});

describe("Arabic digital-ink preparation and reviewed output", () => {
  test("selection excludes highlights, keeps real timing, and does not invent timestamps for old ink", () => {
    const page = createPage();
    const first = { id: crypto.randomUUID(), points: [[10, 10], [30, 40]] as [number, number][], tool: "pen" as const, color: "#112233", width: 3, times: [100, 200] };
    const second = { ...first, id: crypto.randomUUID(), times: undefined };
    page.strokes = [first, second, { ...first, id: crypto.randomUUID(), tool: "highlighter" }];
    expect(recognitionInput(page, new Set()).strokes).toHaveLength(2);
    expect(recognitionInput(page, new Set([first.id])).strokes[0].times).toEqual([100, 200]);
    expect(recognitionInput(page, new Set([second.id])).strokes[0].times).toBeUndefined();
    expect(() => recognitionInput(createPage(), new Set())).toThrow();
  });
  test("reviewed text goes into a new page, escapes HTML and never changes original ink", () => {
    const page = createPage({ paper: "cornell", texture: "grain" });
    page.html = "<p>الأصل</p>";
    const before = structuredClone(page);
    const result = recognizedTextPage(page, 'قيد ١٥٠٠ <img src=x onerror=alert(1)>', "ruqaa");
    expect(result.id).not.toBe(page.id);
    expect(result.html).toContain("Aref Ruqaa");
    expect(result.html).not.toContain("<img");
    expect(result.strokes).toHaveLength(0);
    expect(result.paper).toBe("cornell");
    expect(page).toEqual(before);
    expect(() => recognizedTextPage(page, " ", "ruqaa")).toThrow();
    expect(() => recognizedTextPage(page, "x".repeat(5001), "ruqaa")).toThrow();
  });
});
