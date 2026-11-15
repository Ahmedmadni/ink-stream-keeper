import type { InkStroke } from "./model";

type Point = [number, number];
export type InkRange = [number, number];
export type Center = { x: number; y: number; r: number; t: number };
type Segment = { a: Center; b: Center; c?: Center };
const EPS = 1e-8;
const lerp = (a: Center, b: Center, t: number): Center => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
  r: a.r + (b.r - a.r) * t, t: a.t + (b.t - a.t) * t,
});
const midpoint = (a: Center, b: Center) => lerp(a, b, .5);
const f = (n: number) => Math.round(n * 1000) / 1000;
const xy = (p: Center) => `${f(p.x)} ${f(p.y)}`;

// Cuts refer to the original rendered segment parameters, not resampled point
// indices or screen pixels. Raw captured points, pressure and time stay intact.
function segments(stroke: InkStroke, aspect: number): Segment[] {
  const count = stroke.points.length;
  const p = stroke.points.map(([x, y], i): Center => ({ x, y: y * aspect, t: i / Math.max(1, count - 1),
    r: stroke.width * (stroke.pressures && stroke.tool === "pen" ? .25 + .75 * stroke.pressures[i] : 1) / 2 }));
  if (count < 2) return [{ a: p[0], b: p[0] }];
  if (stroke.smoothing === false || count < 3) return p.slice(1).map((b, i) => ({ a: p[i], b }));
  let a = p[0]; const result: Segment[] = [];
  for (let i = 1; i < count - 1; i++) {
    const b = { ...midpoint(p[i], p[i + 1]), t: i / (count - 1) };
    result.push({ a, c: p[i], b }); a = b;
  }
  result.push({ a, b: p[count - 1] });
  return result;
}
function evaluate(s: Segment, t: number): Center {
  const p = s.c ? lerp(lerp(s.a, s.c, t), lerp(s.c, s.b, t), t) : lerp(s.a, s.b, t);
  return { ...p, t: s.a.t + (s.b.t - s.a.t) * t };
}
const cache = new WeakMap<InkStroke["points"], { pressures: InkStroke["pressures"]; width: number;
  smoothing: boolean | undefined; tool: InkStroke["tool"]; aspect: number; segments: Segment[]; samples: Center[];
  bounds: { left: number; right: number; top: number; bottom: number } }>();
function geometry(stroke: InkStroke, aspect: number) {
  const old = cache.get(stroke.points);
  if (old && old.pressures === stroke.pressures && old.width === stroke.width && old.smoothing === stroke.smoothing &&
      old.tool === stroke.tool && old.aspect === aspect) return old;
  const curves = segments(stroke, aspect), samples = [curves[0].a];
  const pressured = !!stroke.pressures && stroke.tool === "pen";
  for (const curve of curves) {
    if (!curve.c) { if (curve.a !== curve.b) samples.push(curve.b); continue; }
    // Pressure outlines retain their existing quarter-curve vertices exactly.
    // Plain SVG quadratics are sampled adaptively for hit testing only; their
    // visible paths below are clipped as exact quadratic curves.
    const bend = Math.hypot(curve.a.x - 2 * curve.c.x + curve.b.x, curve.a.y - 2 * curve.c.y + curve.b.y);
    const budget = Math.max(4, Math.min(64, Math.floor(16384 / curves.length)));
    const steps = pressured ? 4 : Math.min(budget, Math.max(2, Math.ceil(Math.sqrt(bend / .4))));
    for (let step = 1; step <= steps; step++) samples.push(evaluate(curve, step / steps));
  }
  const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  for (const [x, y] of stroke.points) {
    bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x);
    bounds.top = Math.min(bounds.top, y * aspect); bounds.bottom = Math.max(bounds.bottom, y * aspect);
  }
  const value = { pressures: stroke.pressures, width: stroke.width, smoothing: stroke.smoothing, tool: stroke.tool,
    aspect, segments: curves, samples, bounds };
  cache.set(stroke.points, value); return value;
}
export function visibleRanges(stroke: InkStroke): InkRange[] {
  const ranges: InkRange[] = []; let start = 0;
  for (const [a, b] of stroke.cuts ?? []) { if (a > start + EPS) ranges.push([start, a]); start = b; }
  if (start < 1 - EPS) ranges.push([start, 1]);
  return ranges;
}
export function visibleInkRuns(stroke: InkStroke, aspect = 1): Center[][] {
  const samples = geometry(stroke, aspect).samples;
  if (!stroke.cuts?.length) return [samples];
  if (samples.length === 1) return visibleRanges(stroke).length ? [samples] : [];
  const runs: Center[][] = [];
  for (const [start, end] of visibleRanges(stroke)) {
    const run: Center[] = [];
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i];
      const lo = Math.max(start, a.t), hi = Math.min(end, b.t);
      if (hi - lo <= EPS) continue;
      if (!run.length) run.push(lerp(a, b, (lo - a.t) / (b.t - a.t)));
      run.push(lerp(a, b, (hi - a.t) / (b.t - a.t)));
    }
    if (run.length) runs.push(run);
  }
  return runs;
}
export function cutInkPath(stroke: InkStroke, aspect = 1): string {
  const curves = geometry(stroke, aspect).segments, paths: string[] = [];
  for (const [start, end] of visibleRanges(stroke)) {
    let path = "";
    for (const curve of curves) {
      const lo = Math.max(start, curve.a.t), hi = Math.min(end, curve.b.t);
      if (hi - lo <= EPS) continue;
      const u = (lo - curve.a.t) / (curve.b.t - curve.a.t), v = (hi - curve.a.t) / (curve.b.t - curve.a.t);
      const a = evaluate(curve, u), b = evaluate(curve, v);
      if (!path) path = "M " + xy(a);
      if (curve.c) {
        const control = { ...a,
          x: a.x + (v - u) * ((1 - u) * (curve.c.x - curve.a.x) + u * (curve.b.x - curve.c.x)),
          y: a.y + (v - u) * ((1 - u) * (curve.c.y - curve.a.y) + u * (curve.b.y - curve.c.y)) };
        path += " Q " + xy(control) + " " + xy(b);
      } else path += " L " + xy(b);
    }
    if (path) paths.push(path);
  }
  return paths.join(" ");
}
export function inkOutline(centers: Center[]): string {
  if (!centers.length) return "";
  if (centers.length === 1) {
    const { x, y, r } = centers[0];
    return `M ${f(x - r)} ${f(y)} a ${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0 a ${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0`;
  }
  const left: Point[] = [], right: Point[] = [];
  centers.forEach((p, i) => {
    const before = centers[Math.max(0, i - 1)], after = centers[Math.min(centers.length - 1, i + 1)];
    const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
    const nx = -(after.y - before.y) / length, ny = (after.x - before.x) / length;
    left.push([p.x + nx * p.r, p.y + ny * p.r]); right.push([p.x - nx * p.r, p.y - ny * p.r]);
  });
  const str = ([x, y]: Point) => `${f(x)} ${f(y)}`;
  const first = centers[0], last = centers[centers.length - 1];
  // SVG y grows downward: sweep 0 follows the outside of each round cap.
  // Sweep 1 folds inward and leaves a semicircular notch at the tip.
  return `M ${left.map(str).join(" L ")} A ${f(last.r)} ${f(last.r)} 0 0 0 ${str(right[right.length - 1])} L ${right.reverse().map(str).join(" L ")} A ${f(first.r)} ${f(first.r)} 0 0 0 ${str(left[0])} Z`;
}

function capsuleRange(p: Center, q: Center, a: Point, b: Point, radius: number): InkRange | null {
  const dx = q.x - p.x, dy = q.y - p.y, length2 = dx * dx + dy * dy;
  const intervals: InkRange[] = [];
  for (const [x, y] of [a, b]) {
    const ox = p.x - x, oy = p.y - y;
    if (length2 < EPS) { if (ox * ox + oy * oy <= radius * radius) return [0, 1]; continue; }
    const projection = ox * dx + oy * dy, discriminant = projection ** 2 - length2 * (ox * ox + oy * oy - radius ** 2);
    if (discriminant < 0) continue;
    const lo = Math.max(0, (-projection - Math.sqrt(discriminant)) / length2);
    const hi = Math.min(1, (-projection + Math.sqrt(discriminant)) / length2);
    if (hi > lo) intervals.push([lo, hi]);
  }
  const vx = b[0] - a[0], vy = b[1] - a[1], length = Math.hypot(vx, vy);
  if (length > EPS) {
    let lo = 0, hi = 1;
    const restrict = (value: number, delta: number, min: number, max: number) => {
      if (Math.abs(delta) < EPS) return value >= min && value <= max;
      const u = (min - value) / delta, v = (max - value) / delta;
      lo = Math.max(lo, Math.min(u, v)); hi = Math.min(hi, Math.max(u, v)); return hi > lo;
    };
    if (restrict(((p.x - a[0]) * vx + (p.y - a[1]) * vy) / length, (dx * vx + dy * vy) / length, 0, length) &&
        restrict((vx * (p.y - a[1]) - vy * (p.x - a[0])) / length, (vx * dy - vy * dx) / length, -radius, radius))
      intervals.push([lo, hi]);
  }
  return intervals.length ? [Math.min(...intervals.map((r) => r[0])), Math.max(...intervals.map((r) => r[1]))] : null;
}
function mergeRanges(ranges: InkRange[]): InkRange[] {
  const merged: InkRange[] = [];
  for (const [rawLo, rawHi] of ranges.sort((a, b) => a[0] - b[0])) {
    const lo = Math.max(0, rawLo), hi = Math.min(1, rawHi);
    if (hi - lo <= EPS) continue;
    const last = merged[merged.length - 1];
    if (last && lo <= last[1] + EPS) last[1] = Math.max(last[1], hi);
    else merged.push([lo, hi]);
  }
  return merged;
}
/** Segment eraser: trims full-width sections of a path, not pixels or white
 * paint. One original stroke retains one identity and immutable capture data. */
export function eraseInkSegments(strokes: InkStroke[], from: Point, to: Point, radius: number, aspect = 1): InkStroke[] {
  if (![...from, ...to, radius, aspect].every(Number.isFinite) || radius <= 0 || aspect <= 0)
    throw new Error("أبعاد الممحاة غير صالحة.");
  const a: Point = [from[0], from[1] * aspect], b: Point = [to[0], to[1] * aspect];
  let changed = false;
  const next = strokes.flatMap((stroke): InkStroke[] => {
    const bounds = geometry(stroke, aspect).bounds, padding = radius + stroke.width / 2;
    if (Math.max(a[0], b[0]) + padding < bounds.left || Math.min(a[0], b[0]) - padding > bounds.right ||
        Math.max(a[1], b[1]) + padding < bounds.top || Math.min(a[1], b[1]) - padding > bounds.bottom) return [stroke];
    const cuts: InkRange[] = [];
    for (const run of visibleInkRuns(stroke, aspect)) {
      if (run.length === 1) {
        if (capsuleRange(run[0], run[0], a, b, radius + run[0].r)) cuts.push([0, 1]);
        continue;
      }
      for (let i = 1; i < run.length; i++) {
        const p = run[i - 1], q = run[i];
        const cut = capsuleRange(p, q, a, b, radius + Math.max(p.r, q.r));
        if (cut && cut[1] - cut[0] > EPS) cuts.push([p.t + (q.t - p.t) * cut[0], p.t + (q.t - p.t) * cut[1]]);
      }
    }
    if (!cuts.length) return [stroke];
    const merged = mergeRanges([...(stroke.cuts ?? []), ...cuts]);
    if (merged.length > 128) throw new Error("لم تُحفظ حركة الممحاة: تجاوز المسار حد 128 مقطعًا ممسوحًا. استخدم ممحاة المسار الكامل أو تراجع عن بعض المسح.");
    changed = true;
    if (merged.length === 1 && merged[0][0] <= EPS && merged[0][1] >= 1 - EPS) return [];
    return [{ ...stroke, cuts: merged }];
  });
  return changed ? next : strokes;
}
