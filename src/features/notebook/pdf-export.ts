import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dimensionsMm, type Notebook, type NotebookPage } from "./model";
import { stickerIcon, stickerLabel } from "./sticker-packs";

const BACKGROUND = {
  white: "#ffffff", ivory: "#fffdf4", mint: "#f4fff9", blue: "#f4faff", rose: "#fff6fa",
};
const encoder = new TextEncoder();

function putPaper(ctx: CanvasRenderingContext2D, page: NotebookPage, width: number, height: number) {
  ctx.fillStyle = BACKGROUND[page.tint];
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#cbdbea";
  const guide = Math.max(24, Math.round(width / 28));
  if (page.paper === "lined" || page.paper === "cornell" || page.paper === "grid" || page.paper === "ledger") {
    for (let y = guide; y < height; y += guide) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
  }
  if (page.paper === "grid" || page.paper === "ledger") {
    const xGap = page.paper === "ledger" ? guide * 3 : guide;
    for (let x = xGap; x < width; x += xGap) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
  }
  if (page.paper === "dots") {
    ctx.fillStyle = "#c9d9ea";
    for (let x = guide; x < width; x += guide)
      for (let y = guide; y < height; y += guide) {
        ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
      }
  }
  if (page.paper === "cornell") {
    ctx.strokeStyle = "#d6afb3";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * .28, height * .08); ctx.lineTo(width * .28, height * .85);
    ctx.moveTo(0, height * .85); ctx.lineTo(width, height * .85);
    ctx.stroke();
  }
}

function renderText(ctx: CanvasRenderingContext2D, html: string, width: number, height: number) {
  const dom = new DOMParser().parseFromString(html || "<p></p>", "text/html");
  const right = width * .92;
  const usable = width * .84;
  const font = '"IBM Plex Sans Arabic", "Noto Sans Arabic", sans-serif';
  let y = height * .105;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.direction = "rtl";
  const blocks = Array.from(dom.body.children);
  if (!blocks.length && dom.body.textContent?.trim()) blocks.push(dom.body);
  for (const block of blocks) {
    const tag = block.tagName.toLowerCase();
    const heading = /^h[1-6]$/.test(tag);
    const size = heading ? Math.max(23, Math.round(width * .027)) : Math.max(19, Math.round(width * .020));
    const lineHeight = size * 1.75;
    ctx.font = (heading ? "bold " : "") + String(size) + "px " + font;
    ctx.fillStyle = "#202c40";
    const text = (block.textContent || "").replace(/\s+/g, " ").trim();
    const words = text.split(" ").filter(Boolean);
    let line = "";
    const flush = () => {
      if (!line) return;
      if (y + lineHeight > height * .94)
        throw new Error("نص الصفحة يتجاوز حدود الورقة. وزّع النص على صفحات إضافية ثم أعد تصدير PDF.");
      ctx.fillText(line, right, y, usable);
      y += lineHeight;
      line = "";
    };
    for (const word of words) {
      const candidate = line ? line + " " + word : word;
      if (ctx.measureText(candidate).width > usable && line) flush();
      line = line ? line + " " + word : word;
    }
    flush();
    if (text) y += lineHeight * .3;
  }
}

function renderInk(ctx: CanvasRenderingContext2D, page: NotebookPage, width: number, height: number) {
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  for (const stroke of page.strokes) {
    if (!stroke.points.length) continue;
    ctx.save();
    ctx.globalAlpha = stroke.tool === "highlighter" ? .34 : 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(1.5, stroke.width * width / 1000);
    ctx.beginPath();
    ctx.moveTo(stroke.points[0][0] / 1000 * width, stroke.points[0][1] / 1000 * height);
    if (stroke.points.length === 1) {
      ctx.lineTo(stroke.points[0][0] / 1000 * width + 1, stroke.points[0][1] / 1000 * height);
    } else {
      for (const [x, y] of stroke.points.slice(1))
        ctx.lineTo(x / 1000 * width, y / 1000 * height);
    }
    ctx.stroke();
    ctx.restore();
  }
}

async function makeSvgIcon(kind: NotebookPage["stickers"][number]["kind"]) {
  const Icon = stickerIcon(kind);
  let markup = renderToStaticMarkup(createElement(Icon, { size: 96, color: "#ffffff", strokeWidth: 2.5 }));
  if (!markup.includes("xmlns=")) markup = markup.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
  });
}
async function renderStickers(
  ctx: CanvasRenderingContext2D, page: NotebookPage, width: number, height: number,
) {
  for (const sticker of page.stickers) {
    const diameter = sticker.scale * width;
    const x = sticker.x * width, y = sticker.y * height;
    ctx.save();
    ctx.fillStyle = sticker.color;
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = Math.max(2, diameter * .025);
    ctx.beginPath(); ctx.arc(x, y, diameter / 2, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    const icon = await makeSvgIcon(sticker.kind);
    if (icon) ctx.drawImage(icon, x - diameter * .33, y - diameter * .33, diameter * .66, diameter * .66);
    else {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold " + Math.round(diameter * .20) + 'px "IBM Plex Sans Arabic",sans-serif';
      ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(stickerLabel(sticker.kind).slice(0, 5), x, y);
    }
    ctx.restore();
  }
}
async function renderPage(page: NotebookPage) {
  const [widthMm, heightMm] = dimensionsMm(page.size, page.orientation);
  // ~150 dpi: readable text/strokes without creating huge mobile allocations.
  const width = Math.round(widthMm * 5.7);
  const height = Math.round(heightMm * 5.7);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر تشغيل محرّك الرسم المطلوب للتصدير.");
  putPaper(ctx, page, width, height);
  renderText(ctx, page.html, width, height);
  renderInk(ctx, page, width, height);
  await renderStickers(ctx, page, width, height);
  const data = canvas.toDataURL("image/jpeg", .91).split(",")[1];
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  // Release canvas memory before moving to the next sheet.
  canvas.width = 0; canvas.height = 0;
  return { bytes, width, height, widthPt: widthMm * 72 / 25.4, heightPt: heightMm * 72 / 25.4 };
}

type RasterPage = Awaited<ReturnType<typeof renderPage>>;
/** Minimal ISO PDF 1.4 writer with per-page JPEG images and exact physical page sizes. */
function buildPdf(pages: RasterPage[]): Blob {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const offsets: number[] = [0];
  const push = (bytes: Uint8Array) => { chunks.push(bytes); total += bytes.length; };
  const write = (s: string) => push(encoder.encode(s));
  const obj = (id: number, body: string, data?: Uint8Array) => {
    offsets[id] = total;
    write(String(id) + " 0 obj\n" + body);
    if (data) { write("\nstream\n"); push(data); write("\nendstream"); }
    write("\nendobj\n");
  };
  write("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  const refs = pages.map((_, i) => String(3 + i * 3) + " 0 R").join(" ");
  obj(2, "<< /Type /Pages /Count " + pages.length + " /Kids [" + refs + "] >>");
  pages.forEach((p, i) => {
    const pageId = 3 + i * 3;
    const contentId = pageId + 1, imageId = pageId + 2;
    const w = p.widthPt.toFixed(3), h = p.heightPt.toFixed(3);
    obj(pageId, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + w + " " + h +
      "] /Resources << /XObject << /Sheet " + imageId + " 0 R >> >> /Contents " + contentId + " 0 R >>");
    const command = "q\n" + w + " 0 0 " + h + " 0 0 cm\n/Sheet Do\nQ\n";
    obj(contentId, "<< /Length " + encoder.encode(command).length + " >>", encoder.encode(command));
    obj(imageId, "<< /Type /XObject /Subtype /Image /Width " + p.width +
      " /Height " + p.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
      p.bytes.length + " >>", p.bytes);
  });
  const xref = total;
  const count = 2 + pages.length * 3;
  write("xref\n0 " + (count + 1) + "\n0000000000 65535 f \n");
  for (let i = 1; i <= count; i++)
    write(String(offsets[i]).padStart(10, "0") + " 00000 n \n");
  write("trailer\n<< /Size " + (count + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF");
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return new Blob([result.buffer], { type: "application/pdf" });
}
export async function downloadNotebookPdf(book: Notebook, title: string) {
  if (typeof document === "undefined") throw new Error("تصدير PDF يتطلب واجهة التطبيق.");
  await document.fonts.ready;
  const pages: RasterPage[] = [];
  for (const page of book.pages) pages.push(await renderPage(page));
  const file = buildPdf(pages);
  const filename = (title.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim().slice(0, 80) || "MemoFlow") + ".pdf";
  const [{ files }, { isNative }] = await Promise.all([
    import("@/services/files"), import("@/services/platform"),
  ]);
  if (isNative()) {
    // Android/iOS WebViews don't reliably support <a download> for blob: URLs.
    // Use the binary-safe Capacitor Filesystem + native share/save chooser.
    const result = await files.share(file, filename, "تصدير دفتر MemoFlow بصيغة PDF");
    if (result === "unavailable")
      throw new Error("خدمة حفظ ومشاركة ملفات PDF غير متاحة على هذا الجهاز.");
    return;
  }
  await files.save(file, filename);
}
