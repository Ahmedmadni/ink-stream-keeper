/** Point coordinates relative to the top-left of the physical PDF page. */
export type PdfTextGlyph = { text: string; x: number; y: number; width: number; height: number; actualText?: string; endText?: boolean };
export const MAX_PDF_TEXT_GLYPHS = 250_000;
const BLOCK = "p,h1,h2,h3,h4,h5,h6,li,td,th,pre,blockquote";
const mark = /\p{Mark}/u, rtlLetter = /[\p{Script=Arabic}\p{Script=Hebrew}]/u, letter = /\p{Letter}/u;

/** Range geometry already includes Arabic shaping, ligatures, bidi and wraps.
 * Emit physical left-to-right glyph order inside words, with source word order;
 * do not reverse UTF-16 or flatten an entire word into one synthetic glyph.
 * The latter makes combining marks zero-width *words* in PDF.js.
 * Only rendered editor text is indexed; no ink OCR, alt text or hidden source. */
export function collectPdfText(content: HTMLElement, sheet: HTMLElement, widthPt: number, heightPt: number): PdfTextGlyph[] {
  const bounds = sheet.getBoundingClientRect(), sx = widthPt / bounds.width, sy = heightPt / bounds.height;
  if (![sx, sy].every((v) => Number.isFinite(v) && v > 0)) throw new Error("تعذر قياس نص PDF.");
  type Measured = PdfTextGlyph & { order: number; rtl: boolean };
  const blocks = new Map<Element, Measured[]>();
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node: Node | null, order = 0, previousRtl = false;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement!;
    const style = getComputedStyle(parent);
    if (style.visibility !== "visible" || style.display === "none" || Number(style.opacity) === 0) continue;
    const block = parent.closest(BLOCK) ?? content;
    const glyphs = blocks.get(block) ?? []; blocks.set(block, glyphs);
    let offset = 0;
    for (const char of node.textContent ?? "") {
      const start = offset; offset += char.length; order++;
      if (letter.test(char)) previousRtl = rtlLetter.test(char);
      // Browser layout collapses whitespace and handles directional controls.
      // Control-only ranges have no selectable visible area.
      if (/[\u0000-\u001f\u007f]/u.test(char)) continue;
      range.setStart(node, start); range.setEnd(node, offset);
      const rects = [...range.getClientRects()].filter((r) => r.height > 0 && r.width >= 0);
      if (!rects.length) continue;
      if (rects.length !== 1) throw new Error("تعذر تحديد موضع حرف في طبقة بحث PDF. ألغ تضمين النص لتصدير صورة الصفحة.");
      const r = rects[0];
      if (r.width === 0 && !mark.test(char)) continue;
      const g = { text: char, x: (r.left - bounds.left) * sx, y: (r.top - bounds.top) * sy,
        width: r.width * sx, height: r.height * sy, order, rtl: previousRtl };
      if (![g.x, g.y, g.width, g.height].every(Number.isFinite) || g.x < -.1 || g.y < -.1 ||
          g.x + g.width > widthPt + .1 || g.y + g.height > heightPt + .1)
        throw new Error("نص طبقة البحث يتجاوز حدود الورقة. راجع توزيع النص أو ألغ تضمينه في PDF.");
      glyphs.push(g);
      if (order > MAX_PDF_TEXT_GLYPHS) throw new Error("طبقة نص PDF كبيرة جدًا. صدّر صفحات أقل أو ألغ تضمين النص.");
    }
  }
  const output: PdfTextGlyph[] = [];
  for (const glyphs of blocks.values()) {
    const lines: { top: number; bottom: number; glyphs: Measured[] }[] = [];
    for (const g of glyphs) {
      const line = lines.find((l) => Math.min(l.bottom, g.y + g.height) - Math.max(l.top, g.y) > Math.min(l.bottom - l.top, g.height) * .5);
      if (line) { line.glyphs.push(g); } else lines.push({ top: g.y, bottom: g.y + g.height, glyphs: [g] });
    }
    lines.sort((a, b) => a.top - b.top);
    for (const line of lines) {
      // Overlapping RTL ligatures/marks keep reverse source order at a shared
      // position. Surrogate pairs remain one Unicode code point throughout.
      const logical = line.glyphs.sort((a, b) => a.order - b.order);
      const words: Measured[][] = [];
      for (const g of logical) {
        const last = words.at(-1);
        if (!last || /\s/u.test(g.text) || /\s/u.test(last.at(-1)!.text)) words.push([g]);
        else last.push(g);
      }
      const positioned = words.flatMap((word) => word.sort((a, b) => Math.abs(a.x - b.x) > .02 ? a.x - b.x :
        (a.rtl && b.rtl ? b.order - a.order : a.order - b.order)));
      const plain = [...logical].sort((a, b) => a.order - b.order).map((g) => g.text).join("");
      const runs: PdfTextGlyph[] = positioned.map(({ text, x, y, width, height }) => ({ text, x, y, width, height }));
      if (runs.length) { runs[0].actualText = plain; runs.at(-1)!.endText = true; output.push(...runs); }
    }
  }
  return output;
}

export function pdfUnicodeHex(text: string) {
  return Array.from({ length: text.length }, (_, i) => text.charCodeAt(i).toString(16).padStart(4, "0")).join("").toUpperCase();
}
