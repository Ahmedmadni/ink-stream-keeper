import { MAX_NOTEBOOK_BYTES, type InkStroke } from "./model";
import { inkWorldPoint, inkPoints, inkKnots, visibleRanges } from "./ink-segments";
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
  if (!Number.isInteger(index) || index < 0 || index >= inkPoints(stroke).length || !position.every(Number.isFinite))
    throw new Error("نقطة المسار غير صالحة.");
  const [x, y] = inkWorldPoint(stroke, index);
  const target = position.map((n) => Math.max(-10000, Math.min(10000, n))) as Point;
  if (Math.abs(target[0] - x) < 1e-7 && Math.abs(target[1] - y) < 1e-7) return stroke;
  const points = inkPoints(stroke).slice();
  points[index] = [target[0] - (stroke.offset?.[0] ?? 0), target[1] - (stroke.offset?.[1] ?? 0)];
  return { ...stroke, controlPoints: points };
}
export function resetInkGeometry(stroke: InkStroke): InkStroke {
  return !stroke.controlPoints && !stroke.offset ? stroke : { ...stroke, controlPoints: undefined, controlKnots: undefined, offset: undefined };
}

/** Inserting a control-polygon midpoint keeps a straight centerline straight.
 * Smoothing can change neighboring curves; the UI states this explicitly.
 * Ordered knots keep all existing eraser intervals in their original domain. */
export function canInsertInkPoint(stroke: InkStroke, after: number): boolean {
  const points = inkPoints(stroke), knots = inkKnots(stroke);
  return points.length < 4000 && Number.isInteger(after) && after >= 0 && after < points.length - 1 &&
    knots[after + 1] - knots[after] > 2.00001e-8;
}
export function insertInkPoint(stroke: InkStroke, after: number): InkStroke {
  if (inkPoints(stroke).length >= 4000) throw new Error("وصل المسار إلى حد 4000 نقطة تحكم. احذف نقطة أو ابدأ مسارًا جديدًا.");
  if (!canInsertInkPoint(stroke, after)) throw new Error("اختر نقطتين متتاليتين بتباعد كافٍ لإضافة نقطة بينهما.");
  const points = inkPoints(stroke), knots = inkKnots(stroke), a = points[after], b = points[after + 1];
  return { ...stroke,
    controlPoints: [...points.slice(0, after + 1), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Point, ...points.slice(after + 1)],
    controlKnots: [...knots.slice(0, after + 1), (knots[after] + knots[after + 1]) / 2, ...knots.slice(after + 1)],
  };
}
export function deleteInkPoint(stroke: InkStroke, index: number): InkStroke {
  const points = inkPoints(stroke);
  if (!Number.isInteger(index) || index < 0 || index >= points.length) throw new Error("نقطة المسار غير صالحة.");
  if (points.length <= 2) throw new Error("يحتاج المسار نقطتين على الأقل. يمكنك حذف الضربة كاملة من أدوات التحديد.");
  const next = { ...stroke, controlPoints: points.filter((_, i) => i !== index),
    controlKnots: inkKnots(stroke).filter((_, i) => i !== index) };
  if (!visibleRanges(next).length) throw new Error("حذف هذه النقطة يخفي الجزء المحدد كله. احذف الجزء من أدوات التحديد أو اختر نقطة أخرى.");
  return next;
}

/** Include the current vertices that contribute to each visible curve piece. */
export function editableInkNodes(stroke: InkStroke): number[] {
  const n = inkPoints(stroke).length, knots = inkKnots(stroke);
  if (n === 1) return [0];
  const indices = new Set<number>();
  for (const [start, end] of visibleRanges(stroke)) {
    for (let segment = 0; segment < n - 1; segment++) {
      if (knots[segment + 1] <= start + 1e-9 || knots[segment] >= end - 1e-9) continue;
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
