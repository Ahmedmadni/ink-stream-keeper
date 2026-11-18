import { getStrokePoints } from "perfect-freehand";
import type { InkStroke } from "./model";
/** Optional stabilization of NEW pen geometry. Raw capture/pressure/time stay
 * untouched. The shared renderer/eraser/PDF continue to use controlPoints.
 * This is path stabilization, not text recognition or a paint-texture engine. */
export function stabilizePen(stroke: InkStroke, strength: number, aspect: number): InkStroke {
  if (!strength || stroke.tool !== "pen" || stroke.points.length < 3 || stroke.controlPoints || stroke.cuts || stroke.span) return stroke;
  if (!Number.isFinite(strength) || strength < 0 || strength > 1 || !Number.isFinite(aspect) || aspect <= 0) return stroke;
  const points = getStrokePoints(stroke.points.map(([x, y]) => [x, y * aspect]), { size: stroke.width, streamline: strength, last: true });
  if (points.length < 2) return stroke;
  const controlPoints = stroke.points.map((original, i): [number, number] => {
    if (i === 0 || i === stroke.points.length - 1) return [...original];
    const t = i * (points.length - 1) / (stroke.points.length - 1), n = Math.floor(t), f = t - n;
    const a = points[n].point, b = points[Math.min(n + 1, points.length - 1)].point;
    return [Math.max(0, Math.min(1000, a[0] + (b[0] - a[0]) * f)), Math.max(0, Math.min(1000, (a[1] + (b[1] - a[1]) * f) / aspect))];
  });
  return { ...stroke, controlPoints };
}
