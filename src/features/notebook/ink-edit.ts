import { MAX_NOTEBOOK_BYTES, type InkStroke } from "./model";
import { inkWorldPoint, visibleRanges } from "./ink-segments";
import type { Point } from "./ink";

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
/** Preflight duplicated capture data before allocating/serializing fragments. */
export function splitInk(strokes: InkStroke[], ids: Set<string>, extraBytes = MAX_NOTEBOOK_BYTES): { strokes: InkStroke[]; created: string[] } {
  const plans = strokes.map((stroke) => ids.has(stroke.id) ? visibleRanges(stroke) : []);
  const count = strokes.length + plans.reduce((sum, parts) => sum + Math.max(0, parts.length - 1), 0);
  if (count > 350) throw new Error("الفصل يتجاوز حد 350 ضربة في الصفحة. اختر ضربات أقل أو أضف صفحة.");
  let added = 0;
  plans.forEach((parts, i) => {
    if (parts.length < 2) return;
    const base = { ...strokes[i], cuts: undefined, span: undefined, paintGroup: strokes[i].paintGroup ?? strokes[i].id };
    // UUID lengths are fixed; 100 bytes covers the new span and delimiters.
    added += (bytes(base) + 100) * parts.length - bytes(strokes[i]);
  });
  if (!Number.isFinite(extraBytes) || extraBytes < 0 || added > extraBytes) throw new Error("لا توجد مساحة آمنة لفصل هذه الضربة مع حفظ عينات أصلها. اختر جزءًا أصغر أو دفترًا آخر.");
  const created: string[] = [];
  const result = strokes.flatMap((stroke, i) => plans[i].length < 2 ? [stroke] : plans[i].map((span) => {
    const id = crypto.randomUUID(); created.push(id);
    return { ...stroke, id, span, cuts: undefined, paintGroup: stroke.paintGroup ?? stroke.id };
  }));
  return { strokes: created.length ? result : strokes, created };
}

/** Raw capture, pressure and time remain unchanged; only editing geometry moves. */
export function editInkPoint(stroke: InkStroke, index: number, position: Point): InkStroke {
  if (!Number.isInteger(index) || index < 0 || index >= stroke.points.length || !position.every(Number.isFinite))
    throw new Error("نقطة المسار غير صالحة.");
  const [x, y] = inkWorldPoint(stroke, index);
  const target = position.map((n) => Math.max(-10000, Math.min(10000, n))) as Point;
  if (Math.abs(target[0] - x) < 1e-7 && Math.abs(target[1] - y) < 1e-7) return stroke;
  const points = (stroke.controlPoints ?? stroke.points).slice();
  points[index] = [target[0] - (stroke.offset?.[0] ?? 0), target[1] - (stroke.offset?.[1] ?? 0)];
  return { ...stroke, controlPoints: points };
}
export function resetInkGeometry(stroke: InkStroke): InkStroke {
  return !stroke.controlPoints && !stroke.offset ? stroke : { ...stroke, controlPoints: undefined, offset: undefined };
}

/** Include the original vertices that contribute to each visible curve piece. */
export function editableInkNodes(stroke: InkStroke): number[] {
  const n = stroke.points.length;
  if (n === 1) return [0];
  const indices = new Set<number>();
  for (const [start, end] of visibleRanges(stroke)) {
    const first = Math.floor(start * (n - 1) + 1e-9), last = Math.ceil(end * (n - 1) - 1e-9) - 1;
    for (let segment = first; segment <= last; segment++) {
      indices.add(segment); indices.add(segment + 1);
      if (stroke.smoothing !== false && n > 2 && segment < n - 2) indices.add(segment + 2);
    }
  }
  return [...indices].filter((i) => i >= 0 && i < n).sort((a, b) => a - b);
}
export function nearestInkNode(stroke: InkStroke, position: Point, aspect: number): number {
  let best = -1, distance = Infinity;
  for (const i of editableInkNodes(stroke)) {
    const [x, y] = inkWorldPoint(stroke, i), d = Math.hypot(x - position[0], (y - position[1]) * aspect);
    if (d < distance) { best = i; distance = d; }
  }
  return best;
}
