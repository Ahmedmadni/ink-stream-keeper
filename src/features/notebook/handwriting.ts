import { inkBounds } from "./ink";
import { visibleInkRuns, inkWorldPoints } from "./ink-segments";
import { createPage, dimensionsMm, type InkStroke, type NotebookPage } from "./model";

export const MAX_RECOGNITION_STROKES = 100;
export function recognitionInput(page: NotebookPage, selectedIds: Set<string>) {
  const strokes = page.strokes.filter((s) => s.tool === "pen" && (!selectedIds.size || selectedIds.has(s.id)));
  const [w, h] = dimensionsMm(page.size, page.orientation);
  // Clipped geometry is derived, not newly captured input. Never fabricate
  // timestamps for cut boundaries or expose erased sections to recognition.
  const inputs = strokes.flatMap<{ points: InkStroke["points"]; times?: InkStroke["times"] }>((stroke) => stroke.cuts?.length || stroke.span || stroke.controlPoints
    ? visibleInkRuns(stroke, h / w).map((run) => {
      // Rendering a smoothed 4000-point stroke can yield ~16000 vertices.
      // Bound only this temporary untimed recognition copy; retained capture
      // and editing geometry never change. Keep both endpoints exactly.
      const samples = run.length <= 4000 ? run : Array.from({ length: 4000 }, (_, i) => run[Math.round(i * (run.length - 1) / 3999)]);
      return { points: samples.map((p): [number, number] => [p.x, p.y / (h / w)]) };
    })
    : [{ points: stroke.offset ? inkWorldPoints(stroke) : stroke.points, ...(stroke.times ? { times: stroke.times } : {}) }]);
  const count = inputs.reduce((sum, stroke) => sum + stroke.points.length, 0);
  if (!strokes.length) throw new Error("اكتب بالقلم أو حدد سطرًا من الكتابة أولًا.");
  if (inputs.length > MAX_RECOGNITION_STROKES || count > 30000 || inputs.some((stroke) => stroke.points.length > 4000))
    throw new Error("حدد سطرًا أو جزءًا أصغر من الكتابة للتعرف عليه.");
  const bounds = inkBounds(strokes, h / w);
  if (!inputs.length || !bounds) throw new Error("لا يوجد حبر ظاهر للتعرف عليه في هذا التحديد.");
  for (const input of inputs) {
    if (input.points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y) || x < -1e-5 || y < -1e-5 || x > 1000.00001 || y > 1000.00001))
      throw new Error("أعد الحبر الظاهر إلى داخل حدود الورقة قبل التعرف عليه.");
    // Normalize only floating-point boundary noise; never crop real geometry.
    if (input.points.some(([x, y]) => x < 0 || y < 0 || x > 1000 || y > 1000))
      input.points = input.points.map(([x, y]) => [Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(1000, y))]);
  }
  return {
    strokes: inputs,
    aspect: h / w,
    lineHeight: Math.max(20, bounds.height * h / w),
  };
}
/** Raw ink stays on its original page. Only reviewed text enters a new page. */
export function recognizedTextPage(source: NotebookPage, text: string, font: "ruqaa" | "ibm"): NotebookPage {
  if (!text.trim() || text.length > 5000) throw new Error("راجع النص قبل إضافته؛ الحد 5000 حرف.");
  const escaped = text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const family = font === "ruqaa" ? "Aref Ruqaa" : "IBM Plex Sans Arabic";
  return { ...createPage(source), html: '<p><span style="font-family: ' + family + '">' + escaped.replace(/\r?\n/g, "<br>") + "</span></p>" };
}
