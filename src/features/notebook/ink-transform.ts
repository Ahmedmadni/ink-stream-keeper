import type { InkStroke } from "./model";
import { MAX_NOTEBOOK_BYTES } from "./model";
import { inkWorldPoints, visibleInkBounds, visibleInkRuns } from "./ink-segments";
import type { InkBounds, Point } from "./ink";

export type InkTransformOptions = { scale: number; rotation: number };
export type InkTransformPreview = { source: InkStroke[]; strokes: InkStroke[]; changed: boolean; error: string };

/** Pivot follows the visible centerlines, including clipped curve extrema. */
export function inkTransformFrame(strokes: InkStroke[], ids: Set<string>, aspect = 1): InkBounds | null {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const stroke of strokes) {
    if (!ids.has(stroke.id)) continue;
    const b = visibleInkBounds(stroke, aspect);
    if (!b) continue;
    left = Math.min(left, b.x); top = Math.min(top, b.y);
    right = Math.max(right, b.x + b.width); bottom = Math.max(bottom, b.y + b.height);
  }
  return right < left ? null : { x: left, y: top, width: right - left, height: bottom - top };
}

/** Uniform scale then clockwise rotation in physical page coordinates.
 * Line width, raw capture and eraser parameter domains remain unchanged.
 * Reject unsafe output instead of clipping or silently shifting the group. */
export function transformInk(strokes: InkStroke[], ids: Set<string>, options: InkTransformOptions, aspect = 1,
  remainingBytes = MAX_NOTEBOOK_BYTES): InkStroke[] {
  const { scale, rotation } = options;
  if (![scale, rotation, aspect, remainingBytes].every(Number.isFinite) || scale < .25 || scale > 4 ||
      rotation < -180 || rotation > 180 || aspect <= 0 || remainingBytes < 0)
    throw new Error("اختر حجمًا بين 25% و400% وزاوية بين ‎-180° و180°.");
  const frame = inkTransformFrame(strokes, ids, aspect);
  if (!frame) throw new Error("حدد حبرًا ظاهرًا لتحويله أولًا.");
  if (Math.abs(scale - 1) < 1e-9 && Math.abs(rotation) < 1e-9) return strokes;
  const cx = frame.x + frame.width / 2, cy = frame.y + frame.height / 2;
  const angle = rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const next = strokes.map((stroke) => {
    if (!ids.has(stroke.id)) return stroke;
    const world = inkWorldPoints(stroke);
    const controlPoints = world.map(([x, y]): Point => {
      const dx = x - cx, dy = (y - cy) * aspect;
      return [cx + scale * (c * dx - s * dy), cy + scale * (s * dx + c * dy) / aspect];
    });
    if (controlPoints.every((p, i) => Math.abs(p[0] - world[i][0]) < 1e-9 && Math.abs(p[1] - world[i][1]) < 1e-9)) return stroke;
    if (controlPoints.some((p) => p.some((v) => !Number.isFinite(v) || Math.abs(v) > 10000)))
      throw new Error("نقاط الجزء المخفية تتجاوز مجال التحرير الآمن؛ جرّب حجمًا أصغر.");
    const edited = { ...stroke, controlPoints, offset: undefined };
    const b = visibleInkBounds(edited, aspect);
    let radius = stroke.width / 2;
    if (stroke.pressures && stroke.tool === "pen") {
      radius = 0;
      for (const run of visibleInkRuns(edited, aspect)) for (const p of run) radius = Math.max(radius, p.r);
    }
    // Conservative paint extents also protect round tips from PDF cropping.
    if (b && (b.x - radius < -1e-5 || b.y - radius / aspect < -1e-5 ||
        b.x + b.width + radius > 1000.00001 || b.y + b.height + radius / aspect > 1000.00001))
      throw new Error("قد يخرج جزء من الحبر خارج الورقة. صغّر الرسم أو ألغِ المعاينة وحرّك التحديد إلى الداخل.");
    return edited;
  });
  if (next.every((stroke, i) => stroke === strokes[i])) return strokes;
  // Stroke records contain ASCII fields only; JSON character count is their
  // exact UTF-8 byte size. Full notebook validation still owns the final save.
  if (JSON.stringify(next).length - JSON.stringify(strokes).length > remainingBytes)
    throw new Error("حجم الدفتر لا يسمح بهذا التحويل مع حفظ الأصل. حدد ضربات أقل أو استخدم دفترًا آخر.");
  return next;
}

export function previewInkTransform(source: InkStroke[], ids: Set<string>, options: InkTransformOptions, aspect = 1,
  remainingBytes = MAX_NOTEBOOK_BYTES): InkTransformPreview {
  try {
    const strokes = transformInk(source, ids, options, aspect, remainingBytes);
    return { source, strokes, changed: strokes !== source, error: "" };
  } catch (error) {
    return { source, strokes: source, changed: false, error: error instanceof Error ? error.message : "تعذر تحويل الرسم؛ بقي الأصل محفوظًا." };
  }
}
