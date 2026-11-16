import { describe, expect, test } from "bun:test";
import { createPage, validateNotebook, serializeNotebook, parseNotebook, type InkStroke } from "../src/features/notebook/model";
import { inkShape, inkBounds, moveInk, hitStroke, InkHistory } from "../src/features/notebook/ink";
import { splitInk, editInkPoint, resetInkGeometry, editableInkNodes, nearestInkNode } from "../src/features/notebook/ink-edit";
import { eraseInkSegments, inkWorldPoint, visibleRanges, visibleInkBounds } from "../src/features/notebook/ink-segments";
import { recognitionInput } from "../src/features/notebook/handwriting";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InkPointOverlay } from "../src/features/notebook/InkPoints";

const line = (): InkStroke => ({ id: crypto.randomUUID(), tool: "pen", points: [[100, 500], [900, 500]],
  pressures: [.2, .9], times: [1000, 2000], width: 4, color: "#123456", smoothing: false });
const cut = () => ({ ...line(), cuts: [[.45, .55]] as [number, number][] });
const check = (strokes: InkStroke[]) => validateNotebook({ version: 1, pages: [{ ...createPage(), strokes }] });

describe("independent ink fragments and control point edits", () => {
  test("split preserves exact curve paths, pressure and original capture in every orientation", () => {
    for (const aspect of [1, 297 / 210, 210 / 297]) for (const pressured of [true, false]) {
      const source = { ...cut(), points: [[100, 100], [500, 900], [900, 100]] as [number, number][],
        pressures: pressured ? [.2, .6, 1] : undefined, times: [1, 2, 3], smoothing: true };
      const before = structuredClone(source), result = splitInk([source], new Set([source.id]));
      expect(result.strokes).toHaveLength(2);
      expect(new Set(result.created).size).toBe(2);
      expect(inkShape(source, aspect).d).toBe(result.strokes.map((s) => inkShape(s, aspect).d).join(" "));
      for (const piece of result.strokes) {
        expect(piece.id).not.toBe(source.id); expect(piece.points).toBe(source.points);
        expect(piece.pressures).toBe(source.pressures); expect(piece.times).toBe(source.times);
        expect(piece.paintGroup).toBe(source.id); expect(piece.cuts).toBeUndefined();
      }
      expect(source).toEqual(before); check(result.strokes);
    }
  });
  test("a fragment moves to the page edge independently of its hidden source points", () => {
    const source = cut(), pieces = splitInk([source], new Set([source.id])).strokes;
    const second = inkShape(pieces[1]).d;
    const moved = moveInk(pieces, new Set([pieces[0].id]), 1000, 0);
    expect(inkBounds([moved[0]])).toEqual({ x: 640, y: 500, width: 360, height: 0 });
    expect(inkWorldPoint(moved[0], 1)[0]).toBeGreaterThan(1000);
    expect(moved[0].points).toBe(source.points);
    expect(moved[1]).toBe(pieces[1]); expect(inkShape(moved[1]).d).toBe(second); check(moved);
    expect(hitStroke(moved[0], [800, 500], [800, 500], 2)).toBe(true);
    expect(hitStroke(moved[0], [200, 500], [200, 500], 2)).toBe(false);
  });
  test("further erasing respects the fragment window and fully erased pieces disappear", () => {
    const source = cut(), pieces = splitInk([source], new Set([source.id])).strokes;
    const moved = moveInk([pieces[0]], new Set([pieces[0].id]), 300, 0);
    const erased = eraseInkSegments(moved, [0, 500], [1000, 500], 30);
    expect(erased).toHaveLength(0);
    expect(pieces[1].points).toBe(source.points);
    expect(eraseInkSegments(pieces, [700, 450], [700, 550], 8)[1].span).toEqual(pieces[1].span);
  });
  test("count and size preflight failures preserve all source data", () => {
    const source = cut(), before = structuredClone(source);
    expect(() => splitInk([source], new Set([source.id]), 0)).toThrow("مساحة");
    expect(() => splitInk([source], new Set([source.id]), -1)).toThrow();
    const dense = Array.from({ length: 350 }, (_, i) => i === 0 ? source : line());
    expect(() => splitInk(dense, new Set([source.id]))).toThrow("350");
    expect(source).toEqual(before); expect(dense).toHaveLength(350);
    const untouched = [line()]; expect(splitInk(untouched, new Set()).strokes).toBe(untouched);
  });
  test("point edits retain capture/pressure/time, clamp no geometry implicitly, and restore", () => {
    const source = { ...line(), points: [[100, 400], [500, 400], [900, 400]] as [number, number][],
      pressures: [.2, .5, 1], times: [1, 2, 3] };
    const snapshot = structuredClone(source), edited = editInkPoint(source, 1, [500, 600]);
    expect(source).toEqual(snapshot); expect(edited.points).toBe(source.points);
    expect(edited.pressures).toBe(source.pressures); expect(edited.times).toBe(source.times);
    expect(edited.controlPoints?.[1]).toEqual([500, 600]);
    expect(inkShape(edited).d).not.toBe(inkShape(source).d); check([edited]);
    expect(resetInkGeometry(edited).points).toBe(source.points);
    expect(inkShape(resetInkGeometry(edited)).d).toBe(inkShape(source).d);
    expect(editInkPoint(source, 1, [500, 400])).toBe(source);
    expect(() => editInkPoint(source, -1, [1, 2])).toThrow();
    expect(() => editInkPoint(source, 1, [NaN, 2])).toThrow();
  });
  test("editing a moved fragment works in page coordinates and reset preserves erased ranges", () => {
    const source = cut(), part = splitInk([source], new Set([source.id])).strokes[0];
    const moved = moveInk([part], new Set([part.id]), 300, 0)[0];
    const edited = editInkPoint(moved, 0, [450, 450]);
    expect(edited.controlPoints?.[0]).toEqual([150, 450]);
    expect(inkWorldPoint(edited, 0)).toEqual([450, 450]); check([edited]);
    const reset = resetInkGeometry(edited);
    expect(reset.span).toBe(part.span); expect(visibleRanges(reset)).toEqual([[0, .45]]);
    expect(inkShape(reset).d).toBe(inkShape(part).d);
  });
  test("exact quadratic bounds include internal extrema for movement and validation", () => {
    const curve = { ...line(), pressures: undefined, times: [1, 2, 3], smoothing: true,
      points: [[100, 100], [500, 900], [900, 100]] as [number, number][], span: [0, 1] as [number, number] };
    const bounds = visibleInkBounds(curve)!;
    expect(bounds.x).toBe(100); expect(bounds.width).toBe(800);
    expect(bounds.y + bounds.height).toBeCloseTo(633.333333, 5);
    const moved = moveInk([curve], new Set([curve.id]), 0, 1000)[0];
    expect(visibleInkBounds(moved)!.y + visibleInkBounds(moved)!.height).toBeCloseTo(1000, 7); check([moved]);
  });
  test("only contributing controls are exposed, including smoothed neighbors", () => {
    const source = { ...line(), points: [[0, 0], [200, 200], [500, 500], [900, 900]] as [number, number][],
      times: [1, 2, 3, 4], pressures: undefined, span: [.4, .5] as [number, number] };
    expect(editableInkNodes(source)).toEqual([1, 2]);
    expect(editableInkNodes({ ...source, smoothing: true })).toEqual([1, 2, 3]);
    expect(nearestInkNode(source, [205, 205], 1.4)).toBe(1);
  });
  test("recognition receives visible edited geometry without invented capture times", () => {
    const source = cut(), part = splitInk([source], new Set([source.id])).strokes[0];
    const moved = moveInk([part], new Set([part.id]), 540, 0)[0];
    const edited = editInkPoint(moved, 0, [640, 450]);
    check([edited]);
    const intact = moveInk([line()], new Set(), 10, 0)[0];
    const shifted = moveInk([intact], new Set([intact.id]), 100, 0)[0];
    const input = recognitionInput({ ...createPage(), strokes: [edited, shifted] }, new Set());
    expect(input.strokes[0].times).toBeUndefined();
    expect(input.strokes[0].points.every(([x, y]) => x >= 0 && x <= 1000 && y >= 0 && y <= 1000)).toBe(true);
    expect(input.strokes[1].points).toEqual([[200, 500], [1000, 500]]);
    expect(input.strokes[1].times).toBe(intact.times);
    expect(() => recognitionInput({ ...createPage(), strokes: [editInkPoint(moved, 0, [650, 450])] }, new Set())).toThrow("حدود");
  });
  test("all editing fields round-trip, while legacy records gain no fields", () => {
    const legacy = line(), source = cut();
    const part = splitInk([source], new Set([source.id])).strokes[0];
    const edited = editInkPoint(moveInk([part], new Set([part.id]), 30, 40)[0], 0, [140, 550]);
    const book = { version: 1 as const, pages: [{ ...createPage(), strokes: [legacy, edited] }] };
    const result = parseNotebook(serializeNotebook(book))!;
    expect(result).toEqual(book);
    expect(inkShape(resetInkGeometry(result.pages[0].strokes[1])).d).toBe(inkShape(part).d);
    expect(Object.hasOwn(result.pages[0].strokes[0], "offset")).toBe(false);
    expect(Object.hasOwn(result.pages[0].strokes[0], "controlPoints")).toBe(false);
  });
  test("invalid windows, edits and off-page output fail validation without modifying the source", () => {
    const original = line(), snapshot = structuredClone(original);
    for (const value of [
      { ...original, span: [.8, .2] }, { ...original, span: [-1, .2] },
      { ...original, offset: [Infinity, 0] }, { ...original, offset: [950, 0] },
      { ...original, controlPoints: [[1, 2]] }, { ...original, paintGroup: "bad" },
    ]) expect(() => check([value as InkStroke])).toThrow();
    expect(original).toEqual(snapshot);
  });
  test("split, move, edit and reset undo independently without reverting keyboard text", () => {
    const source = cut(), page = { ...createPage(), strokes: [source] }, history = new InkHistory();
    const parts = splitInk(page.strokes, new Set([source.id])).strokes;
    const afterSplit = { ...page, strokes: parts }; history.record(page.id, page, afterSplit);
    const moved = { ...afterSplit, strokes: moveInk(parts, new Set([parts[0].id]), 300, 0) };
    history.record(page.id, afterSplit, moved);
    const edited = { ...moved, strokes: [editInkPoint(moved.strokes[0], 0, [450, 450]), moved.strokes[1]] };
    history.record(page.id, moved, edited);
    expect(history.undo(page.id)?.strokes).toEqual(moved.strokes);
    expect(history.undo(page.id)?.strokes).toEqual(parts);
    expect(history.undo(page.id)?.strokes).toEqual([source]);
    expect({ ...page, html: "<p>new text</p>", ...history.redo(page.id) }.html).toBe("<p>new text</p>");
    expect(history.redo(page.id)?.strokes).toEqual(moved.strokes);
    expect(history.redo(page.id)?.strokes).toEqual(edited.strokes);
  });
  test("all 4000 source vertices remain addressable without rendering 4000 handles", () => {
    const source: InkStroke = { ...line(), pressures: undefined, times: undefined,
      smoothing: true, points: Array.from({ length: 4000 }, (_, i) => [100 + i * 800 / 3999, 500 + Math.sin(i) * .01]) };
    const indices = editableInkNodes(source);
    expect(indices).toHaveLength(4000); expect(indices.at(-1)).toBe(3999);
    const edited = editInkPoint(source, 3500, [802, 520]); check([edited]);
    expect(source.points[3500]).not.toEqual(edited.controlPoints![3500]);
    const html = renderToStaticMarkup(createElement(InkPointOverlay, { stroke: edited, indices, active: 3500,
      aspect: 1.4, unitsPerPixel: 2, onStart: () => {}, onKey: () => {} }));
    expect(html).toContain('data-active-ink-node="3500"');
    expect((html.match(/<circle\b/g) || []).length).toBeLessThan(50);
    const input = recognitionInput({ ...createPage(), strokes: [edited] }, new Set());
    expect(input.strokes[0].points.length).toBeLessThanOrEqual(4000);
    expect(input.strokes[0].times).toBeUndefined();
    expect(edited.points).toBe(source.points);
  });
});
