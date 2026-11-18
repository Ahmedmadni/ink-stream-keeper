// Independent test-only parser. Never included in an application bundle.
async function extractPdfText(bytes) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await getDocument({ data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  try {
    const pages = [];
    for (let i = 1; i <= document.numPages; i++) {
      const page = await document.getPage(i), content = await page.getTextContent();
      // Words may be separate items without space items. This checks decoded
      // tokens/order, not exact clipboard whitespace or phrase-find support.
      const strings = content.items.map((item) => item.str ?? "");
      pages.push({ text: strings.join(" "), rawText: strings.join(""), items: content.items });
    }
    return pages;
  } finally { await document.destroy(); }
}
module.exports = { extractPdfText };
