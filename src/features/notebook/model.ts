import { z } from "zod";

export const PAPER_TYPES = ["plain", "lined", "grid", "dots", "cornell", "ledger"] as const;
export const PAPER_SIZES = ["a4", "a5", "letter", "square"] as const;
export const PAPER_TINTS = ["white", "ivory", "mint", "blue", "rose"] as const;
export const STICKER_TYPES = [
  "stethoscope", "heart-pulse", "pill", "microscope", "flask-conical",
  "dna", "atom", "book-open", "graduation-cap", "lightbulb", "pencil-ruler",
  "calculator", "chart-no-axes-combined", "wallet", "receipt", "landmark",
  "coins", "circle-check-big", "calendar-check", "notebook-pen", "star", "target",
] as const;

const point = z.tuple([z.number().finite().min(0).max(1000), z.number().finite().min(0).max(1000)]);
const strokeSchema = z.object({
  id: z.string().uuid(),
  tool: z.enum(["pen", "highlighter"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  width: z.number().finite().min(1).max(40),
  points: z.array(point).min(1).max(4000),
}).strict();
const stickerSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(STICKER_TYPES),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  scale: z.number().finite().min(0.045).max(0.24),
}).strict();
const pageSchema = z.object({
  id: z.string().uuid(),
  html: z.string().max(1_000_000),
  paper: z.enum(PAPER_TYPES),
  size: z.enum(PAPER_SIZES),
  orientation: z.enum(["portrait", "landscape"]),
  tint: z.enum(PAPER_TINTS),
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
  return content.trimStart().startsWith('<div data-mf-notebook-v1="1"');
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
  const preview = escapeHtml(notebookPlainText(notebook).slice(0, 8000)).replace(/\n/g, "<br>");
  return PREFIX + toBase64(bytes) + '"><p>' + preview + "</p></div>";
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
  return validateNotebook(decoded);
}
export function createPage(options: Partial<Pick<NotebookPage, "paper" | "size" | "orientation" | "tint">> = {}): NotebookPage {
  return {
    id: crypto.randomUUID(), html: "<p></p>",
    paper: options.paper ?? "lined",
    size: options.size ?? "a4",
    orientation: options.orientation ?? "portrait",
    tint: options.tint ?? "ivory",
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
