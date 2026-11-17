import type { InkBounds, Point } from "./ink";
import type { InkTransformOptions } from "./ink-transform";

export type TransformHandleKind = "scale" | "rotate";
export type InkTransformDraft = { size: string; rotation: string };
export const draftTransformOptions = (draft: InkTransformDraft): InkTransformOptions => ({
  scale: draft.size.trim() ? Number(draft.size) / 100 : NaN,
  rotation: draft.rotation.trim() ? Number(draft.rotation) : NaN,
});
export const validTransformOptions = (o: InkTransformOptions) => Number.isFinite(o.scale) && o.scale >= .25 && o.scale <= 4 &&
  Number.isFinite(o.rotation) && o.rotation >= -180 && o.rotation <= 180;
export const normalizeInkAngle = (angle: number) => ((angle + 180) % 360 + 360) % 360 - 180;
export const transformDraft = (o: InkTransformOptions): InkTransformDraft => ({
  size: String(Math.round(o.scale * 1000) / 10), rotation: String(Math.round(o.rotation * 10) / 10),
});

function validateFrame(frame: InkBounds, aspect: number) {
  if (![frame.x, frame.y, frame.width, frame.height, aspect].every(Number.isFinite) || aspect <= 0 || frame.width < 0 || frame.height < 0)
    throw new Error("أبعاد مقابض التحويل غير صالحة.");
}
/** Unclamped pointer positions are intentional: captured drags may leave the
 * sheet, then return. Only the existing preview validator can accept paint. */
export function transformFromHandle(start: InkTransformOptions, frame: InkBounds, from: Point, to: Point,
  kind: TransformHandleKind, aspect = 1, snap = false): InkTransformOptions {
  validateFrame(frame, aspect);
  if (!validTransformOptions(start) || ![...from, ...to].every(Number.isFinite)) throw new Error("موضع مقبض التحويل غير صالح.");
  if (Math.hypot(to[0] - from[0], (to[1] - from[1]) * aspect) < 1e-8) return start;
  const cx = frame.x + frame.width / 2, cy = frame.y + frame.height / 2;
  const ax = from[0] - cx, ay = (from[1] - cy) * aspect, bx = to[0] - cx, by = (to[1] - cy) * aspect;
  const radius = Math.hypot(ax, ay);
  if (![ax, ay, bx, by, radius].every(Number.isFinite)) throw new Error("موضع مقبض التحويل خارج المجال الآمن.");
  if (radius < 1e-6) throw new Error("اختر مقبضًا بعيدًا عن مركز الرسم.");
  if (kind === "scale") {
    const raw = start.scale * Math.hypot(bx, by) / radius;
    return { ...start, scale: Math.max(.25, Math.min(4, snap ? Math.round(raw * 10) / 10 : Math.round(raw * 1000) / 1000)) };
  }
  if (Math.hypot(bx, by) < 1e-6) return start;
  const raw = normalizeInkAngle(start.rotation + (Math.atan2(by, bx) - Math.atan2(ay, ax)) * 180 / Math.PI);
  return { ...start, rotation: normalizeInkAngle(snap ? Math.round(raw / 15) * 15 : Math.round(raw * 10) / 10) };
}

export function nudgeTransformHandle(start: InkTransformOptions, kind: TransformHandleKind, key: string, shift = false): InkTransformOptions | null {
  if (!validTransformOptions(start)) return null;
  const direction = key === "ArrowRight" || key === "ArrowUp" ? 1 : key === "ArrowLeft" || key === "ArrowDown" ? -1 : 0;
  if (!direction && key !== "Home" && key !== "End") return null;
  if (kind === "scale") return { ...start, scale: key === "Home" ? .25 : key === "End" ? 4 :
    Math.max(.25, Math.min(4, Math.round((start.scale + direction * (shift ? .1 : .01)) * 1000) / 1000)) };
  return { ...start, rotation: key === "Home" ? -180 : key === "End" ? 180 : normalizeInkAngle(start.rotation + direction * (shift ? 15 : 1)) };
}

/** The outline follows the rotated source frame. Hit targets are inset within
 * the sheet; a rotation target chooses the least crowded inward-facing edge. */
export function transformHandleLayout(frame: InkBounds, options: InkTransformOptions, aspect: number, unitsPerPixel: number) {
  validateFrame(frame, aspect);
  if (!validTransformOptions(options) || !Number.isFinite(unitsPerPixel) || unitsPerPixel <= 0) throw new Error("مقياس مقابض التحويل غير صالح.");
  const u = unitsPerPixel, cx = frame.x + frame.width / 2, cy = (frame.y + frame.height / 2) * aspect;
  const hw = Math.max(frame.width * options.scale / 2, 24 * u), hh = Math.max(frame.height * aspect * options.scale / 2, 24 * u);
  if (![cx, cy, hw, hh, 40 * u].every(Number.isFinite)) throw new Error("مقياس مقابض التحويل خارج المجال الآمن.");
  const angle = options.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const position = (x: number, y: number): Point => [cx + c * x - s * y, cy + s * x + c * y];
  const mx = Math.min(24 * u, 450), my = Math.min(24 * u, 450 * aspect);
  const inset = ([x, y]: Point): Point => [Math.max(mx, Math.min(1000 - mx, x)), Math.max(my, Math.min(1000 * aspect - my, y))];
  const outline = [position(-hw, -hh), position(hw, -hh), position(hw, hh), position(-hw, hh)];
  const corners = outline.map(inset);
  const candidates = [[0, -hh, 0, -hh - 40 * u], [0, hh, 0, hh + 40 * u], [hw, 0, hw + 40 * u, 0], [-hw, 0, -hw - 40 * u, 0]];
  let best = { anchor: position(0, -hh), point: inset(position(0, -hh - 40 * u)), score: -Infinity };
  for (const [ax, ay, x, y] of candidates) {
    const p = inset(position(x, y));
    const score = Math.min(Math.hypot(p[0] - cx, p[1] - cy), ...corners.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1])));
    if (score > best.score + 1e-7) best = { anchor: position(ax, ay), point: p, score };
  }
  return { outline, corners, rotation: best.point, anchor: best.anchor, center: [cx, cy] as Point };
}
