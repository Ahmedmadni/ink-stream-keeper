const assert = require("node:assert/strict");
const { writeFileSync } = require("node:fs");
const { inflateSync } = require("node:zlib");

async function checkInk(page) {
  const canvas = page.getByRole("img", { name: "مساحة الرسم بالقلم" });
  const marks = canvas.locator("[data-stroke-id]");
  assert.equal(await marks.count(), 1, "a real pointer gesture must save a stroke");
  const first = await marks.first().getAttribute("d");
  await page.getByRole("button", { name: "تراجع الرسم", exact: true }).click();
  assert.equal(await marks.count(), 0);
  await page.getByRole("button", { name: "إعادة الرسم", exact: true }).click();
  assert.equal(await marks.first().getAttribute("d"), first);

  await page.getByRole("button", { name: "تحديد وتحريك", exact: true }).click();
  await page.getByRole("button", { name: "تحديد كل الرسم", exact: true }).click();
  await marks.first().scrollIntoViewIfNeeded();
  let bounds = await marks.first().boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 35, bounds.y + bounds.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  assert.notEqual(await marks.first().getAttribute("d"), first);
  await page.getByRole("button", { name: "تراجع الرسم", exact: true }).click();
  assert.equal(await marks.first().getAttribute("d"), first);
  await page.getByRole("button", { name: "ممحاة", exact: true }).click();
  await marks.first().scrollIntoViewIfNeeded();
  bounds = await marks.first().boundingBox();
  await page.mouse.move(bounds.x - 20, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width + 20, bounds.y + bounds.height / 2, { steps: 8 });
  await page.mouse.up();
  assert.equal(await marks.count(), 0, "eraser drag crosses the stroke even when starting off it");
  await page.getByRole("button", { name: "تراجع الرسم", exact: true }).click();
  assert.equal(await marks.count(), 1, "a whole erase drag is one undo action");

  // Real Chromium pen input; synthetic DOM pointer events cannot exercise capture.
  await page.getByRole("button", { name: "قلم", exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  bounds = await canvas.boundingBox();
  const y = Math.max(50, Math.min(page.viewportSize().height - 90, bounds.y + bounds.height * .4));
  const x = bounds.x + bounds.width * .25;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, pointerType: "pen", force: .15 });
  for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseMoved", x: x + i * 5, y: y + i * 2, button: "left", buttons: 1, pointerType: "pen", force: .15 + i * .1,
  });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + 40, y: y + 16, button: "left", pointerType: "pen" });
  await cdp.detach();
  assert.equal(await marks.count(), 2);
  assert.notEqual(await marks.last().getAttribute("fill"), "none", "stylus pressure produces an outline");

  const logical = await page.locator("[data-notebook-paper] .prose-mf").evaluate((e) => e.clientWidth);
  const beforeResize = await marks.last().getAttribute("d");
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.locator("[data-notebook-paper] .prose-mf").evaluate((e) => e.clientWidth), logical);
    assert.equal(await marks.last().getAttribute("d"), beforeResize);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  }
  await page.setViewportSize({ width: 1024, height: 768 });
}

async function checkPdf(page, artifacts) {
  const result = await page.evaluate(async () => {
    const { createPage } = await import("/src/features/notebook/model.ts");
    const { createNotebookPdf } = await import("/src/features/notebook/pdf-export.ts");
    const { safePageHtml } = await import("/src/features/notebook/rich-content.ts");
    const image = document.createElement("canvas"); image.width = 60; image.height = 40;
    const ctx = image.getContext("2d"); ctx.fillStyle = "#00cc44"; ctx.fillRect(0, 0, 60, 40);
    const first = createPage({ size: "a5", orientation: "landscape", paper: "cornell" });
    first.html = '<h2 style="text-align:center">قيد محاسبي — VAT 15%</h2><p><strong>المدين</strong> والدائن <u>مراجعة عربية</u></p>' +
      '<table><tbody><tr><th>البيان</th><th>المبلغ</th></tr><tr><td style="background-color:#ff3344">إيراد المشروع</td><td>١٥٠٠ ريال</td></tr></tbody></table>' +
      '<p><img width="120" src="' + image.toDataURL() + '"></p>';
    first.stickers = [{ id: crypto.randomUUID(), kind: "calculator", x: .8, y: .65, scale: .12, color: "#2244ff" }];
    first.strokes = [{ id: crypto.randomUUID(), tool: "pen", color: "#112233", width: 4,
      points: [[300, 700], [400, 750], [600, 700]], pressures: [.2, 1, .4], smoothing: true }];
    const second = createPage({ size: "letter", paper: "ledger" });
    second.html = "<p>الصفحة الثانية</p>";
    const blob = await createNotebookPdf({ version: 1, pages: [first, second] });
    const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = "";
    for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
    let overflow = false, missingImage = false;
    try { await createNotebookPdf({ version: 1, pages: [{ ...first, html: "<p>نص طويل</p>".repeat(100) }] }); }
    catch (error) { overflow = String(error).includes("حدود الورقة"); }
    try { await createNotebookPdf({ version: 1, pages: [{ ...second, html: '<img src="https://unavailable.fixture.test/x.png">' }] }); }
    catch (error) { missingImage = String(error).includes("تضمين"); }
    const safe = safePageHtml('<p style="background-image:url(https://unavailable.fixture.test/leak)">سري</p><img src="https://unavailable.fixture.test/leak"><script>window.leak=1</script>');
    return { pdf: btoa(binary), overflow, missingImage, safe };
  });
  const pdf = Buffer.from(result.pdf, "base64");
  writeFileSync(artifacts + "/notebook-rich-arabic.pdf", pdf);
  assert.ok(result.overflow, "overflow is reported rather than silently cropped");
  assert.ok(result.missingImage, "unavailable external images must stop export");
  assert.ok(!result.safe.includes("https://") && !result.safe.includes("script"), "secure reader cannot request remote resources");
  assert.ok(pdf.includes(Buffer.from("/MediaBox [0 0 595.276 419.528]")), "A5 landscape physical dimensions");
  assert.ok(pdf.includes(Buffer.from("/MediaBox [0 0 612.000 792.000]")), "Letter physical dimensions");
  const header = /\/Subtype \/Image \/Width (\d+) \/Height (\d+)[\s\S]*?\/Filter \/FlateDecode \/Length (\d+) >>\nstream\n/.exec(pdf.toString("latin1"));
  assert.ok(header, "lossless PDF image must be present");
  const start = header.index + header[0].length;
  const pixels = inflateSync(pdf.subarray(start, start + Number(header[3])));
  assert.equal(pixels.length, Number(header[1]) * Number(header[2]) * 3);
  let red = 0, green = 0, blue = 0;
  for (let i = 0; i < pixels.length; i += 3) {
    const [r, g, b] = pixels.subarray(i, i + 3);
    if (r > 235 && g < 100 && b < 120) red++;
    if (r < 20 && g > 180 && b < 90) green++;
    if (r < 60 && g < 100 && b > 230) blue++;
  }
  assert.ok(red > 1000, "formatted table cell must be visible in PDF");
  assert.ok(green > 1000, "embedded image must be visible in PDF");
  assert.ok(blue > 1000, "accounting sticker must be visible in PDF");
}
module.exports = { checkInk, checkPdf };
