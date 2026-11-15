import { inkBounds } from "./ink";
import { visibleInkRuns } from "./ink-segments";
import { createPage, dimensionsMm, type InkStroke, type NotebookPage } from "./model";

export const MAX_RECOGNITION_STROKES = 100;
export function recognitionInput(page: NotebookPage, selectedIds: Set<string>) {
  const strokes = page.strokes.filter((s) => s.tool === "pen" && (!selectedIds.size || selectedIds.has(s.id)));
  const [w, h] = dimensionsMm(page.size, page.orientation);
  // Clipped geometry is derived, not newly captured input. Never fabricate
  // timestamps for cut boundaries or expose erased sections to recognition.
  const inputs = strokes.flatMap<{ points: InkStroke["points"]; times?: InkStroke["times"] }>((stroke) => stroke.cuts?.length
    ? visibleInkRuns(stroke, h / w).map((run) => ({ points: run.map((p): [number, number] => [p.x, p.y / (h / w)]) }))
    : [{ points: stroke.points, ...(stroke.times ? { times: stroke.times } : {}) }]);
  const count = inputs.reduce((sum, stroke) => sum + stroke.points.length, 0);
  if (!strokes.length) throw new Error("اكتب بالقلم أو حدد سطرًا من الكتابة أولًا.");
  if (inputs.length > MAX_RECOGNITION_STROKES || count > 30000 || inputs.some((stroke) => stroke.points.length > 4000))
    throw new Error("حدد سطرًا أو جزءًا أصغر من الكتابة للتعرف عليه.");
  const bounds = inkBounds(strokes, h / w);
  if (!inputs.length || !bounds) throw new Error("لا يوجد حبر ظاهر للتعرف عليه في هذا التحديد.");
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
