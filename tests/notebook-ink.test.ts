import { describe, expect, test } from "bun:test";
import { createPage, parseNotebook, serializeNotebook, validateNotebook, type InkStroke } from "../src/features/notebook/model";
import { hitStroke, inkBounds, inkShape, InkHistory, moveInk } from "../src/features/notebook/ink";

function stroke(): InkStroke {
  return { id: crypto.randomUUID(), tool: "pen", color: "#203040", width: 8,
    points: [[100, 100], [200, 200], [300, 150]], pressures: [.1, .5, 1], smoothing: true };
}

describe("Notebook Studio ink engine", () => {
  test("pressure/smoothing round-trip without migrating old v1 samples", () => {
    const page = createPage(); const pen = stroke();
    page.strokes = [pen, { ...pen, id: crypto.randomUUID(), pressures: undefined, smoothing: undefined }];
    const parsed = parseNotebook(serializeNotebook({ version: 1, pages: [page] }))!;
    expect(parsed.pages[0].strokes).toEqual(page.strokes);
    const original = structuredClone(pen);
    expect(inkShape(pen, 297 / 210).fill).toBe(true);
    expect(inkShape(pen, 210 / 297).d).not.toMatch(/NaN|undefined/);
    expect(pen).toEqual(original);
    pen.pressures = [.2];
    expect(() => validateNotebook({ version: 1, pages: [{ ...page, strokes: [pen] }] })).toThrow();
  });
  test("pressure changes the outline, including single dots", () => {
    const pen = stroke();
    const light = inkShape({ ...pen, pressures: [.1, .1, .1] });
    const heavy = inkShape({ ...pen, pressures: [1, 1, 1] });
    expect(light.d).not.toBe(heavy.d);
    const dot = inkShape({ ...pen, points: [[5, 5]], pressures: [.5] });
    expect(dot.d).toContain(" a ");
    expect(dot.d).not.toMatch(/NaN|undefined/);
  });
  test("swept eraser hits crossings, near lines and dots on non-square pages", () => {
    const pen = { ...stroke(), points: [[100, 100], [300, 100]] as [number, number][] };
    expect(hitStroke(pen, [200, 0], [200, 200], 5, 1.414)).toBe(true);
    expect(hitStroke(pen, [200, 105], [200, 105], 5, 1.414)).toBe(true);
    expect(hitStroke(pen, [200, 150], [250, 150], 5, 1.414)).toBe(false);
    expect(hitStroke({ ...pen, points: [[50, 50]] }, [40, 40], [60, 60], 5, .707)).toBe(true);
  });
  test("selection move preserves pressures/originals and clamps a group together", () => {
    const a = stroke(), b = { ...stroke(), id: crypto.randomUUID(), points: [[950, 990]] as [number, number][] };
    const original = structuredClone([a, b]);
    const moved = moveInk([a, b], new Set([a.id, b.id]), 500, 500);
    expect(inkBounds(moved)).toEqual({ x: 150, y: 110, width: 850, height: 890 });
    expect(moved[0].pressures).toEqual(a.pressures);
    expect([a, b]).toEqual(original);
    expect(moveInk([a, b], new Set([a.id]), 10, 20)[1]).toBe(b);
  });
  test("erase/move undo and redo are isolated by page, preserve text and clear redo after new edits", () => {
    const history = new InkHistory(), a = createPage(), b = createPage();
    const first = { ...a, strokes: [stroke()] };
    const erased = { ...first, strokes: [] };
    history.record(a.id, a, first);
    history.record(a.id, first, erased);
    history.record(b.id, b, { ...b, strokes: [stroke()] });
    const restore = history.undo(a.id)!;
    expect(restore.strokes).toEqual(first.strokes);
    expect({ ...erased, html: "<p>new typing</p>", ...restore }.html).toBe("<p>new typing</p>");
    expect(history.redo(a.id)?.strokes).toHaveLength(0);
    expect(history.canUndo(b.id)).toBe(true);
    history.undo(a.id);
    history.record(a.id, first, { ...first, stickers: [{ id: crypto.randomUUID(), kind: "calculator", x: .5, y: .5, scale: .1, color: "#112233" }] });
    expect(history.canRedo(a.id)).toBe(false);
    history.clear(); expect(history.canUndo(b.id)).toBe(false);
  });
});
