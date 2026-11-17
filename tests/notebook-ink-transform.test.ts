import { describe, expect, test } from "bun:test";
import { createPage, validateNotebook, serializeNotebook, parseNotebook, type InkStroke } from "../src/features/notebook/model";
import { transformInk, previewInkTransform, inkTransformFrame } from "../src/features/notebook/ink-transform";
import { inkWorldPoints, inkWorldPoint, visibleInkRuns, visibleRanges, eraseInkSegments } from "../src/features/notebook/ink-segments";
import { insertInkPoint, editInkPoint, resetInkGeometry, splitInk } from "../src/features/notebook/ink-edit";
import { inkShape, hitStroke, InkHistory, moveInk } from "../src/features/notebook/ink";
import { recognitionInput } from "../src/features/notebook/handwriting";

const line = (): InkStroke => ({ id: crypto.randomUUID(), tool: "pen", color: "#244668", width: 8,
  points: [[300, 500], [700, 500]], pressures: [.3, .8], times: [100, 200], smoothing: false });
const check = (strokes: InkStroke[]) => validateNotebook({ version: 1, pages: [{ ...createPage(), strokes }] });

describe("physical-page ink scale and rotation", () => {
  test("rotation preserves physical distances on portrait, landscape and square sheets", () => {
    for (const aspect of [1, 297 / 210, 210 / 297]) {
      const source = line(), next = transformInk([source], new Set([source.id]), { scale: 1, rotation: 90 }, aspect)[0];
      const [a, b] = inkWorldPoints(next);
      expect(a[0]).toBeCloseTo(500, 10); expect(b[0]).toBeCloseTo(500, 10);
      expect(a[1]).toBeCloseTo(500 - 200 / aspect, 10); expect(b[1]).toBeCloseTo(500 + 200 / aspect, 10);
      expect(Math.hypot(b[0] - a[0], (b[1] - a[1]) * aspect)).toBeCloseTo(400, 10);
      expect(next.width).toBe(source.width); check([next]);
    }
  });
  test("uniform scale retains original pressure and times without resampling the source", () => {
    const source = line(), snapshot = structuredClone(source);
    const next = transformInk([source], new Set([source.id]), { scale: .5, rotation: 0 })[0];
    expect(inkWorldPoints(next)).toEqual([[400, 500], [600, 500]]);
    expect(next.points).toBe(source.points); expect(next.pressures).toBe(source.pressures); expect(next.times).toBe(source.times);
    expect(next.width).toBe(source.width); expect(source).toEqual(snapshot);
    const beforeRadii = visibleInkRuns(source)[0].map((p) => p.r), afterRadii = visibleInkRuns(next)[0].map((p) => p.r);
    expect(afterRadii).toEqual(beforeRadii); check([next]);
  });
  test("selected strokes rotate around a common center; unselected identities and layers stay intact", () => {
    const a = { ...line(), points: [[200, 400], [300, 400]] as [number, number][] };
    const b = { ...line(), points: [[700, 600], [800, 600]] as [number, number][] }, other = line();
    const source = [a, other, b], result = transformInk(source, new Set([a.id, b.id]), { scale: .5, rotation: 90 }, 1.4);
    expect(result[1]).toBe(other); expect(result.map((s) => s.id)).toEqual(source.map((s) => s.id));
    expect(inkWorldPoint(result[0], 0)[0]).toBeCloseTo(570, 10);
    expect(inkWorldPoint(result[0], 0)[1]).toBeCloseTo(500 - 150 / 1.4, 10);
    expect(inkWorldPoint(result[2], 1)[0]).toBeCloseTo(430, 10);
    expect(inkWorldPoint(result[2], 1)[1]).toBeCloseTo(500 + 150 / 1.4, 10); check(result);
  });
  test("the pivot follows exact visible quadratic bounds rather than hidden controls", () => {
    const source = { ...line(), points: [[300, 300], [500, 700], [700, 300]] as [number, number][],
      pressures: undefined, times: [1, 2, 3], smoothing: true };
    const frame = inkTransformFrame([source], new Set([source.id]))!;
    expect(frame.x).toBe(300); expect(frame.y).toBe(300); expect(frame.width).toBe(400);
    expect(frame.height).toBeCloseTo(266.6666666667, 8);
    const clipped = { ...source, span: [0, .25] as [number, number] };
    expect(inkTransformFrame([clipped], new Set([source.id]))).toEqual({ x: 300, y: 300, width: 175, height: 250 });
    const turned = transformInk([clipped], new Set([source.id]), { scale: 1, rotation: 90 })[0];
    expect(inkWorldPoint(turned, 0)).toEqual([512.5, 337.5]); check([turned]);
  });
  test("cut gaps rotate with their stroke and hit testing never reconnects them", () => {
    for (const aspect of [1, 1.4, .7]) {
      const source = { ...line(), cuts: [[.45, .55]] as [number, number][] };
      const next = transformInk([source], new Set([source.id]), { scale: 1, rotation: 90 }, aspect)[0];
      expect(next.cuts).toBe(source.cuts); expect(visibleRanges(next)).toEqual([[0, .45], [.55, 1]]);
      expect(hitStroke(next, [500, 500], [500, 500], 1, aspect)).toBe(false);
      expect(hitStroke(next, [500, 500 - 100 / aspect], [500, 500 - 100 / aspect], 1, aspect)).toBe(true);
      expect(hitStroke(next, [400, 500], [400, 500], 1, aspect)).toBe(false);
      expect((inkShape(next, aspect).d.match(/M /g) ?? []).length).toBe(2); check([next]);
    }
  });
  test("split fragments transform exactly like their shared cut source", () => {
    for (const aspect of [1, 1.4, .7]) for (const pressured of [false, true]) {
      const source = { ...line(), pressures: pressured ? [.3, .8] : undefined, cuts: [[.45, .55]] as [number, number][] };
      const parts = splitInk([source], new Set([source.id])).strokes;
      const whole = transformInk([source], new Set([source.id]), { scale: .75, rotation: 35 }, aspect)[0];
      const transformed = transformInk(parts, new Set(parts.map((s) => s.id)), { scale: .75, rotation: 35 }, aspect);
      expect(transformed.map((s) => inkShape(s, aspect).d).join(" ")).toBe(inkShape(whole, aspect).d);
      expect(transformed.every((s) => s.paintGroup === source.id)).toBe(true); check(transformed);
    }
  });
  test("existing offset, edited nodes and irregular knots survive a transform and further editing", () => {
    const raw = line(), inserted = editInkPoint(insertInkPoint(raw, 0), 1, [500, 550]);
    const source = moveInk([inserted], new Set([raw.id]), 20, 20)[0];
    const next = transformInk([source], new Set([raw.id]), { scale: .75, rotation: -30 }, 1.4)[0];
    expect(next.controlKnots).toBe(source.controlKnots); expect(next.offset).toBeUndefined();
    expect(next.points).toBe(raw.points); expect(next.times).toBe(raw.times);
    const p = inkWorldPoint(next, 1), edited = editInkPoint(next, 1, [p[0] + 1, p[1] + 1]);
    expect(inkWorldPoint(edited, 1)).toEqual([p[0] + 1, p[1] + 1]);
    expect(inkShape(resetInkGeometry(edited)).d).toBe(inkShape(raw).d); check([edited]);
  });
  test("the eraser targets the transformed position and can remove the entire transformed line", () => {
    const source = line(), next = transformInk([source], new Set([source.id]), { scale: 1, rotation: 90 });
    expect(eraseInkSegments(next, [350, 450], [350, 550], 5)).toBe(next);
    const erased = eraseInkSegments(next, [500, 250], [500, 750], 10);
    expect(erased).toHaveLength(0); expect(source.points).toEqual([[300, 500], [700, 500]]);
  });
  test("page overflow and round-tip overflow reject the complete group without mutation", () => {
    const source = line(), snapshot = structuredClone(source);
    expect(() => transformInk([source], new Set([source.id]), { scale: 4, rotation: 0 })).toThrow("خارج الورقة");
    const edge = { ...line(), pressures: undefined, width: 40, points: [[960, 500], [980, 500]] as [number, number][] };
    expect(() => transformInk([edge], new Set([edge.id]), { scale: 2, rotation: 0 })).toThrow("خارج الورقة");
    const safe = { ...line(), points: [[400, 400], [600, 400]] as [number, number][] };
    expect(() => transformInk([safe, edge], new Set([safe.id, edge.id]), { scale: 4, rotation: 0 })).toThrow();
    expect(source).toEqual(snapshot); check([edge]);
  });
  test("hidden controls and byte budgets are bounded before accepting a preview", () => {
    const source = { ...line(), controlPoints: [[300, 500], [9500, 500]] as [number, number][], span: [0, .01] as [number, number] };
    check([source]);
    expect(() => transformInk([source], new Set([source.id]), { scale: 4, rotation: 0 })).toThrow("المخفية");
    const raw = line(); expect(() => transformInk([raw], new Set([raw.id]), { scale: .75, rotation: 30 }, 1, 0)).toThrow("حجم الدفتر");
    const preview = previewInkTransform([raw], new Set([raw.id]), { scale: 4, rotation: 0 });
    expect(preview.strokes).toBe(preview.source); expect(preview.changed).toBe(false); expect(preview.error).not.toBe("");
  });
  test("neutral transforms preserve references, and a lone dot cannot be resized with fixed line width", () => {
    const source = [line()], ids = new Set([source[0].id]);
    expect(transformInk(source, ids, { scale: 1, rotation: 0 })).toBe(source);
    const dot = { ...line(), points: [[500, 500]] as [number, number][], pressures: [.5], times: [1] }, dots = [dot];
    expect(transformInk(dots, new Set([dot.id]), { scale: 2, rotation: 45 })).toBe(dots);
  });
  test("invalid parameters or empty selection do not create geometry", () => {
    const source = line(), ids = new Set([source.id]);
    for (const options of [{ scale: NaN, rotation: 0 }, { scale: .1, rotation: 0 }, { scale: 5, rotation: 0 },
      { scale: 1, rotation: Infinity }, { scale: 1, rotation: 181 }])
      expect(() => transformInk([source], ids, options)).toThrow();
    for (const aspect of [0, -1, NaN]) expect(() => transformInk([source], ids, { scale: .75, rotation: 20 }, aspect)).toThrow();
    expect(() => transformInk([source], new Set(), { scale: .75, rotation: 20 })).toThrow("ظاهرًا");
  });
  test("persisted transform renders identically after reload and recognition uses derived untimed geometry", () => {
    const source = { ...line(), cuts: [[.45, .55]] as [number, number][] };
    const strokes = transformInk([source], new Set([source.id]), { scale: .75, rotation: 30 }, 297 / 210);
    const notebook = { version: 1 as const, pages: [{ ...createPage(), strokes }] };
    const read = parseNotebook(serializeNotebook(notebook))!;
    expect(inkShape(read.pages[0].strokes[0], 297 / 210)).toEqual(inkShape(strokes[0], 297 / 210));
    const input = recognitionInput(read.pages[0], new Set());
    expect(input.strokes).toHaveLength(2); expect(input.strokes.every((s) => s.times === undefined)).toBe(true);
    expect(read.pages[0].strokes[0].times).toEqual(source.times);
    expect(inkShape(resetInkGeometry(read.pages[0].strokes[0])).d).toBe(inkShape(source).d);
  });
  test("one group transform is one visual undo step and keeps newer keyboard text", () => {
    const a = line(), b = { ...line(), points: [[300, 600], [700, 600]] as [number, number][] };
    const page = { ...createPage(), strokes: [a, b] }, history = new InkHistory();
    const preview = previewInkTransform(page.strokes, new Set([a.id, b.id]), { scale: .75, rotation: 25 });
    const applied = { ...page, strokes: preview.strokes }; history.record(page.id, page, applied);
    expect(history.undo(page.id)?.strokes).toEqual(page.strokes);
    expect({ ...page, html: "<p>نص أحدث</p>", ...history.redo(page.id) }).toMatchObject({ html: "<p>نص أحدث</p>", strokes: applied.strokes });
  });
});
