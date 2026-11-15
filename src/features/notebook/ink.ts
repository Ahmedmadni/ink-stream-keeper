import { inkPath, type InkStroke, type NotebookPage } from "./model";
import { cutInkPath, inkOutline, visibleInkRuns } from "./ink-segments";

export type Point = [number, number];
export type ShapeTool = "line" | "rectangle" | "ellipse" | "arrow";
export function shapePoints(from: Point, to: Point, tool: ShapeTool, aspect = 1): Point[] {
  if (tool === "line") return [from, to];
  if (tool === "rectangle") return [from, [to[0], from[1]], to, [from[0], to[1]], from];
  if (tool === "ellipse") {
    const cx = (from[0] + to[0]) / 2, cy = (from[1] + to[1]) / 2;
    return Array.from({ length: 49 }, (_, i) => [cx + (to[0] - from[0]) / 2 * Math.cos(i * Math.PI / 24),
      cy + (to[1] - from[1]) / 2 * Math.sin(i * Math.PI / 24)] as Point);
  }
  const angle = Math.atan2((to[1] - from[1]) * aspect, to[0] - from[0]);
  const length = Math.min(35, Math.hypot(to[0] - from[0], (to[1] - from[1]) * aspect) / 3);
  const tip = (delta: number): Point => [to[0] - length * Math.cos(angle + delta), to[1] - length * Math.sin(angle + delta) / aspect];
  return [from, to, tip(-.55), to, tip(.55)].map(([x, y]) => [Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(1000, y))] as Point);
}
export type InkBounds = { x: number; y: number; width: number; height: number };
const f = (n: number) => Math.round(n * 1000) / 1000;

/** Widths are in page-width units. Convert y before constructing paths so pen
 * tips stay circular on portrait, landscape and square paper. Never rewrite
 * captured points when smoothing or applying pressure. */
export function inkShape(stroke: InkStroke, aspect = 1): { d: string; fill: boolean } {
  if (stroke.pressures && stroke.tool === "pen")
    return { d: visibleInkRuns(stroke, aspect).map(inkOutline).join(" "), fill: true };
  return { d: stroke.cuts?.length ? cutInkPath(stroke, aspect)
    : inkPath(stroke.points.map(([x, y]) => [x, y * aspect]), stroke.smoothing ?? true), fill: false };
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(point[0] - start[0] - t * dx, point[1] - start[1] - t * dy);
}

/** Swept eraser, including between sparse pointer events. */
export function hitStroke(stroke: InkStroke, from: Point, to: Point, radius: number, aspect = 1): boolean {
  const a: Point = [from[0], from[1] * aspect], b: Point = [to[0], to[1] * aspect];
  for (const points of visibleInkRuns(stroke, aspect)) for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)], next = points[i];
    const c: Point = [prev.x, prev.y], d: Point = [next.x, next.y];
    const limit = radius + Math.max(prev.r, next.r);
    if (Math.min(distanceToSegment(c, a, b), distanceToSegment(d, a, b),
      distanceToSegment(a, c, d), distanceToSegment(b, c, d)) <= limit) return true;
    // Intersecting segments can have all endpoints outside the brush radius.
    const cross = (p: Point, q: Point, r: Point) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return true;
  }
  return false;
}

export function inkBounds(strokes: InkStroke[], aspect = 1): InkBounds | null {
  if (!strokes.length) return null;
  let left = 1000, top = 1000, right = 0, bottom = 0;
  for (const stroke of strokes) for (const [x, y] of stroke.cuts?.length
    ? visibleInkRuns(stroke, aspect).flatMap((run) => run.map((p): Point => [p.x, p.y / aspect])) : stroke.points) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return right < left ? null : { x: left, y: top, width: right - left, height: bottom - top };
}

export function moveInk(strokes: InkStroke[], ids: Set<string>, dx: number, dy: number): InkStroke[] {
  // Even hidden captured points must stay within the serializable sheet bounds.
  const bounds = inkBounds(strokes.filter((s) => ids.has(s.id)).map((s) => ({ ...s, cuts: undefined })));
  if (!bounds) return strokes;
  dx = Math.max(-bounds.x, Math.min(1000 - bounds.x - bounds.width, dx));
  dy = Math.max(-bounds.y, Math.min(1000 - bounds.y - bounds.height, dy));
  if (dx === 0 && dy === 0) return strokes;
  return strokes.map((s) => ids.has(s.id) ? { ...s, points: s.points.map(([x, y]) => [f(x + dx), f(y + dy)] as Point) } : s);
}

type Marks = Pick<NotebookPage, "strokes" | "stickers">;
type Change = { pageId: string; before: Marks; after: Marks };
/** Bounded, in-memory visual history. Text remains under Tiptap's own undo.
 * Immutable arrays share unchanged samples; nothing is persisted in storage. */
export class InkHistory {
  private past: Change[] = [];
  private future: Change[] = [];
  clear() { this.past = []; this.future = []; }
  record(pageId: string, before: Marks, after: Marks) {
    if (before.strokes === after.strokes && before.stickers === after.stickers) return;
    this.past.push({ pageId, before: { strokes: before.strokes, stickers: before.stickers }, after: { strokes: after.strokes, stickers: after.stickers } });
    this.past = this.past.slice(-48);
    this.future = [];
  }
  canUndo(pageId: string) { return this.past.some((c) => c.pageId === pageId); }
  canRedo(pageId: string) { return this.future.some((c) => c.pageId === pageId); }
  undo(pageId: string): Marks | null {
    let i = this.past.length - 1;
    while (i >= 0 && this.past[i].pageId !== pageId) i--;
    if (i < 0) return null;
    const [change] = this.past.splice(i, 1); this.future.push(change); return change.before;
  }
  redo(pageId: string): Marks | null {
    let i = this.future.length - 1;
    while (i >= 0 && this.future[i].pageId !== pageId) i--;
    if (i < 0) return null;
    const [change] = this.future.splice(i, 1); this.past.push(change); return change.after;
  }
}
