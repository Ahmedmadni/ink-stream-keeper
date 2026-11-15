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
  let securePreviewRequests = 0;
  const watch = (request) => { if (request.url().includes("unavailable.fixture.test/leak")) securePreviewRequests++; };
  page.on("request", watch);
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
    second.html = '<p><span style="font-family:Aref Ruqaa">الصفحة الثانية — كتابة عربية بخط رقعة</span></p>';
    second.stickers = [{ id: crypto.randomUUID(), kind: "sci-neuron", x: .5, y: .5, scale: .24, color: "#224466", rotation: 25, presentation: "cutout" }];
    await document.fonts.load('20px "Aref Ruqaa"', "كتابة عربية");
    if (!document.fonts.check('20px "Aref Ruqaa"', "كتابة عربية")) throw new Error("Local Ruqaa font failed to load");
    const blob = await createNotebookPdf({ version: 1, pages: [first, second] });
    const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = "";
    for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
    const referenceBlob = await createNotebookPdf({ version: 1, pages: [second] });
    const referenceBytes = new Uint8Array(await referenceBlob.arrayBuffer()); let referenceBinary = "";
    for (let i = 0; i < referenceBytes.length; i += 16384) referenceBinary += String.fromCharCode(...referenceBytes.subarray(i, i + 16384));
    let overflow = false, missingImage = false;
    try { await createNotebookPdf({ version: 1, pages: [{ ...first, html: "<p>نص طويل</p>".repeat(100) }] }); }
    catch (error) { overflow = String(error).includes("حدود الورقة"); }
    try { await createNotebookPdf({ version: 1, pages: [{ ...second, html: '<img src="https://unavailable.fixture.test/x.png">' }] }); }
    catch (error) { missingImage = String(error).includes("تضمين"); }
    const safe = safePageHtml('<p style="background-image:url(https://unavailable.fixture.test/leak)">سري</p><img src="https://unavailable.fixture.test/leak"><script>window.leak=1</script>');
    return { pdf: btoa(binary), referencePdf: btoa(referenceBinary), overflow, missingImage, safe };
  });
  // Removing a URL from returned HTML is insufficient: a detached element can
  // already have started a request before sanitization finishes.
  await page.waitForTimeout(250);
  page.off("request", watch);
  assert.equal(securePreviewRequests, 0, "secure preview sanitization must never initiate external requests");
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
  const images = [...pdf.toString("latin1").matchAll(/\/Subtype \/Image \/Width (\d+) \/Height (\d+)[\s\S]*?\/Filter \/FlateDecode \/Length (\d+) >>\nstream\n/g)];
  assert.equal(images.length, 2);
  const artImage = images[1], artStart = artImage.index + artImage[0].length;
  const artPixels = inflateSync(pdf.subarray(artStart, artStart + Number(artImage[3])));
  const referencePdf = Buffer.from(result.referencePdf, "base64");
  const referenceImage = /\/Subtype \/Image \/Width (\d+) \/Height (\d+)[\s\S]*?\/Filter \/FlateDecode \/Length (\d+) >>\nstream\n/.exec(referencePdf.toString("latin1"));
  assert.ok(referenceImage);
  const referenceStart = referenceImage.index + referenceImage[0].length;
  const referencePixels = inflateSync(referencePdf.subarray(referenceStart, referenceStart + Number(referenceImage[3])));
  assert.ok(artPixels.equals(referencePixels), "a later page must retain its Arabic font exactly as when exported alone");
  let coloredArt = 0;
  for (let i = 0; i < artPixels.length; i += 3) {
    const r = artPixels[i], g = artPixels[i + 1], b = artPixels[i + 2];
    if (b > r + 25 && b > g + 8) coloredArt++;
  }
  assert.ok(coloredArt > 1000, "colored science SVG must survive PDF rasterization");
}
async function checkStudy(page, artifacts) {
  await page.getByRole("tab", { name: "ورق", exact: true }).click();
  for (const [label, value] of [["عمودان", "two-column"], ["مخطط أسبوعي", "weekly"], ["بطاقات مذاكرة", "flashcards"], ["موسيقى", "music"], ["رسم هندسي", "isometric"], ["شبكة سداسية", "hex"]]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    assert.equal(await page.locator("[data-notebook-paper]").getAttribute("data-notebook-paper"), value);
  }
  await page.getByRole("button", { name: "مربعات", exact: true }).click();
  await page.getByLabel("ملمس الورقة", { exact: true }).selectOption("grain");
  const spacing = page.getByLabel("تباعد سطور الورقة", { exact: true });
  const increase = await spacing.evaluate((e) => getComputedStyle(e).direction === "rtl" ? "ArrowLeft" : "ArrowRight");
  const decrease = increase === "ArrowLeft" ? "ArrowRight" : "ArrowLeft";
  await spacing.focus(); await spacing.press("Home");
  for (let i = 0; i < 4; i++) await spacing.press(increase);
  assert.equal(await spacing.inputValue(), "40");
  assert.equal(await page.locator("[data-notebook-paper] .prose-mf").evaluate((e) => getComputedStyle(e).lineHeight), "40px");
  await page.screenshot({ path: artifacts + "/notebook-paper-library.png", fullPage: true });
  await spacing.press(decrease); await spacing.press(decrease);
  await page.getByRole("tab", { name: "ملصقات", exact: true }).click();
  await page.getByLabel("بحث الملصقات", { exact: true }).fill("neuron");
  await page.getByRole("button", { name: "إضافة ملصق خلية عصبية", exact: true }).click();
  const neuron = page.getByRole("button", { name: "ملصق sci-neuron", exact: true });
  assert.ok(await neuron.locator("svg path").count() > 5);
  const rotation = page.getByLabel("دوران الملصق", { exact: true });
  const rotateIncrease = await rotation.evaluate((e) => getComputedStyle(e).direction === "rtl" ? "ArrowLeft" : "ArrowRight");
  await rotation.focus(); for (let i = 0; i < 3; i++) await rotation.press(rotateIncrease);
  assert.equal(await rotation.inputValue(), "15");
  assert.equal(await neuron.evaluate((e) => e.style.transform), "rotate(15deg)");
  assert.equal(await page.locator('[data-sticker-attribution="scisvg"]').count(), 1);
  await page.screenshot({ path: artifacts + "/notebook-science-library.png", fullPage: true });
  await page.getByRole("tab", { name: "رسم", exact: true }).click();
  await page.getByRole("button", { name: "مستطيل", exact: true }).click();
  const canvas = page.getByRole("img", { name: "مساحة الرسم بالقلم" });
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  const y = Math.max(190, Math.min(page.viewportSize().height - 200, bounds.y + bounds.height * .4));
  const count = await canvas.locator("[data-stroke-id]").count();
  await page.mouse.move(bounds.x + bounds.width * .16, y); await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .32, y + 40, { steps: 5 }); await page.mouse.up();
  assert.equal(await canvas.locator("[data-stroke-id]").count(), count + 1);
  await page.getByRole("button", { name: "تراجع الشكل", exact: true }).click();
  assert.equal(await canvas.locator("[data-stroke-id]").count(), count);
  await page.getByRole("button", { name: "إعادة الشكل", exact: true }).click();
  assert.equal(await canvas.locator("[data-stroke-id]").count(), count + 1);
  await page.getByRole("tab", { name: "أقلام", exact: true }).click();
  await page.getByRole("button", { name: "تحسين الخط والتعرف العربي", exact: true }).click();
  await page.getByRole("dialog").getByText("هذه النسخة لا توفر محرك التعرف المحلي.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "إغلاق التعرف على الخط", exact: true }).click();
}
module.exports = { checkInk, checkPdf, checkStudy };
