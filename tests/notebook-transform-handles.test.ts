import { describe, expect, test } from "bun:test";
import { draftTransformOptions, validTransformOptions, transformDraft, normalizeInkAngle, transformFromHandle,
  nudgeTransformHandle, transformHandleLayout } from "../src/features/notebook/transform-handles";
import { previewInkTransform } from "../src/features/notebook/ink-transform";
import { inkWorldPoints, visibleRanges } from "../src/features/notebook/ink-segments";
import { createPage, parseNotebook, serializeNotebook, type InkStroke } from "../src/features/notebook/model";
import type { Point } from "../src/features/notebook/ink";

const frame = { x: 300, y: 300, width: 400, height: 400 };
const start = { scale: 1, rotation: 0 };
const line = (): InkStroke => ({ id: crypto.randomUUID(), tool: "pen", color: "#334455", width: 6, smoothing: false,
  points: [[300, 500], [700, 500]], pressures: [.3, .8], times: [100, 200], cuts: [[.45, .55]] });

describe("direct ink transform controls", () => {
  test("draft values preserve valid numeric input and reject blank or invalid fields", () => {
    expect(draftTransformOptions({ size: " 75.5 ", rotation: "-30.5" })).toEqual({ scale: .755, rotation: -30.5 });
    for (const draft of [{ size: "", rotation: "0" }, { size: "100", rotation: " " }, { size: "NaN", rotation: "0" }])
      expect(validTransformOptions(draftTransformOptions(draft))).toBe(false);
    expect(transformDraft({ scale: .751, rotation: -20.26 })).toEqual({ size: "75.1", rotation: "-20.3" });
  });
  test("size dragging follows radial distance in the physical page metric in all orientations", () => {
    for (const aspect of [1, 297 / 210, 210 / 297]) {
      const from: Point = [600, 500 + 100 / aspect], to: Point = [650, 500 + 150 / aspect];
      const next = transformFromHandle({ scale: .75, rotation: 30 }, frame, from, to, "scale", aspect);
      expect(next.scale).toBe(1.125); expect(next.rotation).toBe(30);
    }
  });
  test("clockwise rotation follows real quarter turns rather than normalized page percentages", () => {
    for (const aspect of [1, 1.4, .7]) {
      const base = { scale: .75, rotation: 30 };
      expect(transformFromHandle(base, frame, [600, 500], [500, 500 + 100 / aspect], "rotate", aspect)).toEqual({ scale: .75, rotation: 120 });
      expect(transformFromHandle(base, frame, [600, 500], [500, 500 - 100 / aspect], "rotate", aspect)).toEqual({ scale: .75, rotation: -60 });
    }
  });
  test("rotation wraps smoothly across the signed angle boundary", () => {
    const point = (angle: number): Point => [500 + 100 * Math.cos(angle * Math.PI / 180), 500 + 100 * Math.sin(angle * Math.PI / 180)];
    expect(transformFromHandle({ scale: 1, rotation: 179 }, frame, point(0), point(3), "rotate").rotation).toBe(-178);
    expect(transformFromHandle({ scale: 1, rotation: -179 }, frame, point(0), point(-3), "rotate").rotation).toBe(178);
    expect(normalizeInkAngle(540)).toBe(-180); expect(normalizeInkAngle(-540)).toBe(-180);
  });
  test("a stationary pointer never rounds or snaps an existing precise draft", () => {
    const precise = { scale: .751234, rotation: 23.4567 };
    for (const kind of ["scale", "rotate"] as const) for (const snap of [true, false])
      expect(transformFromHandle(precise, frame, [600, 600], [600, 600], kind, 1.4, snap)).toBe(precise);
    expect(transformFromHandle(precise, frame, [600, 500], [500, 500], "rotate")).toBe(precise);
  });
  test("shift snapping uses ten percentage points and fifteen degrees", () => {
    expect(transformFromHandle(start, frame, [600, 500], [636, 500], "scale", 1, true).scale).toBe(1.4);
    const point = (degrees: number): Point => [500 + Math.cos(degrees * Math.PI / 180) * 100, 500 + Math.sin(degrees * Math.PI / 180) * 100];
    expect(transformFromHandle(start, frame, [600, 500], point(22), "rotate", 1, true).rotation).toBe(15);
    expect(transformFromHandle(start, frame, [600, 500], point(23), "rotate", 1, true).rotation).toBe(30);
  });
  test("size limits prevent zero scale, reflections and unbounded growth", () => {
    expect(transformFromHandle(start, frame, [600, 500], [500, 500], "scale").scale).toBe(.25);
    expect(transformFromHandle(start, frame, [600, 500], [100000, 500], "scale").scale).toBe(4);
    expect(transformFromHandle(start, frame, [600, 500], [400, 500], "scale").scale).toBe(1);
  });
  test("keyboard controls respect slider limits and expose precise and larger steps", () => {
    expect(nudgeTransformHandle(start, "scale", "ArrowUp")).toEqual({ scale: 1.01, rotation: 0 });
    expect(nudgeTransformHandle(start, "scale", "ArrowDown", true)).toEqual({ scale: .9, rotation: 0 });
    expect(nudgeTransformHandle(start, "rotate", "ArrowLeft", true)).toEqual({ scale: 1, rotation: -15 });
    expect(nudgeTransformHandle(start, "scale", "Home")?.scale).toBe(.25); expect(nudgeTransformHandle(start, "scale", "End")?.scale).toBe(4);
    expect(nudgeTransformHandle(start, "rotate", "Home")?.rotation).toBe(-180); expect(nudgeTransformHandle(start, "rotate", "End")?.rotation).toBe(180);
    expect(nudgeTransformHandle({ scale: .25, rotation: 180 }, "scale", "ArrowLeft")?.scale).toBe(.25);
    expect(nudgeTransformHandle({ scale: 4, rotation: 180 }, "rotate", "ArrowRight")?.rotation).toBe(-179);
    expect(nudgeTransformHandle(start, "rotate", "a")).toBeNull();
  });
  test("handle targets stay inset on all aspect ratios and zoom factors", () => {
    for (const aspect of [1, 1.4, .7]) for (const u of [.5, 1, 3]) {
      const layout = transformHandleLayout({ x: 300, y: 300, width: 400, height: 200 }, { scale: .75, rotation: 0 }, aspect, u);
      for (const [x, y] of [...layout.corners, layout.rotation]) {
        expect(x).toBeGreaterThanOrEqual(24 * u); expect(x).toBeLessThanOrEqual(1000 - 24 * u);
        expect(y).toBeGreaterThanOrEqual(24 * u); expect(y).toBeLessThanOrEqual(1000 * aspect - 24 * u);
      }
      for (const corner of layout.corners) expect(Math.hypot(corner[0] - layout.rotation[0], corner[1] - layout.rotation[1])).toBeGreaterThanOrEqual(44 * u);
    }
  });
  test("near the upper paper edge, the rotation target chooses an inward position", () => {
    const layout = transformHandleLayout({ x: 300, y: 5, width: 400, height: 0 }, start, 1.4, 2);
    expect(layout.rotation[1]).toBeGreaterThan(layout.center[1]);
    expect(layout.rotation[0]).toBeGreaterThanOrEqual(48); expect(layout.rotation[1]).toBeGreaterThanOrEqual(48);
  });
  test("clamped edge targets do not jump when grabbed and use their actual start radius", () => {
    const edge = { x: 5, y: 100, width: 200, height: 0 }, options = { scale: .5, rotation: 0 }, aspect = .7;
    const layout = transformHandleLayout(edge, options, aspect, 3), from: Point = [layout.corners[0][0], layout.corners[0][1] / aspect];
    expect(transformFromHandle(options, edge, from, from, "scale", aspect)).toBe(options);
    const cx = edge.x + edge.width / 2, cy = edge.y;
    const to: Point = [cx + (from[0] - cx) * 1.2, cy + (from[1] - cy) * 1.2];
    expect(transformFromHandle(options, edge, from, to, "scale", aspect).scale).toBe(.6);
  });
  test("a captured pointer can leave the sheet and recover from the unchanged baseline", () => {
    const source = line(), snapshot = structuredClone(source), f = { x: 300, y: 500, width: 400, height: 0 }, strokes = [source];
    const outside = transformFromHandle(start, f, [700, 500], [1500, 500], "scale");
    const rejected = previewInkTransform(strokes, new Set([source.id]), outside);
    expect(rejected.error).not.toBe(""); expect(rejected.strokes).toBe(strokes);
    const recovered = transformFromHandle(start, f, [700, 500], [650, 500], "scale");
    const preview = previewInkTransform(strokes, new Set([source.id]), recovered);
    expect(preview.error).toBe(""); expect(inkWorldPoints(preview.strokes[0])).toEqual([[350, 500], [650, 500]]);
    expect(source).toEqual(snapshot);
  });
  test("handle-derived transforms persist with capture and erase domains intact", () => {
    const source = line(), f = { x: 300, y: 500, width: 400, height: 0 };
    const options = transformFromHandle(start, f, [700, 500], [500, 700], "rotate");
    const preview = previewInkTransform([source], new Set([source.id]), options);
    const notebook = { version: 1 as const, pages: [{ ...createPage(), strokes: preview.strokes }] };
    const read = parseNotebook(serializeNotebook(notebook))!.pages[0].strokes[0];
    expect(inkWorldPoints(read)).toEqual([[500, 300], [500, 700]]); expect(visibleRanges(read)).toEqual([[0, .45], [.55, 1]]);
    expect(read.points).toEqual(source.points); expect(read.pressures).toEqual(source.pressures); expect(read.times).toEqual(source.times);
  });
  test("invalid frame, pointer, scale and display metrics fail without producing unsafe coordinates", () => {
    for (const aspect of [0, -1, NaN]) expect(() => transformFromHandle(start, frame, [600, 500], [650, 500], "scale", aspect)).toThrow();
    for (const to of [[Infinity, 1], [NaN, 1]] as Point[]) expect(() => transformFromHandle(start, frame, [600, 500], to, "scale")).toThrow();
    expect(() => transformFromHandle(start, frame, [500, 500], [600, 500], "scale")).toThrow("مركز");
    expect(() => transformFromHandle({ scale: 5, rotation: 0 }, frame, [600, 500], [650, 500], "scale")).toThrow();
    expect(() => transformHandleLayout({ ...frame, width: -1 }, start, 1, 1)).toThrow();
    for (const u of [0, NaN, Infinity]) expect(() => transformHandleLayout(frame, start, 1, u)).toThrow();
    const pointFrame = transformHandleLayout({ x: 500, y: 500, width: 0, height: 0 }, start, 1.4, 2);
    expect([...pointFrame.corners, pointFrame.rotation].flat().every(Number.isFinite)).toBe(true);
  });
});
