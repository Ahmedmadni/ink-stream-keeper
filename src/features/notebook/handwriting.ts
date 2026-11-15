import { inkBounds } from "./ink";
import { createPage, dimensionsMm, type InkStroke, type NotebookPage } from "./model";

export const MAX_RECOGNITION_STROKES = 100;
export function recognitionInput(page: NotebookPage, selectedIds: Set<string>) {
  const strokes = page.strokes.filter((s) => s.tool === "pen" && (!selectedIds.size || selectedIds.has(s.id)));
  const count = strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
  if (!strokes.length) throw new Error("اكتب بالقلم أو حدد سطرًا من الكتابة أولًا.");
  if (strokes.length > MAX_RECOGNITION_STROKES || count > 30000)
    throw new Error("حدد سطرًا أو جزءًا أصغر من الكتابة للتعرف عليه.");
  const [w, h] = dimensionsMm(page.size, page.orientation);
  const bounds = inkBounds(strokes)!;
  return {
    strokes: strokes.map((stroke) => ({ points: stroke.points, ...(stroke.times ? { times: stroke.times } : {}) })),
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
