import { describe, expect, test } from "bun:test";
import { createPage, parseNotebook, serializeNotebook, validateNotebook, type InkStroke } from "../src/features/notebook/model";
import { eraseInkSegments, visibleInkRuns } from "../src/features/notebook/ink-segments";
import { hitStroke, inkBounds, inkShape, InkHistory, moveInk } from "../src/features/notebook/ink";
import { recognitionInput } from "../src/features/notebook/handwriting";

function line(): InkStroke {
  return { id: crypto.randomUUID(), tool: "pen", points: [[100, 500], [900, 500]], width: 4,
    color: "#102030", times: [1000, 2000], smoothing: false };
}
const split = (stroke = line()) => eraseInkSegments([stroke], [500, 400], [500, 600], 10, 1.414)[0];

describe("non-destructive ink segment eraser", () => {
  test("cuts a middle section, retaining capture arrays, identity and undo source", () => {
    const original = line(), snapshot = structuredClone(original), result = split(original);
    expect(original).toEqual(snapshot);
    expect(result.id).toBe(original.id);
    expect(result.points).toBe(original.points);
    expect(result.times).toBe(original.times);
    expect(result.cuts).toHaveLength(1);
    expect(result.cuts![0][0]).toBeCloseTo(.485, 7);
    expect(result.cuts![0][1]).toBeCloseTo(.515, 7);
    expect(inkShape(result, 1.414).d).toBe("M 100 707 L 488 707 M 512 707 L 900 707");
    expect(hitStroke(result, [500, 500], [500, 500], 1, 1.414)).toBe(false);
    expect(hitStroke(result, [300, 500], [300, 500], 1, 1.414)).toBe(true);
    const unchanged = [result];
    expect(eraseInkSegments(unchanged, [500, 400], [500, 600], 10, 1.414)).toBe(unchanged);
  });
  test("sparse crossing gestures are swept in physical sheet geometry in both orientations", () => {
    for (const aspect of [297 / 210, 210 / 297, 1]) {
      const stroke = { ...line(), points: [[500, 100], [500, 900]] as [number, number][] };
      const cut = eraseInkSegments([stroke], [0, 500], [1000, 500], 10, aspect)[0];
      expect(cut.cuts![0][0]).toBeCloseTo((400 - 12 / aspect) / 800, 7);
      expect(cut.cuts![0][1]).toBeCloseTo((400 + 12 / aspect) / 800, 7);
      expect(hitStroke(cut, [500, 500], [500, 500], 1, aspect)).toBe(false);
    }
  });
  test("misses retain references, dots disappear, and full coverage removes a path", () => {
    const stroke = line(), input = [stroke];
    expect(eraseInkSegments(input, [100, 100], [900, 100], 10)).toBe(input);
    expect(eraseInkSegments(input, [0, 500], [1000, 500], 10)).toHaveLength(0);
    const dot = { ...stroke, points: [[500, 500]] as [number, number][], pressures: [.1], times: [1000] };
    expect(eraseInkSegments([dot], [495, 500], [505, 500], 2)).toHaveLength(0);
    expect(eraseInkSegments([dot], [495, 510], [505, 510], 2)[0]).toBe(dot);
  });
  test("hits the visible smoothed curve instead of its unpainted control polygon", () => {
    const curve = { ...line(), points: [[100, 100], [500, 900], [900, 100]] as [number, number][],
      times: [1, 2, 3], smoothing: true };
    expect(hitStroke(curve, [500, 900], [500, 900], 3)).toBe(false);
    expect(hitStroke(curve, [450, 600], [450, 600], 3)).toBe(true);
    const cut = eraseInkSegments([curve], [440, 600], [460, 600], 8)[0];
    expect(cut.points).toBe(curve.points);
    expect(inkShape(cut).d.match(/M /g)).toHaveLength(2);
    expect(inkShape(cut).d).toContain(" Q ");
    expect(hitStroke(cut, [450, 600], [450, 600], .1)).toBe(false);
  });
  test("pressure survives cutting, rendering, serialization and movement", () => {
    const original = { ...line(), pressures: [.1, 1] }, result = split(original);
    expect(result.pressures).toBe(original.pressures);
    expect(inkShape(result, 1.414).fill).toBe(true);
    expect(inkShape(result, 1.414).d.match(/M /g)).toHaveLength(2);
    expect(inkShape(result, .707).d).not.toMatch(/NaN|Infinity|undefined/);
    const page = { ...createPage(), strokes: [result] };
    expect(parseNotebook(serializeNotebook({ version: 1, pages: [page] }))?.pages[0].strokes[0]).toEqual(result);
    const moved = moveInk([result], new Set([result.id]), 20, 30)[0];
    expect(moved.cuts).toBe(result.cuts);
    expect(moved.times).toBe(original.times);
    expect(moved.pressures).toBe(original.pressures);
    expect(inkShape(moved, 1.414).d).not.toBe(inkShape(result, 1.414).d);
    expect(visibleInkRuns(result, 1.414)).toHaveLength(2);
  });
  test("repeated and overlapping erases merge cuts; untouched ink is not resampled", () => {
    let result = split(); const points = result.points;
    result = eraseInkSegments([result], [505, 400], [505, 600], 10, 1.414)[0];
    expect(result.cuts).toHaveLength(1);
    result = eraseInkSegments([result], [700, 400], [700, 600], 10, 1.414)[0];
    expect(result.cuts).toHaveLength(2);
    expect(result.points).toBe(points);
    expect(inkShape(result, 1.414).d.match(/M /g)).toHaveLength(3);
  });
  test("selection bounds exclude erased ends while movement keeps hidden capture points valid", () => {
    const cut: InkStroke = { ...line(), cuts: [[.3, 1]] };
    expect(inkBounds([cut])).toEqual({ x: 100, y: 500, width: 240, height: 0 });
    const moved = moveInk([cut], new Set([cut.id]), 1000, 0)[0];
    expect(moved.points).toEqual([[200, 500], [1000, 500]]);
    expect(() => validateNotebook({ version: 1, pages: [{ ...createPage(), strokes: [moved] }] })).not.toThrow();
  });
  test("one gesture undoes all cuts without reverting later keyboard text", () => {
    const page = { ...createPage(), strokes: [line()] }, history = new InkHistory();
    let after = { ...page, strokes: [split(page.strokes[0])] };
    after = { ...after, strokes: eraseInkSegments(after.strokes, [700, 400], [700, 600], 10, 1.414) };
    history.record(page.id, page, after);
    expect({ ...after, html: "<p>new</p>", ...history.undo(page.id) }.html).toBe("<p>new</p>");
    expect(history.canUndo(page.id)).toBe(false);
    expect(history.redo(page.id)?.strokes).toEqual(after.strokes);
    expect(inkShape(history.undo(page.id)!.strokes[0]).d).toBe(inkShape(page.strokes[0]).d);
  });
  test("recognition excludes erased geometry and does not invent capture times at new boundaries", () => {
    const cut = split(), intact = { ...line(), id: crypto.randomUUID() };
    const input = recognitionInput({ ...createPage(), strokes: [cut, intact] }, new Set());
    expect(input.strokes).toHaveLength(3);
    expect(input.strokes[0].times).toBeUndefined();
    expect(input.strokes[1].times).toBeUndefined();
    expect(input.strokes[0].points.every(([x]) => x <= 488)).toBe(true);
    expect(input.strokes[1].points.every(([x]) => x >= 512)).toBe(true);
    expect(input.strokes[2].points).toBe(intact.points);
    expect(input.strokes[2].times).toBe(intact.times);
  });
  test("rejects malformed/overlapping cuts and rolls back when the cut budget is exceeded", () => {
    for (const cuts of [[[.6, .4]], [[-.1, .2]], [[.2, .5], [.4, .7]], [[.2, .2]], [[0, NaN]], [[.6, .7], [.2, .3]]]) {
      expect(() => validateNotebook({ version: 1, pages: [{ ...createPage(), strokes: [{ ...line(), cuts }] }] })).toThrow();
    }
    const cuts = Array.from({ length: 128 }, (_, i): [number, number] => [(2 * i + 1) / 300, (2 * i + 2) / 300]);
    const original = { ...line(), cuts }, before = structuredClone(original);
    expect(() => eraseInkSegments([original], [860, 400], [860, 600], 1)).toThrow("128");
    expect(original).toEqual(before);
    expect(() => eraseInkSegments([line()], [NaN, 0], [1, 1], 10)).toThrow();
  });
});
