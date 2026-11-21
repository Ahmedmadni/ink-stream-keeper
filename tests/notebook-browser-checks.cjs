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
  await page.getByRole("button", { name: "مسح المسار كاملًا", exact: true }).click();
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

async function checkSegmentEraser(page, artifacts) {
  const canvas = page.getByRole("img", { name: "مساحة الرسم بالقلم" });
  const marks = canvas.locator("[data-stroke-id]");
  const count = await marks.count();
  await page.getByRole("button", { name: "قلم", exact: true }).click();
  await canvas.evaluate((e) => e.scrollIntoView({ block: "center" }));
  let bounds = await canvas.boundingBox();
  const controls = await page.getByRole("navigation", { name: "شريط صفحات المذكرة", exact: true }).boundingBox();
  const y = Math.max(190, Math.min(page.viewportSize().height - 210, controls.y - 25, bounds.y + bounds.height * .55));
  const x = bounds.x + bounds.width * .2, length = bounds.width * .5;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, pointerType: "pen", force: .3 });
  for (let i = 1; i <= 12; i++) await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + length * i / 12,
    y, button: "left", buttons: 1, pointerType: "pen", force: .3 + .05 * i });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + length, y, button: "left", pointerType: "pen" });
  await cdp.detach();
  assert.equal(await marks.count(), count + 1);
  const mark = marks.last(), id = await mark.getAttribute("data-stroke-id"), before = await mark.getAttribute("d");
  assert.notEqual(await mark.getAttribute("fill"), "none");
  await page.getByRole("button", { name: "ممحاة", exact: true }).click();
  await page.getByRole("button", { name: "مسح جزء من المسار", exact: true }).click();
  await mark.scrollIntoViewIfNeeded();
  bounds = await mark.boundingBox();
  const middleX = bounds.x + bounds.width / 2, middleY = bounds.y + bounds.height / 2;
  await page.mouse.move(middleX, middleY - 30); await page.mouse.down();
  await page.mouse.move(middleX, middleY + 30, { steps: 5 }); await page.mouse.up();
  assert.equal(await marks.count(), count + 1, "a middle erase preserves the original stroke identity");
  const after = await mark.getAttribute("d");
  assert.notEqual(after, before);
  assert.equal((after.match(/M /g) || []).length, 2, "the visible pressure outline has two separate pieces");
  await page.getByRole("button", { name: "تراجع الرسم", exact: true }).click();
  assert.equal(await mark.getAttribute("d"), before, "one undo restores the entire erase gesture");
  await page.getByRole("button", { name: "إعادة الرسم", exact: true }).click();
  assert.equal(await mark.getAttribute("d"), after);
  await mark.scrollIntoViewIfNeeded(); bounds = await mark.boundingBox();
  await canvas.evaluate((el) => el.addEventListener("pointerdown", (event) => { el.dataset.qaPointer = String(event.pointerId); }, { once: true }));
  await page.mouse.move(bounds.x + bounds.width * .2, bounds.y - 25); await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .2, bounds.y + bounds.height + 25, { steps: 3 });
  assert.notEqual(await mark.getAttribute("d"), after, "a held eraser gesture previews its cut");
  const pointerId = Number(await canvas.getAttribute("data-qa-pointer"));
  await canvas.dispatchEvent("pointercancel", { pointerId, pointerType: "mouse", isPrimary: true });
  await page.mouse.up();
  assert.equal(await mark.getAttribute("d"), after, "cancelling a gesture restores all its preview cuts");
  await page.getByRole("button", { name: "تحديد وتحريك", exact: true }).click();
  await mark.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const pick = await mark.evaluate((el) => {
    const point = el.getPointAtLength(el.getTotalLength() * .1);
    const screen = new DOMPoint(point.x, point.y).matrixTransform(el.getScreenCTM());
    return { x: screen.x, y: screen.y };
  });
  const pickX = pick.x, pickY = pick.y;
  await page.mouse.move(pickX, pickY); await page.mouse.down();
  await page.mouse.move(pickX + 15, pickY + 10, { steps: 4 }); await page.mouse.up();
  assert.notEqual(await mark.getAttribute("d"), after, "remaining pieces move together");
  await page.getByRole("button", { name: "تراجع الرسم", exact: true }).click();
  assert.equal(await mark.getAttribute("d"), after);
  await page.screenshot({ path: artifacts + "/notebook-segment-eraser.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "ممحاة", exact: true }).click();
  await canvas.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const pageNav = page.getByRole("navigation", { name: "شريط صفحات المذكرة", exact: true });
  const paper = await page.locator("[data-notebook-paper]").boundingBox();
  let pageBar = await pageNav.boundingBox();
  assert.ok(pageBar.y >= paper.y + paper.height - 1,
    "page controls remain in document flow below the paper rather than covering it");
  await pageNav.evaluate((el) => el.scrollIntoView({ block: "center" }));
  pageBar = await pageNav.boundingBox();
  const appBar = await page.getByRole("navigation", { name: "التنقل الرئيسي", exact: true }).boundingBox();
  assert.ok(pageBar.y >= 0 && pageBar.y + pageBar.height <= appBar.y - 6,
    "mobile page/pen controls must stay above the application navigation bar");
  await page.getByLabel("نوع الممحاة السريعة", { exact: true }).selectOption("stroke");
  assert.equal(await page.getByRole("button", { name: "مسح المسار كاملًا", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByLabel("نوع الممحاة السريعة", { exact: true }).selectOption("segment");
  await page.screenshot({ path: artifacts + "/notebook-eraser-mobile.png" });
  await page.setViewportSize({ width: 1024, height: 768 });
  return { id, path: after };
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
    first.strokes.push({ id: crypto.randomUUID(), tool: "pen", color: "#ef7800", width: 8,
      points: [[100, 900], [700, 900]], pressures: [.5, .5], smoothing: false, cuts: [[.45, .55]] });
    first.strokes.push({ id: crypto.randomUUID(), tool: "pen", color: "#713bc9", width: 20,
      points: [[120, 600], [400, 600]], pressures: [.25, .25], pressureResponse: .5, smoothing: false });
    const second = createPage({ size: "letter", paper: "ledger" });
    second.html = '<p><span style="font-family:Aref Ruqaa">الصفحة الثانية — كتابة عربية بخط رقعة</span></p>';
    second.stickers = [{ id: crypto.randomUUID(), kind: "sci-neuron", x: .5, y: .5, scale: .24, color: "#224466", rotation: 25, presentation: "cutout" }];
    second.stickers.push({ id: crypto.randomUUID(), kind: "fl-stethoscope", x: .8, y: .75, scale: .15, color: "#224466", presentation: "cutout" });
    await document.fonts.load('20px "Aref Ruqaa"', "كتابة عربية");
    if (!document.fonts.check('20px "Aref Ruqaa"', "كتابة عربية")) throw new Error("Local Ruqaa font failed to load");
    const blob = await createNotebookPdf({ version: 1, pages: [first, second] }, { searchable: true });
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
  const extracted = await require("./pdf-text-reader.cjs").extractPdfText(pdf);
  assert.ok(extracted[0].text.includes("قيد محاسبي"));
  assert.ok(extracted[0].text.includes("VAT 15%"));
  assert.ok(extracted[0].text.includes("إيراد المشروع"));
  assert.ok(extracted[1].text.includes("الصفحة الثانية"));
  assert.ok(result.overflow, "overflow is reported rather than silently cropped");
  assert.ok(result.missingImage, "unavailable external images must stop export");
  assert.ok(!result.safe.includes("https://") && !result.safe.includes("script"), "secure reader cannot request remote resources");
  assert.ok(pdf.includes(Buffer.from("/MediaBox [0 0 595.276 419.528]")), "A5 landscape physical dimensions");
  assert.ok(pdf.includes(Buffer.from("/MediaBox [0 0 612.000 792.000]")), "Letter physical dimensions");
  const license = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../src/features/notebook/assets/fluent/LICENSE.txt"), "utf8");
  assert.ok(pdf.includes(Buffer.from(Buffer.from(license, "utf16le").swap16().toString("hex").toUpperCase())), "export retains the full MIT license in document properties");
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
  const width = Number(header[1]), height = Number(header[2]);
  // The soft response radius is 6.25 page-width units; legacy is 4.375.
  // Check pixels outside the legacy footprint but inside the displayed one.
  let softPressurePixels=0;
  for(let y=Math.ceil(height*.6+width*.0048);y<=Math.floor(height*.6+width*.0057);y++)
    for(let x=Math.ceil(width*.2);x<=Math.floor(width*.3);x++){
      const o=(y*width+x)*3;
      if(pixels[o]>90&&pixels[o]<140&&pixels[o+1]>35&&pixels[o+1]<85&&pixels[o+2]>175)softPressurePixels++;
    }
  assert.ok(softPressurePixels>20,"PDF must apply the saved pressure response instead of reverting to legacy pressure");
  let visibleOrange = 0, gapOrange = 0;
  for (let y = Math.floor(height * .89); y <= Math.ceil(height * .91); y++)
    for (let x = Math.floor(width * .15); x <= Math.ceil(width * .41); x++) {
      const offset = (y * width + x) * 3;
      if (pixels[offset] > 210 && pixels[offset + 1] > 80 && pixels[offset + 1] < 160 && pixels[offset + 2] < 40) {
        if (x < width * .3) visibleOrange++; else if (x > width * .39) gapOrange++;
      }
    }
  assert.ok(visibleOrange > 100, "surviving pressure-ink pieces remain visible in PDF");
  assert.equal(gapOrange, 0, "PDF preserves the erased middle instead of reconnecting the captured samples");
  for (const [left, right] of [[.098, .0995], [.7005, .702]]) {
    let capOrange = 0;
    for (let y = Math.floor(height * .9) - 1; y <= Math.ceil(height * .9) + 1; y++)
      for (let x = Math.floor(width * left); x <= Math.ceil(width * right); x++) {
        const offset = (y * width + x) * 3;
        if (pixels[offset] > 210 && pixels[offset + 1] > 80 && pixels[offset + 1] < 160 && pixels[offset + 2] < 40) capOrange++;
      }
    assert.ok(capOrange > 2, "pressure ink must have round caps extending beyond both endpoints, without inward notches");
  }
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
  await checkEditingPdf(page, artifacts);
}

async function checkEditingPdf(page, artifacts) {
  const result = await page.evaluate(async () => {
    const { createPage } = await import("/src/features/notebook/model.ts");
    const { createNotebookPdf } = await import("/src/features/notebook/pdf-export.ts");
    const { splitInk, insertInkPoint, editInkPoint, deleteInkPoint } = await import("/src/features/notebook/ink-edit.ts");
    const { transformInk } = await import("/src/features/notebook/ink-transform.ts");
    const { transformFromHandle } = await import("/src/features/notebook/transform-handles.ts");
    const marker = { id: crypto.randomUUID(), tool: "highlighter", color: "#2f65d9", width: 30, smoothing: false,
      points: [[100, 200], [800, 800], [800, 200], [100, 800]], cuts: [[.45, .55]], times: [1, 2, 3, 4] };
    const retained = { id: crypto.randomUUID(), tool: "pen", color: "#dd2233", width: 8, smoothing: false,
      points: [[100, 900], [400, 900]], pressures: [.8, .8], controlPoints: [[100, 850], [400, 850]], offset: [200, 0] };
    const edited = deleteInkPoint(editInkPoint(insertInkPoint(retained, 0), 1, [450, 800]), 0);
    const handleOptions = transformFromHandle({ scale: 1, rotation: 0 }, { x: 450, y: 800, width: 150, height: 50 },
      [625, 825], [525, 825 + 100 / (210 / 148)], "rotate", 210 / 148);
    const transformed = transformInk([edited], new Set([edited.id]), handleOptions, 210 / 148)[0];
    const first = { ...createPage({ paper: "plain", size: "a5" }), html: "<p>اختبار تحرير الحبر</p>", strokes: [marker, transformed] };
    const second = { ...first, strokes: splitInk(first.strokes, new Set([marker.id])).strokes };
    const encode = async (sheet) => {
      const blob = await createNotebookPdf({ version: 1, pages: [sheet] });
      const bytes = new Uint8Array(await blob.arrayBuffer()); let raw = "";
      for (let i = 0; i < bytes.length; i += 16384) raw += String.fromCharCode(...bytes.subarray(i, i + 16384));
      return btoa(raw);
    };
    return { before: await encode(first), after: await encode(second) };
  });
  const decode = (encoded) => {
    const pdf = Buffer.from(encoded, "base64");
    const h = /\/Subtype \/Image \/Width (\d+) \/Height (\d+)[\s\S]*?\/Filter \/FlateDecode \/Length (\d+) >>\nstream\n/.exec(pdf.toString("latin1"));
    assert.ok(h); const start = h.index + h[0].length;
    return { width: Number(h[1]), height: Number(h[2]), pixels: inflateSync(pdf.subarray(start, start + Number(h[3]))), pdf };
  };
  const before = decode(result.before), after = decode(result.after);
  const pixel = (image, x, y) => {
    const offset = (Math.floor(image.height * y) * image.width + Math.floor(image.width * x)) * 3;
    return [...image.pixels.subarray(offset, offset + 3)];
  };
  const overlap = pixel(before, .45, .5);
  assert.ok(overlap[0] > 150 && overlap[0] < 235, "the marker crossing keeps the original single-stroke alpha");
  // SVG group alpha may round one 8-bit channel differently from path alpha.
  // Applying .34 twice would change this crossing by tens of RGB levels.
  assert.ok(pixel(after, .45, .5).every((value, i) => Math.abs(value - overlap[i]) <= 1),
    "split marker fragments must retain single-stroke opacity at their crossing");
  const red = pixel(after, .525, .825), hidden = pixel(after, .15, .9), removed = pixel(after, .35, .85);
  assert.ok(red[0] > 180 && red[1] < 90 && red[2] < 100, "PDF uses added/moved nodes and page translation");
  assert.ok(!(hidden[0] > 180 && hidden[1] < 90 && hidden[2] < 100), "PDF does not paint the retained source geometry");
  assert.ok(!(removed[0] > 180 && removed[1] < 90 && removed[2] < 100), "PDF omits the deleted endpoint's portion");
  const rotated = pixel(after, .5427364865, .7985714286), unrotated = pixel(after, .4875, .8125);
  assert.ok(rotated[0] > 180 && rotated[1] < 90 && rotated[2] < 100, "PDF rotates ink using the A5 sheet's true physical aspect ratio");
  assert.ok(!(unrotated[0] > 180 && unrotated[1] < 90 && unrotated[2] < 100), "PDF omits the pre-rotation centerline");
  writeFileSync(artifacts + "/notebook-fragment-edit.pdf", after.pdf);
}

async function checkInkEditing(page, artifacts, source) {
  const paper = page.locator("[data-notebook-paper]");
  const paths = paper.locator("[data-stroke-id]");
  const path = (id) => paper.locator(`[data-stroke-id="${id}"]`);
  const screenPoint = async (mark) => {
    await mark.evaluate((el) => el.scrollIntoView({ block: "center" }));
    return mark.evaluate((el) => {
      const p = el.getPointAtLength(el.getTotalLength() * .1);
      const s = new DOMPoint(p.x, p.y).matrixTransform(el.getScreenCTM());
      return { x: s.x, y: s.y };
    });
  };
  await page.getByRole("button", { name: "تحديد وتحريك", exact: true }).click();
  // Path-length positions can lie on the outline edge and miss hit testing
  // under another Chromium rasterizer. Aim through the center of a retained
  // fragment and verify the intended source was selected before splitting.
  await path(source.id).evaluate((el) => el.scrollIntoView({ block: "center" }));
  const sourceBounds = await path(source.id).boundingBox();
  let picked = false;
  for (const fraction of [.18, .82, .3, .7]) {
    await page.mouse.click(sourceBounds.x + sourceBounds.width * fraction, sourceBounds.y + sourceBounds.height / 2);
    picked = await path(source.id).evaluate((el) => el.style.filter.includes("drop-shadow"));
    if (picked) break;
  }
  assert.ok(picked, "the cut stroke is selected through its visible centerline");
  const before = await paths.evaluateAll((els) => els.map((el) => ({ id: el.dataset.strokeId, d: el.getAttribute("d") })));
  await page.getByRole("button", { name: "فصل الأجزاء الممسوحة", exact: true }).click();
  assert.equal(await paths.count(), before.length + 1);
  assert.equal(await path(source.id).count(), 0);
  for (const other of before.filter((stroke) => stroke.id !== source.id))
    assert.equal(await path(other.id).getAttribute("d"), other.d, "uncut strokes retain their paint when splitting the selection");
  const oldIds = new Set(before.map((s) => s.id));
  const created = (await paths.evaluateAll((els) => els.map((el) => ({ id: el.dataset.strokeId, d: el.getAttribute("d") })))).filter((s) => !oldIds.has(s.id));
  assert.equal(created.length, 2);
  assert.equal(created.map((s) => s.d).join(" "), source.path, "splitting preserves the existing pressure outline exactly");
  await page.getByRole("button", { name: "تراجع الرسم", exact: true }).click();
  assert.equal(await path(source.id).getAttribute("d"), source.path);
  await page.getByRole("button", { name: "إعادة الرسم", exact: true }).click();
  const first = path(created[0].id), second = path(created[1].id);
  const p = await screenPoint(first), b = await first.boundingBox();
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  const width = await paper.boundingBox(), distance = width.width * .4;
  await page.mouse.move(p.x + distance, p.y, { steps: 8 }); await page.mouse.up();
  assert.ok(Math.abs((await first.boundingBox()).x - b.x - distance) < 3, "the visible fragment moves freely despite hidden source endpoints");
  assert.equal(await second.getAttribute("d"), created[1].d, "moving one fragment leaves its sibling unchanged");
  await page.getByRole("button", { name: "تحرير نقاط المسار", exact: true }).click();
  const handle = paper.locator("[data-active-ink-node]");
  const pointScreen = async () => {
    await handle.evaluate((el) => el.scrollIntoView({ block: "center" }));
    return handle.evaluate((el) => {
      const p = new DOMPoint(el.cx.baseVal.value, el.cy.baseVal.value).matrixTransform(el.getScreenCTM());
      return { x: p.x, y: p.y };
    });
  };
  const preEdit = await first.getAttribute("d"), node = await pointScreen();
  await page.mouse.move(node.x, node.y); await page.mouse.down();
  await page.mouse.move(node.x, node.y - 25, { steps: 5 }); await page.mouse.up();
  const edited = await first.getAttribute("d"); assert.notEqual(edited, preEdit);
  await handle.focus(); await handle.press("Control+z"); assert.equal(await first.getAttribute("d"), preEdit);
  await handle.press("Control+Shift+z"); assert.equal(await first.getAttribute("d"), edited);
  const cancel = await pointScreen();
  await page.mouse.move(cancel.x, cancel.y); await page.mouse.down();
  await page.mouse.move(cancel.x - 15, cancel.y, { steps: 3 });
  assert.notEqual(await first.getAttribute("d"), edited);
  await page.keyboard.press("Escape"); await page.mouse.up();
  assert.equal(await first.getAttribute("d"), edited, "Escape rejects the whole point-drag preview");
  const xField = page.getByLabel("إحداثي نقطة المسار الأفقي", { exact: true });
  const newX = Number(await xField.inputValue()) + 1;
  await xField.fill(String(newX));
  await page.getByRole("button", { name: "تطبيق الإحداثيات", exact: true }).click();
  const numeric = await first.getAttribute("d"); assert.notEqual(numeric, edited);
  await page.getByRole("button", { name: "استعادة النقاط والموضع الأصليين", exact: true }).click();
  assert.equal(await first.getAttribute("d"), created[0].d, "reset restores capture geometry and position without revealing other fragments");
  await page.getByRole("button", { name: "تراجع الرسم", exact: true }).click();
  assert.equal(await first.getAttribute("d"), numeric);
  const pointPanel = page.getByLabel("إعدادات نقاط المسار", { exact: true });
  const pointCount = async () => Number((await pointPanel.locator("strong").textContent()).match(/من (\d+)/)[1]);
  const originalCount = await pointCount();
  await page.getByRole("button", { name: "إضافة نقطة للمسار", exact: true }).click();
  assert.equal(await pointCount(), originalCount + 1);
  const inserted = await first.getAttribute("d");
  await handle.focus(); await handle.press("Shift+ArrowUp");
  const topology = await first.getAttribute("d");
  assert.notEqual(topology, inserted, "an added node can be edited with the keyboard");
  await handle.press("Delete");
  assert.equal(await pointCount(), originalCount);
  assert.equal(await first.getAttribute("d"), numeric, "removing the added node restores the prior geometry");
  await handle.press("Control+z"); assert.equal(await first.getAttribute("d"), topology);
  await handle.press("Control+z"); assert.equal(await first.getAttribute("d"), inserted);
  await handle.press("Control+z"); assert.equal(await first.getAttribute("d"), numeric);
  await handle.press("Control+Shift+z"); assert.equal(await first.getAttribute("d"), inserted);
  await handle.press("Control+Shift+z"); assert.equal(await first.getAttribute("d"), topology);
  await handle.press("Control+Shift+z"); assert.equal(await first.getAttribute("d"), numeric);
  await handle.press("Control+z"); assert.equal(await first.getAttribute("d"), topology);
  assert.equal(await pointCount(), originalCount + 1, "retain an added node for the save/reload assertions");
  assert.equal(await second.getAttribute("d"), created[1].d);
  await page.screenshot({ path: artifacts + "/notebook-path-edit-tablet.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const touch = await pointScreen();
  await page.waitForTimeout(850); // Let the real pen palm-rejection window expire.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: touch.x, y: touch.y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: touch.x, y: touch.y - 12 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false }); await cdp.detach();
  assert.notEqual(await first.getAttribute("d"), topology, "a finger can drag the mobile editing handle");
  await page.getByRole("button", { name: "تراجع سريع", exact: true }).click();
  assert.equal(await first.getAttribute("d"), topology);
  await page.getByRole("button", { name: "إضافة نقطة سريعة", exact: true }).click();
  assert.equal(await pointCount(), originalCount + 2);
  await page.getByRole("button", { name: "حذف نقطة سريع", exact: true }).click();
  assert.equal(await first.getAttribute("d"), topology);
  await page.getByRole("button", { name: "تراجع سريع", exact: true }).click();
  assert.equal(await pointCount(), originalCount + 2);
  await page.getByRole("button", { name: "تراجع سريع", exact: true }).click();
  assert.equal(await first.getAttribute("d"), topology);
  const pageNav = page.getByRole("navigation", { name: "شريط صفحات المذكرة", exact: true });
  await pageNav.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const pageBar = await pageNav.boundingBox();
  const appBar = await page.getByRole("navigation", { name: "التنقل الرئيسي", exact: true }).boundingBox();
  assert.ok(pageBar.y >= 0 && pageBar.y + pageBar.height <= appBar.y - 6, "point actions remain above mobile navigation");
  await page.screenshot({ path: artifacts + "/notebook-path-edit-mobile.png" });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole("button", { name: "إنهاء تحرير النقاط", exact: true }).click();
  return { id: created[0].id, path: topology, sourceId: source.id, sibling: created[1], pointCount: originalCount + 1 };
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

async function checkInkTransforms(page, artifacts, source, readSavedContent) {
  const paper = page.locator("[data-notebook-paper]"), first = paper.locator(`[data-stroke-id="${source.id}"]`);
  const sibling = paper.locator(`[data-stroke-id="${source.sibling.id}"]`);
  const size = page.getByLabel("حجم الرسم المحدد بالمئة", { exact: true });
  const angle = page.getByLabel("زاوية تدوير الرسم المحدد", { exact: true });
  const panel = page.getByLabel("معاينة تغيير حجم الرسم وتدويره", { exact: true });
  const apply = page.getByRole("button", { name: "تطبيق تحويل الرسم", exact: true });
  const open = async () => page.getByRole("button", { name: "تغيير الحجم والتدوير", exact: true }).click();
  const selectFirst = async () => {
    await first.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const p = await first.evaluate((el) => {
      const point = el.getPointAtLength(el.getTotalLength() * .1);
      const s = new DOMPoint(point.x, point.y).matrixTransform(el.getScreenCTM());
      return { x: s.x, y: s.y };
    });
    await page.mouse.click(p.x, p.y);
  };
  await page.getByRole("status").filter({ hasText: /^(تم الحفظ في الخادم|محفوظة في الخادم)$/ }).waitFor({ timeout: 20000 });
  const savedBefore = readSavedContent();
  await open(); assert.ok(await apply.isDisabled());
  assert.ok(await page.getByRole("button", { name: "تصدير صفحات الدفتر PDF", exact: true }).isDisabled());
  assert.ok(await page.getByRole("button", { name: "إضافة صفحة", exact: true }).isDisabled());
  await size.fill("75"); await angle.fill("30");
  assert.notEqual(await first.getAttribute("d"), source.path);
  assert.equal(await sibling.getAttribute("d"), source.sibling.d);
  const count = await paper.locator("[data-stroke-id]").count();
  const canvas = page.getByRole("img", { name: "مساحة الرسم بالقلم", exact: true });
  await canvas.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * .1, 260); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .2, 280, { steps: 3 }); await page.mouse.up();
  assert.equal(await paper.locator("[data-stroke-id]").count(), count, "a transform preview cannot start a drawing gesture");
  await page.waitForTimeout(1100);
  assert.equal(readSavedContent(), savedBefore, "previewing must never enter autosave or modify the server note");
  await angle.fill("0"); await size.fill("400");
  await panel.getByRole("alert").filter({ hasText: "خارج الورقة" }).waitFor();
  assert.ok(await apply.isDisabled()); assert.equal(await first.getAttribute("d"), source.path);
  await size.press("Escape"); await panel.waitFor({ state: "hidden" });
  assert.equal(readSavedContent(), savedBefore);
  assert.equal(await first.getAttribute("d"), source.path);
  for (let repeat = 0; repeat < 3; repeat++) {
    await open(); await size.fill("75"); await angle.fill("30");
    await page.getByRole("tab", { name: "كتابة", exact: true }).click();
    await panel.waitFor({ state: "hidden" });
    assert.equal(await first.getAttribute("d"), source.path, "switching tool groups discards the unapplied preview immediately");
    assert.equal(readSavedContent(), savedBefore);
    await page.getByRole("tab", { name: "أقلام", exact: true }).click();
  }
  await open(); await size.fill("75"); await angle.fill("30");
  await panel.screenshot({ path: artifacts + "/notebook-transform-settings.png" });
  const transformed = await first.getAttribute("d");
  await apply.click(); await panel.waitFor({ state: "hidden" });
  assert.equal(await first.getAttribute("d"), transformed);
  await page.getByRole("button", { name: "تراجع الرسم", exact: true }).click();
  assert.equal(await first.getAttribute("d"), source.path);
  await page.getByRole("button", { name: "إعادة الرسم", exact: true }).click();
  assert.equal(await first.getAttribute("d"), transformed);
  const allPaths = () => paper.locator("[data-stroke-id]").evaluateAll((els) => els.map((el) => ({ id: el.dataset.strokeId, d: el.getAttribute("d") })));
  const beforeGroup = await allPaths();
  await page.getByRole("button", { name: "تحديد كل الرسم", exact: true }).click();
  await open(); await size.fill("75"); await angle.fill("-15");
  const grouped = await allPaths(); assert.notDeepEqual(grouped, beforeGroup);
  await apply.click();
  await page.getByRole("button", { name: "تراجع الرسم", exact: true }).click();
  assert.deepEqual(await allPaths(), beforeGroup, "one undo restores the complete group transformation");
  await page.getByRole("button", { name: "إعادة الرسم", exact: true }).click(); assert.deepEqual(await allPaths(), grouped);
  await page.getByRole("button", { name: "تراجع الرسم", exact: true }).click(); assert.deepEqual(await allPaths(), beforeGroup);
  await selectFirst(); await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "تحويل الرسم السريع", exact: true }).click(); await size.fill("50");
  assert.notEqual(await first.getAttribute("d"), transformed);
  await page.getByRole("button", { name: "إلغاء التحويل السريع", exact: true }).click();
  assert.equal(await first.getAttribute("d"), transformed);
  await page.getByRole("button", { name: "تحويل الرسم السريع", exact: true }).click();
  await size.fill("90"); await angle.fill("15");
  const final = await first.getAttribute("d"); assert.notEqual(final, transformed);
  await first.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const transformPageNav = page.getByRole("navigation", { name: "شريط صفحات المذكرة", exact: true });
  await transformPageNav.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const bar = await transformPageNav.boundingBox();
  const app = await page.getByRole("navigation", { name: "التنقل الرئيسي", exact: true }).boundingBox();
  assert.ok(bar.y >= 0 && bar.y + bar.height <= app.y - 6);
  await page.screenshot({ path: artifacts + "/notebook-transform-mobile.png" });
  const quick = await page.getByRole("button", { name: "تطبيق التحويل السريع", exact: true }).boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: quick.x + quick.width / 2, y: quick.y + quick.height / 2 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false }); await cdp.detach();
  await panel.waitFor({ state: "hidden" }); assert.equal(await first.getAttribute("d"), final);
  assert.equal(await sibling.getAttribute("d"), source.sibling.d);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: artifacts + "/notebook-transform-tablet.png", fullPage: true });
  return { ...source, path: final };
}
module.exports = { checkInk, checkPdf, checkStudy, checkSegmentEraser, checkInkEditing, checkInkTransforms };
