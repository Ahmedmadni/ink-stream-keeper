const assert = require("node:assert/strict");

async function checkTransformHandles(page, artifacts, source, readSavedContent) {
  const paper = page.locator("[data-notebook-paper]"), first = paper.locator(`[data-stroke-id="${source.id}"]`);
  const size = page.getByLabel("حجم الرسم المحدد بالمئة", { exact: true }), angle = page.getByLabel("زاوية تدوير الرسم المحدد", { exact: true });
  const panel = page.getByLabel("معاينة تغيير حجم الرسم وتدويره", { exact: true });
  const overlay = page.getByRole("group", { name: "مقابض التحويل المباشر", exact: true });
  const scale = (index = 0) => overlay.locator(`[data-transform-handle="scale"][data-transform-corner="${index}"]`);
  const rotate = overlay.locator('[data-transform-handle="rotate"]');
  const apply = page.getByRole("button", { name: "تطبيق تحويل الرسم", exact: true });
  const screen = (element) => element.evaluate((el) => {
    const p = new DOMPoint(el.cx.baseVal.value, el.cy.baseVal.value).matrixTransform(el.getScreenCTM());
    return { x: p.x, y: p.y };
  });
  const grip = async (element) => {
    await element.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
    return { from: await screen(element), center: await screen(overlay.locator("[data-transform-center]")) };
  };
  const toward = ({ from, center }, ratio) => ({ x: center.x + (from.x - center.x) * ratio, y: center.y + (from.y - center.y) * ratio });
  const beginMouse = async (element, ratio) => {
    const g = await grip(element), target = toward(g, ratio);
    await element.evaluate((el) => el.addEventListener("pointerdown", (event) => { el.dataset.qaPointer = String(event.pointerId); }, { once: true }));
    await page.mouse.move(g.from.x, g.from.y); await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 4 });
    return { ...g, target, pointerId: Number(await element.getAttribute("data-qa-pointer")) };
  };
  const values = async () => ({ size: await size.inputValue(), rotation: await angle.inputValue(), path: await first.getAttribute("d") });
  const unchanged = async (before, reason) => assert.deepEqual(await values(), before, reason);
  const open = () => page.getByRole("button", { name: "تغيير الحجم والتدوير", exact: true }).click();

  await page.getByRole("status").filter({ hasText: /^(تم الحفظ في الخادم|محفوظة في الخادم)$/ }).waitFor({ timeout: 20000 });
  const savedBefore = readSavedContent();
  await open(); assert.equal(await overlay.getByRole("slider").count(), 5);
  await scale().focus(); await scale().press("ArrowUp"); assert.equal(await size.inputValue(), "101");
  await scale().press("Shift+ArrowDown"); assert.equal(await size.inputValue(), "91");
  await rotate.focus(); await rotate.press("Shift+ArrowRight"); assert.equal(await angle.inputValue(), "15");
  await rotate.press("ArrowLeft"); assert.equal(await angle.inputValue(), "14");
  await rotate.press("Home"); assert.equal(await angle.inputValue(), "-180");
  await rotate.press("End"); assert.equal(await angle.inputValue(), "180");
  await rotate.press("ArrowRight"); assert.equal(await angle.inputValue(), "-179");
  await page.getByRole("button", { name: "إعادة ضبط المعاينة", exact: true }).click();
  await size.fill("90"); const beforeTap = await values(), tap = await grip(scale());
  await page.mouse.move(tap.from.x, tap.from.y); await page.mouse.down();
  assert.ok(await apply.isDisabled()); assert.ok(await size.isDisabled());
  assert.ok(await page.getByRole("button", { name: "150%", exact: true }).isDisabled());
  await page.mouse.up(); await unchanged(beforeTap, "grabbing and releasing must not change the draft");

  const pen = await page.context().newCDPSession(page), rotationGrip = await grip(rotate), radians = 25 * Math.PI / 180;
  const dx = rotationGrip.from.x - rotationGrip.center.x, dy = rotationGrip.from.y - rotationGrip.center.y;
  const target = { x: rotationGrip.center.x + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: rotationGrip.center.y + dx * Math.sin(radians) + dy * Math.cos(radians) };
  await pen.send("Input.dispatchMouseEvent", { type: "mousePressed", ...rotationGrip.from, button: "left", buttons: 1, pointerType: "pen", force: .5 });
  await pen.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...target, button: "left", buttons: 1, pointerType: "pen", force: .7 });
  assert.ok(await apply.isDisabled());
  await pen.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...target, button: "left", pointerType: "pen" }); await pen.detach();
  assert.ok(Math.abs(Number(await angle.inputValue()) - 25) <= .2, "the real Chromium pen must rotate the control");
  assert.equal(await size.inputValue(), "90");
  const baseline = await values();
  let active = await beginMouse(scale(2), 1.2);
  assert.notEqual(await size.inputValue(), baseline.size);
  await overlay.dispatchEvent("pointercancel", { pointerId: active.pointerId, pointerType: "mouse", isPrimary: true });
  await page.mouse.up(); await unchanged(baseline, "pointer cancellation restores pre-drag values");
  active = await beginMouse(scale(2), .9); await page.keyboard.press("Escape"); await page.mouse.up();
  await unchanged(baseline, "Escape cancels only the active drag"); assert.ok(await panel.isVisible());
  active = await beginMouse(scale(2), 1.1);
  const immediateSize = await scale(2).evaluate((el) => {
    el.dispatchEvent(new PointerEvent("lostpointercapture", { bubbles: true, pointerId: Number(el.dataset.qaPointer), pointerType: "mouse", isPrimary: true }));
    return document.querySelector('[aria-label="حجم الرسم المحدد بالمئة"]').value;
  });
  assert.equal(immediateSize, baseline.size, "lost capture restores the visible draft before another gesture can reuse it");
  await page.mouse.up(); await unchanged(baseline, "lost capture restores geometry and controls synchronously");
  active = await beginMouse(scale(2), 1.1);
  await scale(2).evaluate((el) => el.releasePointerCapture(Number(el.dataset.qaPointer)));
  await page.mouse.up(); await unchanged(baseline, "lost pointer capture restores the whole gesture");
  active = await beginMouse(scale(2), 1.1);
  await scale(2).evaluate((el) => {
    const pointerId = Number(el.dataset.qaPointer);
    el.releasePointerCapture(pointerId);
    // Release is pending until the browser processes capture. Exercise an up
    // in the same task, before lostpointercapture, without a timing delay.
    el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId, pointerType: "mouse", isPrimary: true }));
  });
  await page.mouse.up(); await unchanged(baseline, "a pending capture loss cannot finish the gesture");
  active = await beginMouse(scale(2), .9); await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.up(); await unchanged(baseline, "window blur cancels a held gesture");

  active = await beginMouse(scale(2), 1.05);
  // The expanded desktop editor keeps an A4 sheet at its natural width at 900px.
  // Narrow below the sheet width so the displayed geometry actually resizes.
  await page.setViewportSize({ width: 700, height: 768 });
  await page.waitForFunction((input) => !input.disabled, await size.elementHandle(), { timeout: 5000 });
  await page.mouse.up(); await unchanged(baseline, "resizing the displayed sheet rejects the held gesture");
  await page.setViewportSize({ width: 1024, height: 768 });
  for (const label of ["100%", "150%", "ملاءمة"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    const sheet = await paper.boundingBox();
    for (const handle of await overlay.getByRole("slider").all()) {
      const box = await handle.boundingBox(); assert.ok(box.width >= 43 && box.width <= 49 && box.height >= 43 && box.height <= 49, "handle targets retain at least 44 screen pixels without growing with page zoom");
      assert.ok(box.x >= sheet.x - 1 && box.y >= sheet.y - 1 && box.x + box.width <= sheet.x + sheet.width + 1 && box.y + box.height <= sheet.y + sheet.height + 1);
    }
  }
  active = await beginMouse(scale(2), 1.05);
  const sheet = await paper.boundingBox(), outsideX = Math.min(page.viewportSize().width - 5, sheet.x + sheet.width + 40);
  await page.mouse.move(outsideX, active.from.y, { steps: 3 });
  assert.ok(await scale(2).evaluate((el) => el.hasPointerCapture(Number(el.dataset.qaPointer))));
  await page.mouse.move(active.from.x, active.from.y, { steps: 3 }); await page.mouse.up();
  await unchanged(baseline, "a captured handle can leave the paper and return without losing the initial draft");
  await scale().evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.screenshot({ path: artifacts + "/notebook-direct-handles-tablet.png" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(850); // Expire the genuine pen palm-rejection window.
  const touch = await page.context().newCDPSession(page);
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  let finger = await grip(scale(2)), destination = toward(finger, .9);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [finger.from] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [destination] });
  assert.ok(await apply.isDisabled()); assert.notEqual(await size.inputValue(), baseline.size);
  await touch.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await unchanged(baseline, "touch cancellation restores the prior draft");
  finger = await grip(scale(2)); destination = toward(finger, .8);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [finger.from] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [destination] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: false }); await touch.detach();
  assert.ok(Math.abs(Number(await size.inputValue()) - 72) <= .2, "a finger resizes the mobile control");
  const pageNav = page.getByRole("navigation", { name: "شريط صفحات المذكرة", exact: true });
  await pageNav.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const bar = await pageNav.boundingBox();
  const app = await page.getByRole("navigation", { name: "التنقل الرئيسي", exact: true }).boundingBox();
  assert.ok(bar.y >= 0 && bar.y + bar.height <= app.y - 6);
  await page.screenshot({ path: artifacts + "/notebook-direct-handles-mobile.png" });
  await page.waitForTimeout(1100); assert.equal(readSavedContent(), savedBefore, "all direct manipulations are unsaved previews");
  await page.getByRole("button", { name: "إلغاء التحويل السريع", exact: true }).click(); assert.equal(await first.getAttribute("d"), source.path);

  await page.getByLabel("الكتابة بالقلم فقط", { exact: true }).check(); await open();
  const onlyPen = await values(), blocked = await page.context().newCDPSession(page), blockedGrip = await grip(scale(2));
  await blocked.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await blocked.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [blockedGrip.from] });
  await blocked.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [toward(blockedGrip, .9)] });
  await blocked.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await blocked.send("Emulation.setTouchEmulationEnabled", { enabled: false }); await blocked.detach();
  await unchanged(onlyPen, "pen-only mode rejects finger edits to the handles");
  const finalPen = await page.context().newCDPSession(page), finalGrip = await grip(scale(2)), finalPoint = toward(finalGrip, .9);
  await finalPen.send("Input.dispatchMouseEvent", { type: "mousePressed", ...finalGrip.from, button: "left", buttons: 1, pointerType: "pen", force: .5 });
  await finalPen.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...finalPoint, button: "left", buttons: 1, pointerType: "pen", force: .7 });
  await finalPen.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...finalPoint, button: "left", pointerType: "pen" }); await finalPen.detach();
  assert.ok(Math.abs(Number(await size.inputValue()) - 90) <= .2);
  await rotate.focus(); await rotate.press("Shift+ArrowRight");
  const finalPath = await first.getAttribute("d"); assert.notEqual(finalPath, source.path);
  await apply.click(); await page.getByLabel("الكتابة بالقلم فقط", { exact: true }).uncheck();
  await page.getByRole("button", { name: "تراجع الرسم", exact: true }).click(); assert.equal(await first.getAttribute("d"), source.path);
  await page.getByRole("button", { name: "إعادة الرسم", exact: true }).click(); assert.equal(await first.getAttribute("d"), finalPath);
  assert.equal(await paper.locator(`[data-stroke-id="${source.sibling.id}"]`).getAttribute("d"), source.sibling.d);
  await page.setViewportSize({ width: 1024, height: 768 });
  return { ...source, path: finalPath };
}
module.exports = { checkTransformHandles };
