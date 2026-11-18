const assert = require("node:assert/strict");
async function checkStudioSpace(page, artifacts, readSaved) {
  await page.getByRole("button", { name: "إضافة صفحة", exact: true }).click();
  await page.getByRole("tab", { name: "ملصقات", exact: true }).click();
  await page.getByRole("button", { name: "ملصقات ملونة", exact: true }).click();
  await page.getByRole("button", { name: "إضافة ملصق سماعة ملونة", exact: true }).click();
  assert.ok(await page.locator('[data-notebook-paper] [aria-label="ملصق fl-stethoscope"] svg path').count() > 0);
  assert.equal(await page.locator('[data-notebook-paper] [aria-label="ملصق fl-stethoscope"]').evaluate(el=>getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
  await page.getByRole("tab", { name: "أقلام", exact: true }).click();
  await page.getByRole("button", { name: "قلم سلس", exact: true }).click();
  const canvas = page.getByRole("img", { name: "مساحة الرسم بالقلم", exact: true });
  await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
  const bar = await page.getByRole("navigation", { name: "شريط صفحات المذكرة", exact: true }).boundingBox();
  const y = Math.max(180, Math.min(box.y + box.height * .35, bar.y - 70)), x = box.x + box.width * .65;
  await page.mouse.move(x,y); await page.mouse.down();
  await page.mouse.move(x+20,y+10,{steps:4});await page.mouse.move(x+40,y-10,{steps:4});await page.mouse.move(x+80,y+10,{steps:5});await page.mouse.up();
  const ink=page.locator('[data-notebook-paper] path[data-stroke-id]');const d=await ink.first().getAttribute("d");
  await page.getByRole("button",{name:"تراجع سريع",exact:true}).click();assert.equal(await ink.count(),0);
  await page.getByRole("button",{name:"إعادة سريعة",exact:true}).click();assert.equal(await ink.first().getAttribute("d"),d);
  await page.getByRole("button",{name:"وضع التركيز",exact:true}).click();
  assert.equal(await page.getByRole("button",{name:"قلم سلس",exact:true}).count(),0);
  assert.ok(await canvas.isVisible());
  await page.screenshot({path:artifacts+"/studio-focus-tablet.png"});
  await page.getByRole("status").filter({hasText:/^(تم الحفظ في الخادم|محفوظة في الخادم)$/}).waitFor({timeout:20000});
  const book=JSON.parse(Buffer.from(readSaved().match(/data-json="([^"]+)"/)[1],"base64").toString());
  const stroke=book.pages.at(-1).strokes[0];assert.equal(stroke.controlPoints.length,stroke.points.length);assert.notDeepEqual(stroke.controlPoints,stroke.points);assert.equal(stroke.times.length,stroke.points.length);
  await page.reload();await page.getByRole("tab",{name:"صفحة 2",exact:true}).click();assert.equal(await ink.first().getAttribute("d"),d);
  assert.ok(await page.locator('[data-notebook-paper] [aria-label="ملصق fl-stethoscope"] svg path').count()>0);
  await page.setViewportSize({width:390,height:844});
  // Reload starts in the writing group. Selecting pens leaves focus mode.
  await page.getByRole("tab",{name:"أقلام",exact:true}).click();await page.getByRole("button",{name:"وضع التركيز",exact:true}).click();
  await page.screenshot({path:artifacts+"/studio-focus-mobile.png"});
  const compact=await page.getByRole("navigation",{name:"شريط صفحات المذكرة",exact:true}).boundingBox();assert.ok(compact.height<200);
  page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"حذف الصفحة",exact:true}).click();
  await page.setViewportSize({width:1024,height:768});await page.getByRole("tab",{name:"أقلام",exact:true}).click();
}
module.exports={checkStudioSpace};
