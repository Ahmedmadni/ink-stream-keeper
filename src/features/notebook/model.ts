import { z } from "zod";

export const PAPER_TYPES = ["plain", "lined", "grid", "dots", "cornell", "ledger", "two-column", "weekly", "flashcards", "music", "isometric", "hex"] as const;
export const PAPER_SIZES = ["a4", "a5", "letter", "square"] as const;
export const PAPER_TINTS = ["white", "ivory", "mint", "blue", "rose"] as const;
export const PAPER_TEXTURES = ["smooth", "grain", "linen"] as const;
export const STICKER_TYPES = [
  "stethoscope", "heart-pulse", "pill", "microscope", "flask-conical",
  "dna", "atom", "book-open", "graduation-cap", "lightbulb", "pencil-ruler",
  "calculator", "chart-no-axes-combined", "wallet", "receipt", "landmark",
  "coins", "circle-check-big", "calendar-check", "notebook-pen", "star", "target",
  "brain", "bone", "syringe", "thermometer", "hospital", "bandage", "scan-eye", "ear", "file-spreadsheet", "scale", "piggy-bank", "credit-card", "briefcase-business", "badge-dollar-sign", "hand-coins", "chart-pie", "trending-down", "circle-dollar-sign", "sticky-note", "alarm-clock", "bookmark", "flag", "list-checks", "notebook-tabs", "book-marked", "presentation", "clipboard-list", "ruler", "sci-animal-cell", "sci-cell-membrane", "sci-neuron", "sci-chromosome", "sci-dna-double-helix", "sci-plasmid", "sci-mitochondrion", "sci-ribosome", "sci-erlenmeyer-flask", "sci-benzene-ring", "sci-peptide-bond", "sci-protein-ligand-binding", "sci-petri-dish", "sci-micropipette", "sci-microscope", "sci-test-tube-rack", "sci-96-well-plate", "sci-neural-network", "sci-phylogenetic-tree", "sci-heatmap",
] as const;

const point = z.tuple([z.number().finite().min(0).max(1000), z.number().finite().min(0).max(1000)]);
const strokeSchema = z.object({
  id: z.string().uuid(),
  tool: z.enum(["pen", "highlighter"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  width: z.number().finite().min(1).max(40),
  points: z.array(point).min(1).max(4000),
  cuts: z.array(z.tuple([z.number().finite().min(0).max(1), z.number().finite().min(0).max(1)]))
    .min(1).max(128).optional(),
  times: z.array(z.number().finite().int().nonnegative().max(Number.MAX_SAFE_INTEGER)).min(1).max(4000).optional(),
  // Optional fields preserve every existing v1 notebook and its original samples.
  pressures: z.array(z.number().finite().min(0).max(1)).min(1).max(4000).optional(),
  smoothing: z.boolean().optional(),
}).strict().refine((stroke) => (!stroke.pressures || stroke.pressures.length === stroke.points.length) &&
  (!stroke.times || (stroke.times.length === stroke.points.length && stroke.times.every((t, i) => i === 0 || t >= stroke.times![i - 1]))) &&
  (!stroke.cuts || (stroke.points.length > 1 && stroke.cuts.every(([a, b], i) => a < b && (i === 0 || a > stroke.cuts![i - 1][1])))), {
  message: "عينات القلم أو مقاطع المسح غير متطابقة مع المسار.",
});
const stickerSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(STICKER_TYPES),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  scale: z.number().finite().min(0.045).max(0.24),
  rotation: z.number().finite().min(-180).max(180).optional(),
  presentation: z.enum(["badge", "cutout"]).optional(),
}).strict();
const pageSchema = z.object({
  id: z.string().uuid(),
  html: z.string().max(1_000_000),
  paper: z.enum(PAPER_TYPES),
  size: z.enum(PAPER_SIZES),
  orientation: z.enum(["portrait", "landscape"]),
  tint: z.enum(PAPER_TINTS),
  texture: z.enum(PAPER_TEXTURES).optional(),
  lineSpacing: z.number().int().min(20).max(56).optional(),
  fontSize: z.number().int().min(12).max(24).optional(),
  strokes: z.array(strokeSchema).max(350),
  stickers: z.array(stickerSchema).max(120),
}).strict();
const notebookSchema = z.object({
  version: z.literal(1),
  pages: z.array(pageSchema).min(1).max(36),
}).strict();
const PREFIX = '<div data-mf-notebook-v1="1" data-json="';
export const MAX_NOTEBOOK_BYTES = 3_500_000;

export type Notebook = z.infer<typeof notebookSchema>;
export type NotebookPage = Notebook["pages"][number];
export type InkStroke = NotebookPage["strokes"][number];
export type PageSticker = NotebookPage["stickers"][number];
export type PaperSize = NotebookPage["size"];
export type PaperType = NotebookPage["paper"];
export type PaperTint = NotebookPage["tint"];

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x4000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x4000));
  return btoa(binary);
}
function fromBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]!);
}
/** Recognizable HTML wrapper keeps the note preview searchable, but never
 * exposes its JSON payload as editor body content. */
export function isNotebookContent(content: string): boolean {
  // Recognize damaged/reordered/unknown markers too, so a notebook cannot be
  // mistaken for legacy HTML and overwritten by the legacy editor.
  return /^\s*<div\b[^>]*\bdata-mf-notebook-v\d+\s*=/i.test(content);
}
function notebookPreview(notebook: Notebook): string {
  return "<p>" + escapeHtml(notebookPlainText(notebook).slice(0, 8000)).replace(/\n/g, "<br>") + "</p></div>";
}
export function validateNotebook(input: unknown): Notebook {
  const doc = notebookSchema.parse(input);
  const ids = new Set<string>();
  for (const page of doc.pages) {
    if (ids.has(page.id)) throw new Error("معرف صفحة مكرر.");
    ids.add(page.id);
    const markIds = new Set<string>();
    for (const s of [...page.strokes, ...page.stickers]) {
      if (markIds.has(s.id)) throw new Error("عنصر مرئي مكرر.");
      markIds.add(s.id);
    }
  }
  return doc;
}
export function notebookPlainText(notebook: Notebook): string {
  return notebook.pages.map((page) => page.html
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .trim()).filter(Boolean).join("\n\n");
}
export function serializeNotebook(input: Notebook): string {
  const notebook = validateNotebook(input);
  const bytes = new TextEncoder().encode(JSON.stringify(notebook));
  if (bytes.byteLength > MAX_NOTEBOOK_BYTES)
    throw new Error("حجم الدفتر تجاوز الحد الآمن للحفظ المحلي (3.5 ميجابايت).");
  // The visible (escaped) preview preserves search in existing notes lists.
  return PREFIX + toBase64(bytes) + '">' + notebookPreview(notebook);
}
export function parseNotebook(content: string): Notebook | null {
  if (!isNotebookContent(content)) return null;
  const match = /^<div data-mf-notebook-v1="1" data-json="([A-Za-z0-9+/=]+)">/.exec(content.trimStart());
  if (!match || match[1].length > MAX_NOTEBOOK_BYTES * 1.5)
    throw new Error("تعذر قراءة تنسيق الدفتر؛ لم نعدّل النص الأصلي.");
  let decoded: unknown;
  try {
    const bytes = fromBase64(match[1]);
    if (bytes.byteLength > MAX_NOTEBOOK_BYTES) throw new Error("large");
    decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("محتوى الدفتر غير صالح؛ احتفظ بنسخة من المذكرة قبل أي تعديل.");
  }
  const notebook = validateNotebook(decoded);
  // Do not silently discard text appended outside the encoded pages.
  if (content.trimStart().slice(match[0].length) !== notebookPreview(notebook))
    throw new Error("غلاف الدفتر غير مكتمل أو يحتوي نصًا خارج الصفحات. احتفظ بالأصل واستعد نسخة صحيحة قبل التعديل.");
  return notebook;
}
export function createPage(options: Partial<Pick<NotebookPage, "paper" | "size" | "orientation" | "tint" | "texture" | "lineSpacing" | "fontSize">> = {}): NotebookPage {
  return {
    id: crypto.randomUUID(), html: "<p></p>",
    paper: options.paper ?? "lined",
    size: options.size ?? "a4",
    orientation: options.orientation ?? "portrait",
    tint: options.tint ?? "ivory",
    texture: options.texture ?? "smooth", lineSpacing: options.lineSpacing ?? 32, fontSize: options.fontSize ?? 16,
    strokes: [], stickers: [],
  };
}
export function fromLegacyNote(content: string, options: Partial<NotebookPage> = {}): Notebook {
  return { version: 1, pages: [{ ...createPage(options), html: content || "<p></p>" }] };
}
export function dimensionsMm(size: PaperSize, orientation: NotebookPage["orientation"]) {
  const portrait: Record<PaperSize, [number, number]> = {
    a4: [210, 297], a5: [148, 210], letter: [215.9, 279.4], square: [210, 210],
  };
  const [w, h] = portrait[size];
  return orientation === "landscape" ? [h, w] as const : [w, h] as const;
}
export function inkPath(points: InkStroke["points"], smooth = true): string {
  if (!points.length) return "";
  const f = (n: number) => Math.round(n * 100) / 100;
  if (points.length === 1) {
    const [x, y] = points[0];
    return "M " + f(x) + " " + f(y) + " l 0.1 0";
  }
  if (!smooth || points.length === 2)
    return "M " + points.map(([x, y]) => f(x) + " " + f(y)).join(" L ");
  let path = "M " + f(points[0][0]) + " " + f(points[0][1]);
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const next = points[i + 1];
    path += " Q " + f(x) + " " + f(y) + " " +
      f((x + next[0]) / 2) + " " + f((y + next[1]) / 2);
  }
  const end = points[points.length - 1];
  return path + " L " + f(end[0]) + " " + f(end[1]);
}

/** Keep speech-to-note inserts inside the currently last page, not after the
 * serialized notebook wrapper where the next edit would otherwise lose them. */
export function appendHtmlToNotebook(content: string, html: string): string {
  const notebook = parseNotebook(content);
  if (!notebook) return content + html;
  const index = notebook.pages.length - 1;
  return serializeNotebook({
    ...notebook,
    pages: notebook.pages.map((page, i) => i === index
      ? { ...page, html: page.html + html } : page),
  });
}
