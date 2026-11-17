import { describe, expect, test } from "bun:test";
import { createPage, parseNotebook, serializeNotebook, validateNotebook, type InkStroke } from "../src/features/notebook/model";
import { inkShape, hitStroke, moveInk, InkHistory } from "../src/features/notebook/ink";
import { canInsertInkPoint, insertInkPoint, deleteInkPoint, editInkPoint, resetInkGeometry, editableInkNodes, splitInk } from "../src/features/notebook/ink-edit";
import { inkPoints, inkKnots, inkWorldPoint, visibleRanges, visibleInkRuns, eraseInkSegments } from "../src/features/notebook/ink-segments";
import { recognitionInput } from "../src/features/notebook/handwriting";

const source = (): InkStroke => ({ id: crypto.randomUUID(), tool: "pen", color: "#234567", width: 6, smoothing: false,
  points: [[100, 400], [300, 400], [500, 400], [700, 400], [900, 400]],
  pressures: [.2, .4, .8, .6, 1], times: [100, 120, 150, 190, 250] });
const check = (stroke: InkStroke) => validateNotebook({ version: 1, pages: [{ ...createPage(), strokes: [stroke] }] });

describe("reversible ink vertex insertion and deletion", () => {
  test("inserting a midpoint retains capture, curve parameters, offset and eraser data", () => {
    const original = { ...source(), offset: [10, 20] as [number, number], cuts: [[.6, .7]] as [number, number][] };
    const saved = structuredClone(original), next = insertInkPoint(original, 0);
    expect(inkPoints(next)).toHaveLength(6); expect(inkKnots(next)).toEqual([0, .125, .25, .5, .75, 1]);
    expect(inkWorldPoint(next, 1)).toEqual([210, 420]);
    expect(next.points).toBe(original.points); expect(next.pressures).toBe(original.pressures); expect(next.times).toBe(original.times);
    expect(next.cuts).toBe(original.cuts); expect(next.offset).toBe(original.offset); expect(original).toEqual(saved); check(next);
  });
  test("a straight constant-width path retains its geometry, visibility and hit testing", () => {
    for (const aspect of [1, 297 / 210, 210 / 297]) for (const smoothing of [false, true]) {
      const original = { ...source(), pressures: undefined, smoothing, cuts: [[.4, .6]] as [number, number][] };
      const next = insertInkPoint(original, 0);
      expect(visibleRanges(next)).toEqual(visibleRanges(original));
      // A smoothed curve's parameter is not its horizontal percentage.
      const originalRuns = visibleInkRuns(original, aspect), gap = (originalRuns[0].at(-1)!.x + originalRuns[1][0].x) / 2;
      for (const [x, expected] of [[150, true], [gap, false], [850, true]] as const)
        expect(hitStroke(next, [x, 400], [x, 400], 2, aspect)).toBe(expected);
      const runs = visibleInkRuns(next, aspect);
      expect(runs[0][0].x).toBe(100); expect(runs.at(-1)!.at(-1)!.x).toBe(900); check(next);
    }
  });
  test("pressure at an added vertex interpolates real samples without fabricating times", () => {
    const original = source(), next = insertInkPoint(original, 0), centers = visibleInkRuns(next)[0];
    const added = centers.find((p) => p.t === .125)!;
    expect(added.x).toBe(200); expect(added.r).toBeCloseTo(next.width * (.25 + .75 * .3) / 2, 12);
    expect(next.pressures).toHaveLength(5); expect(next.times).toHaveLength(5);
    const recognition = recognitionInput({ ...createPage(), strokes: [next] }, new Set());
    expect(recognition.strokes[0].times).toBeUndefined(); expect(recognition.strokes[0].points).toHaveLength(6);
    expect(original.points).toHaveLength(5); check(next);
  });
  test("a new vertex can move independently and removing it restores exact prior output", () => {
    for (const smoothing of [true, false]) for (const aspect of [1, 1.414, .707]) {
      const original = { ...source(), smoothing }, inserted = insertInkPoint(original, 1);
      const moved = editInkPoint(inserted, 2, [400, 520]);
      expect(inkWorldPoint(moved, 2)).toEqual([400, 520]);
      expect(inkShape(moved, aspect).d).not.toBe(inkShape(original, aspect).d);
      const removed = deleteInkPoint(moved, 2);
      expect(inkPoints(removed)).toEqual(original.points); expect(inkKnots(removed)).toEqual([0, .25, .5, .75, 1]);
      expect(inkShape(removed, aspect).d).toBe(inkShape(original, aspect).d); check(removed);
    }
  });
  test("edits near the start leave a distant smoothed fragment exactly unchanged", () => {
    const original = { ...source(), smoothing: true, span: [.8, 1] as [number, number] };
    for (const aspect of [1, 1.414, .707]) {
      const inserted = insertInkPoint(original, 0);
      expect(inkShape(inserted, aspect).d).toBe(inkShape(original, aspect).d);
      const deleted = deleteInkPoint(original, 0);
      expect(inkShape(deleted, aspect).d).toBe(inkShape(original, aspect).d);
    }
  });
  test("deleting an original interior vertex removes its bend while retaining gaps and capture", () => {
    const original = { ...source(), points: [[100, 100], [300, 900], [500, 100], [700, 900], [900, 100]] as [number, number][],
      cuts: [[.2, .3], [.6, .65]] as [number, number][] };
    const next = deleteInkPoint(original, 1);
    expect(next.points).toBe(original.points); expect(next.pressures).toBe(original.pressures); expect(next.times).toBe(original.times);
    expect(inkKnots(next)).toEqual([0, .5, .75, 1]); expect(next.cuts).toBe(original.cuts);
    expect(hitStroke(next, [300, 900], [300, 900], 2)).toBe(false);
    expect(hitStroke(next, [700, 900], [700, 900], 2)).toBe(true);
    expect(hitStroke(next, [300, 100], [300, 100], 2)).toBe(false);
    expect(hitStroke(next, [200, 100], [200, 100], 2)).toBe(true);
    const reset = resetInkGeometry(next);
    expect(inkShape(reset).d).toBe(inkShape(original).d);
    expect(hitStroke(reset, [300, 900], [300, 900], 2)).toBe(false); // Still erased.
    expect(hitStroke(reset, [200, 500], [200, 500], 2)).toBe(true); check(next);
  });
  test("endpoint deletion trims its domain without renumbering erased intervals", () => {
    const original = { ...source(), pressures: undefined, cuts: [[.4, .6]] as [number, number][] };
    const first = deleteInkPoint(original, 0), last = deleteInkPoint(original, 4);
    expect(visibleRanges(first)).toEqual([[.25, .4], [.6, 1]]);
    expect(visibleRanges(last)).toEqual([[0, .4], [.6, .75]]);
    expect(inkKnots(first)).toEqual([.25, .5, .75, 1]);
    expect(inkKnots(last)).toEqual([0, .25, .5, .75]);
    expect(hitStroke(first, [150, 400], [150, 400], 2)).toBe(false);
    expect(hitStroke(first, [500, 400], [500, 400], 2)).toBe(false);
    expect(inkShape(resetInkGeometry(first)).d).toBe(inkShape(original).d); check(first); check(last);
  });
  test("insertion, splitting, independent movement and further erasing share the same knot domain", () => {
    const original = { ...source(), cuts: [[.4, .6]] as [number, number][] };
    const inserted = insertInkPoint(original, 0), fragments = splitInk([inserted], new Set([inserted.id])).strokes;
    expect(fragments.map((s) => inkShape(s).d).join(" ")).toBe(inkShape(inserted).d);
    const sibling = inkShape(fragments[1]).d, moved = moveInk(fragments, new Set([fragments[0].id]), 100, 100);
    expect(inkShape(moved[1]).d).toBe(sibling); expect(moved[0].controlKnots).toBe(inserted.controlKnots);
    const remaining = eraseInkSegments(moved, [0, 500], [1000, 500], 30);
    expect(remaining.map((s) => s.id)).toEqual([fragments[1].id]); check(moved[0]);
  });
  test("deleting a fragment's only contributing endpoint refuses an invisible result", () => {
    const original = { ...source(), span: [0, .1] as [number, number] }, before = structuredClone(original);
    expect(() => deleteInkPoint(original, 0)).toThrow("الجزء المحدد");
    expect(original).toEqual(before);
  });
  test("selected controls follow irregular knot intervals rather than point count", () => {
    const original = { ...source(), span: [.1, .2] as [number, number] };
    const inserted = insertInkPoint(original, 0);
    expect(editableInkNodes(inserted)).toEqual([0, 1, 2]);
    expect(editableInkNodes({ ...inserted, smoothing: true })).toEqual([0, 1, 2, 3]);
    expect(editableInkNodes(deleteInkPoint({ ...source(), span: [.4, .6] }, 0))).toEqual([0, 1, 2]);
  });
  test("limits reject overfull or too-dense insertions and preserve the source", () => {
    const dense = { ...source(), times: undefined, pressures: undefined,
      points: Array.from({ length: 4000 }, (_, i) => [100 + i * .2, 400] as [number, number]) };
    expect(canInsertInkPoint(dense, 0)).toBe(false); expect(() => insertInkPoint(dense, 0)).toThrow("4000");
    let next = source(), steps = 0;
    while (canInsertInkPoint(next, 0) && steps < 100) { next = insertInkPoint(next, 0); steps++; }
    expect(steps).toBeGreaterThan(15); expect(steps).toBeLessThan(30);
    expect(() => insertInkPoint(next, 0)).toThrow("تباعد"); check(next);
    const dot = { ...source(), points: [[100, 100]] as [number, number][], pressures: [1], times: [1] };
    expect(canInsertInkPoint(dot, 0)).toBe(false); expect(() => insertInkPoint(dot, 0)).toThrow();
    const two = { ...dot, points: [[100, 100], [200, 200]] as [number, number][], pressures: [1, 1], times: [1, 2] };
    expect(() => deleteInkPoint(two, 0)).toThrow("نقطتين");
    for (const i of [-1, .5, 500, NaN]) { expect(() => insertInkPoint(source(), i)).toThrow(); expect(() => deleteInkPoint(source(), i)).toThrow(); }
  });
  test("knot metadata round-trips and reset recovers the source after reopening", () => {
    const original = { ...source(), cuts: [[.4, .6]] as [number, number][] };
    const next = editInkPoint(deleteInkPoint(insertInkPoint(original, 1), 0), 1, [450, 500]);
    const notebook = { version: 1 as const, pages: [{ ...createPage(), strokes: [next] }] };
    const read = parseNotebook(serializeNotebook(notebook))!;
    expect(read).toEqual(notebook);
    const reset = resetInkGeometry(read.pages[0].strokes[0]);
    expect(reset.controlKnots).toBeUndefined(); expect(reset.controlPoints).toBeUndefined();
    expect(inkShape(reset).d).toBe(inkShape(original).d); expect(reset.times).toEqual(original.times);
    expect(Object.hasOwn(parseNotebook(serializeNotebook({ version: 1, pages: [{ ...createPage(), strokes: [source()] }] }))!.pages[0].strokes[0], "controlKnots")).toBe(false);
  });
  test("malformed topology is rejected before geometry is read", () => {
    const original = source(), points = original.points.slice();
    for (const controlKnots of [[0, .2], [0, .2, .2, .7, 1], [0, .6, .5, .7, 1], [0, .25, NaN, .75, 1],
      [-.1, .25, .5, .75, 1], [0, .25, .5, .75, 1.1], [0, 1e-10, .5, .75, 1]])
      expect(() => check({ ...original, controlPoints: points, controlKnots })).toThrow();
    expect(() => check({ ...original, controlKnots: [0, .25, .5, .75, 1] })).toThrow();
    expect(() => check({ ...original, controlPoints: points.slice(1) })).toThrow();
    const valid = { ...original, controlPoints: points.slice(1), controlKnots: [.25, .5, .75, 1] }; check(valid);
  });
  test("each topology operation is an independent undo step without restoring older text", () => {
    const original = source(), page = { ...createPage(), strokes: [original] }, history = new InkHistory();
    const added = { ...page, strokes: [insertInkPoint(original, 1)] }; history.record(page.id, page, added);
    const removed = { ...added, strokes: [deleteInkPoint(added.strokes[0], 0)] }; history.record(page.id, added, removed);
    expect(history.undo(page.id)?.strokes).toEqual(added.strokes); expect(history.undo(page.id)?.strokes).toEqual(page.strokes);
    expect({ ...page, html: "<p>نص أحدث</p>", ...history.redo(page.id) }.html).toBe("<p>نص أحدث</p>");
    expect(history.redo(page.id)?.strokes).toEqual(removed.strokes);
  });
});
