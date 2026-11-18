import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { validateNotebook, type Notebook, type NotebookPage } from "./model";
import { pageLayout } from "./page-layout";
import { PageArtwork } from "./PageArtwork";
import { collectPdfText } from "./pdf-text";
import { buildNotebookPdf, MAX_EXPORT_BYTES } from "./pdf-writer";
export type PdfExportOptions = { searchable?: boolean };

export const PDF_DPI = 216;

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذر قراءة صورة الصفحة."));
    reader.readAsDataURL(blob);
  });
}

async function embedPageImages(sheet: HTMLElement, signal: AbortSignal) {
  for (const image of sheet.querySelectorAll("img")) {
    try {
      const source = image.getAttribute("src") || "";
      if (!source.startsWith("data:")) {
        const response = await fetch(new URL(source, location.href), { mode: "cors", credentials: "omit", signal });
        if (!response.ok) throw new Error("unavailable");
        const blob = await response.blob();
        if (!/^image\/(png|jpeg|gif|webp)$/.test(blob.type) || blob.size > 15 * 1024 * 1024)
          throw new Error("unsupported image");
        image.src = await dataUrl(blob);
      }
    } catch {
      throw new Error("تعذر تضمين إحدى الصور. افتح الصورة أو أدرج نسخة محلية منها ثم أعد تصدير PDF؛ لم يتم إنشاء ملف ناقص.");
    }
  }
}

/** Browser text shaping and the very same sheet geometry/CSS as the editor.
 * Never flatten rich HTML to textContent: tables, inline styles, Arabic joining,
 * lists and embedded images are rendered together before the ink/sticker layers. */
export async function renderNotebookPage(page: NotebookPage, { searchable = false }: PdfExportOptions = {}) {
  const layout = pageLayout(page);
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.inert = true;
  host.style.cssText = "position:fixed;left:-20000px;top:0;pointer-events:none;z-index:-1";
  const template = document.createElement("template");
  template.innerHTML = renderToStaticMarkup(createElement(PageArtwork, { page, remoteImages: true }));
  const sheet = template.content.firstElementChild as HTMLElement;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 20_000);
  let canvas: HTMLCanvasElement | undefined;
  try {
    // Fetch remote resources with explicit CORS/omitted credentials while the
    // subtree is inert. The live DOM only ever receives embedded data images.
    await embedPageImages(sheet, abort.signal);
    host.appendChild(sheet); document.body.appendChild(host);
    await document.fonts.ready;
    try {
      for (const image of sheet.querySelectorAll("img")) {
        await image.decode();
        if (!image.naturalWidth) throw new Error("empty");
      }
    } catch { throw new Error("تعذر تضمين إحدى الصور في PDF. أدرج نسخة محلية سليمة ثم أعد التصدير."); }
    const content = sheet.querySelector<HTMLElement>(".prose-mf")!;
    // Reject both vertical and horizontal overflow rather than cropping content.
    if (content.scrollHeight > content.clientHeight + 2 || content.scrollWidth > content.clientWidth + 2)
      throw new Error("محتوى الصفحة يتجاوز حدود الورقة. وزّع النص أو الجدول على صفحات إضافية ثم أعد تصدير PDF.");
    // html-to-image includes only fonts used by this sheet. Reusing the first
    // page's CSS silently drops a different Arabic font on later pages. Font
    // resource bytes are already cached internally; collect each page's set.
    const text = searchable ? collectPdfText(content, sheet, layout.widthMm * 72 / 25.4, layout.heightMm * 72 / 25.4) : [];
    const fontEmbedCSS = await getFontEmbedCSS(sheet);
    if (!fontEmbedCSS.includes("data:")) throw new Error("تعذر تضمين خط العربية في PDF. أعد فتح التطبيق وحاول مجددًا.");
    canvas = await toCanvas(sheet, { width: layout.width, height: layout.height,
      pixelRatio: PDF_DPI / 25.4 / (780 / 210), fontEmbedCSS,
      includeQueryParams: true, onImageErrorHandler: () => { throw new Error("تعذر تضمين صورة في PDF."); } });
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("تعذر تشغيل محرّك تصدير PDF.");
    // Lossless RGB/Flate keeps thin Arabic glyphs, ruled lines and tables crisp.
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const rgb = new Uint8Array(canvas.width * canvas.height * 3);
    for (let src = 0, dst = 0; src < pixels.length; src += 4) {
      rgb[dst++] = pixels[src]; rgb[dst++] = pixels[src + 1]; rgb[dst++] = pixels[src + 2];
    }
    const stream = new Blob([rgb]).stream().pipeThrough(new CompressionStream("deflate"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    return { bytes, width: canvas.width, height: canvas.height,
      widthPt: layout.widthMm * 72 / 25.4, heightPt: layout.heightMm * 72 / 25.4, fontEmbedCSS, text };
  } finally {
    clearTimeout(timer); abort.abort(); host.remove();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}

type RasterPage = Awaited<ReturnType<typeof renderNotebookPage>>;
export async function createNotebookPdf(book: Notebook, options: PdfExportOptions = {}): Promise<Blob> {
  if (typeof document === "undefined") throw new Error("تصدير PDF يتطلب واجهة التطبيق.");
  if (typeof CompressionStream === "undefined")
    throw new Error("تصدير PDF عالي الدقة يحتاج إصدارًا أحدث من المتصفح أو Android System WebView.");
  const valid = validateNotebook(book);
  const pages: RasterPage[] = [];
  let totalBytes = 0;
  for (let i = 0; i < valid.pages.length; i++) {
    try {
      const page = await renderNotebookPage(valid.pages[i], options);
      totalBytes += page.bytes.length;
      if (totalBytes > MAX_EXPORT_BYTES) throw new Error("حجم PDF كبير جدًا للجهاز. صدّر الدفتر على أجزاء أصغر.");
      pages.push(page);
    } catch (error) {
      throw new Error(`صفحة ${i + 1}: ${error instanceof Error ? error.message : "تعذر تصدير الصفحة."}`);
    }
  }
  return buildNotebookPdf(pages);
}
export async function downloadNotebookPdf(book: Notebook, title: string, options: PdfExportOptions = {}) {
  const file = await createNotebookPdf(book, options);
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
