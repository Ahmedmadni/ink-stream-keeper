import { inkPath, type InkStroke, type NotebookPage } from "./model";

export type Point = [number, number];
export type InkBounds = { x: number; y: number; width: number; height: number };
const f = (n: number) => Math.round(n * 1000) / 1000;

/** Widths are in page-width units. Convert y before constructing paths so pen
 * tips stay circular on portrait, landscape and square paper. Never rewrite
 * captured points when smoothing or applying pressure. */
export function inkShape(stroke: InkStroke, aspect = 1): { d: string; fill: boolean } {
  const points: Point[] = stroke.points.map(([x, y]) => [x, y * aspect]);
  if (!stroke.pressures || stroke.tool === "highlighter")
    return { d: inkPath(points, stroke.smoothing ?? true), fill: false };
  const samples = points.map(([x, y], i) => ({ x, y, r: stroke.width * (.25 + .75 * stroke.pressures![i]) / 2 }));
  // The same midpoint quadratic as inkPath, with pressure interpolated along it.
  const centers = [samples[0]];
  if (stroke.smoothing !== false && samples.length > 2) {
    let start = samples[0];
    for (let i = 1; i < samples.length - 1; i++) {
      const control = samples[i], next = samples[i + 1];
      const end = { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2, r: (control.r + next.r) / 2 };
      for (const t of [.25, .5, .75, 1]) {
        const a = (1 - t) ** 2, b = 2 * (1 - t) * t, c = t * t;
        centers.push({ x: a * start.x + b * control.x + c * end.x,
          y: a * start.y + b * control.y + c * end.y, r: a * start.r + b * control.r + c * end.r });
      }
      start = end;
    }
    centers.push(samples[samples.length - 1]);
  } else centers.push(...samples.slice(1));
  if (centers.length === 1) {
    const { x, y, r } = centers[0];
    return { d: `M ${f(x - r)} ${f(y)} a ${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0 a ${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0`, fill: true };
  }
  const left: Point[] = [], right: Point[] = [];
  centers.forEach((p, i) => {
    const before = centers[Math.max(0, i - 1)], after = centers[Math.min(centers.length - 1, i + 1)];
    const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
    const nx = -(after.y - before.y) / length, ny = (after.x - before.x) / length;
    left.push([p.x + nx * p.r, p.y + ny * p.r]);
    right.push([p.x - nx * p.r, p.y - ny * p.r]);
  });
  const str = ([x, y]: Point) => `${f(x)} ${f(y)}`;
  const first = centers[0], last = centers[centers.length - 1];
  return { d: `M ${left.map(str).join(" L ")} A ${f(last.r)} ${f(last.r)} 0 0 1 ${str(right[right.length - 1])} L ${right.reverse().map(str).join(" L ")} A ${f(first.r)} ${f(first.r)} 0 0 1 ${str(left[0])} Z`, fill: true };
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(point[0] - start[0] - t * dx, point[1] - start[1] - t * dy);
}

/** Swept eraser, including between sparse pointer events. */
export function hitStroke(stroke: InkStroke, from: Point, to: Point, radius: number, aspect = 1): boolean {
  const a: Point = [from[0], from[1] * aspect], b: Point = [to[0], to[1] * aspect];
  const points: Point[] = stroke.points.map(([x, y]) => [x, y * aspect]);
  const limit = radius + stroke.width / 2;
  for (let i = 0; i < points.length; i++) {
    const c = points[Math.max(0, i - 1)], d = points[i];
    if (Math.min(distanceToSegment(c, a, b), distanceToSegment(d, a, b),
      distanceToSegment(a, c, d), distanceToSegment(b, c, d)) <= limit) return true;
    // Intersecting segments can have all endpoints outside the brush radius.
    const cross = (p: Point, q: Point, r: Point) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return true;
  }
  return false;
}

export function inkBounds(strokes: InkStroke[]): InkBounds | null {
  if (!strokes.length) return null;
  let left = 1000, top = 1000, right = 0, bottom = 0;
  for (const stroke of strokes) for (const [x, y] of stroke.points) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function moveInk(strokes: InkStroke[], ids: Set<string>, dx: number, dy: number): InkStroke[] {
  const bounds = inkBounds(strokes.filter((s) => ids.has(s.id)));
  if (!bounds) return strokes;
  dx = Math.max(-bounds.x, Math.min(1000 - bounds.x - bounds.width, dx));
  dy = Math.max(-bounds.y, Math.min(1000 - bounds.y - bounds.height, dy));
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
    const i = this.past.findLastIndex((c) => c.pageId === pageId);
    if (i < 0) return null;
    const [change] = this.past.splice(i, 1); this.future.push(change); return change.before;
  }
  redo(pageId: string): Marks | null {
    const i = this.future.findLastIndex((c) => c.pageId === pageId);
    if (i < 0) return null;
    const [change] = this.future.splice(i, 1); this.past.push(change); return change.after;
  }
}
