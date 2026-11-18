import { MAX_PDF_TEXT_GLYPHS, pdfUnicodeHex, type PdfTextGlyph } from "./pdf-text";
export const MAX_EXPORT_BYTES = 80 * 1024 * 1024;
export type PdfRasterPage = { bytes: Uint8Array; width: number; height: number; widthPt: number; heightPt: number; text?: PdfTextGlyph[] };
const encoder = new TextEncoder();
const number = (n: number) => Number(n.toFixed(6)).toString();

/** Exact-size lossless sheets plus an optional positioned Unicode text layer.
 * Type3 programs contain metrics only, no painting or external font resource.
 * One code point per glyph avoids bidi/combining-mark extraction ambiguity.
 * No scripts, links, attachments, document metadata or hidden note source. */
export function buildNotebookPdf(pages: PdfRasterPage[]): Blob {
  if (!pages.length || pages.length > 36) throw new Error("عدد صفحات PDF غير صالح.");
  const chunks: Uint8Array[] = [], offsets: number[] = [0];
  let total = 0, next = 3 + pages.length * 3, glyphCount = 0;
  const push = (bytes: Uint8Array) => {
    if (total + bytes.length > MAX_EXPORT_BYTES) throw new Error("حجم PDF كبير جدًا للجهاز. صدّر الدفتر على أجزاء أصغر.");
    chunks.push(bytes); total += bytes.length;
  };
  const write = (s: string) => push(encoder.encode(s));
  const obj = (id: number, body: string, data?: Uint8Array) => {
    offsets[id] = total; write(id + " 0 obj\n" + body);
    if (data) { write("\nstream\n"); push(data); write("\nendstream"); }
    write("\nendobj\n");
  };
  const stream = (id: number, data: string) => { const bytes = encoder.encode(data); obj(id, `<< /Length ${bytes.length} >>`, bytes); };
  type Entry = { code: number; text: string; width: number; program: number };
  type Font = { id: number; cmap: number; descriptor: number; entries: Entry[] };
  const fonts: Font[] = [], indexed = new Map<string, { font: Font; entry: Entry }>();
  const pageCommands = pages.map((p) => {
    if (![p.widthPt, p.heightPt, p.width, p.height].every((v) => Number.isFinite(v) && v > 0)) throw new Error("أبعاد PDF غير صالحة.");
    const used = new Set<Font>();
    let command = `q\n${p.widthPt.toFixed(3)} 0 0 ${p.heightPt.toFixed(3)} 0 0 cm\n/Sheet Do\nQ\n`;
    let insideText = false;
    for (const g of p.text ?? []) {
      if (g.actualText !== undefined) {
        if (insideText || g.actualText.length > 16_000) throw new Error("كتلة نص PDF غير صالحة.");
        insideText = true; command += `/Span << /ActualText <FEFF${pdfUnicodeHex(g.actualText)}> >> BDC\n`;
      }
      if (++glyphCount > MAX_PDF_TEXT_GLYPHS) throw new Error("طبقة نص PDF كبيرة جدًا. صدّر صفحات أقل أو ألغ تضمين النص.");
      const codepoint = g.text.codePointAt(0)!;
      if (Array.from(g.text).length !== 1 || (codepoint >= 0xd800 && codepoint <= 0xdfff) || /[\u0000-\u001f\u007f]/u.test(g.text) ||
          ![g.x, g.y, g.width, g.height].every(Number.isFinite) || g.width < 0 || g.height < .01 ||
          g.x < -.1 || g.y < -.1 || g.x + g.width > p.widthPt + .1 || g.y + g.height > p.heightPt + .1)
        throw new Error("موضع حرف PDF غير صالح.");
      const width = Number((1000 * g.width / g.height).toFixed(6)), key = pdfUnicodeHex(g.text) + ":" + width;
      if (!Number.isFinite(width) || width > 1_000_000) throw new Error("مقياس حرف PDF غير صالح.");
      let item = indexed.get(key);
      if (!item) {
        let font = fonts.at(-1);
        if (!font || font.entries.length === 255) { font = { id: next++, cmap: next++, descriptor: next++, entries: [] }; fonts.push(font); }
        const entry = { code: font.entries.length + 1, text: g.text, width, program: next++ };
        font.entries.push(entry); item = { font, entry }; indexed.set(key, item);
      }
      used.add(item.font);
      const h = number(g.height);
      command += `BT /T${item.font.id} 1 Tf 3 Tr ${h} 0 0 ${h} ${number(g.x)} ${number(p.heightPt - g.y - g.height)} Tm <${item.entry.code.toString(16).padStart(2, "0")}> Tj ET\n`;
      if (g.endText) { if (!insideText) throw new Error("كتلة نص PDF غير مكتملة."); insideText = false; command += "EMC\n"; }
    }
    if (insideText) throw new Error("كتلة نص PDF غير مكتملة.");
    return { command, used };
  });
  write("%PDF-1.7\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => (3 + i * 3) + " 0 R").join(" ")}] >>`);
  pages.forEach((p, i) => {
    const pageId = 3 + i * 3, imageId = pageId + 2, { command, used } = pageCommands[i];
    obj(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.widthPt.toFixed(3)} ${p.heightPt.toFixed(3)}] /Resources << /XObject << /Sheet ${imageId} 0 R >> /Font << ${[...used].map((f) => `/T${f.id} ${f.id} 0 R`).join(" ")} >> >> /Contents ${pageId + 1} 0 R >>`);
    stream(pageId + 1, command);
    obj(imageId, `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${p.bytes.length} >>`, p.bytes);
  });
  for (const f of fonts) {
    const max = Math.max(1000, ...f.entries.map((e) => e.width));
    obj(f.id, `<< /Type /Font /Subtype /Type3 /Name /T${f.id} /FontBBox [0 0 ${max} 1000] /FontMatrix [.001 0 0 .001 0 0] /FontDescriptor ${f.descriptor} 0 R /CharProcs << ${f.entries.map((e) => `/g${e.code} ${e.program} 0 R`).join(" ")} >> /Encoding << /Type /Encoding /Differences [1 ${f.entries.map((e) => `/g${e.code}`).join(" ")}] >> /FirstChar 1 /LastChar ${f.entries.length} /Widths [${f.entries.map((e) => e.width).join(" ")}] /Resources << >> /ToUnicode ${f.cmap} 0 R >>`);
    obj(f.descriptor, `<< /Type /FontDescriptor /FontName /MemoFlowSearch${f.id} /Flags 4 /FontBBox [0 0 ${max} 1000] /Ascent 1000 /Descent 0 /CapHeight 1000 /ItalicAngle 0 /StemV 0 >>`);
    for (const e of f.entries) stream(e.program, `${e.width} 0 0 0 ${Math.max(500, e.width)} 1000 d1`);
    let map = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /MemoFlow${f.id} def\n/CMapType 2 def\n1 begincodespacerange\n<00> <FF>\nendcodespacerange\n`;
    for (let j = 0; j < f.entries.length; j += 100) {
      const part = f.entries.slice(j, j + 100);
      map += `${part.length} beginbfchar\n${part.map((e) => `<${e.code.toString(16).padStart(2, "0")}> <${pdfUnicodeHex(e.text)}>`).join("\n")}\nendbfchar\n`;
    }
    stream(f.cmap, map + "endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend");
  }
  const xref = total;
  write(`xref\n0 ${next}\n0000000000 65535 f \n`);
  for (let i = 1; i < next; i++) { if (!offsets[i]) throw new Error("بنية PDF غير مكتملة."); write(String(offsets[i]).padStart(10, "0") + " 00000 n \n"); }
  write(`trailer\n<< /Size ${next} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const result = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return new Blob([result.buffer], { type: "application/pdf" });
}
