const assert=require("node:assert/strict");
async function drawPencil(page){
  await page.getByRole("tab",{name:"أقلام",exact:true}).click();
  await page.getByRole("button",{name:"قلم رصاص",exact:true}).click();
  const canvas=page.getByRole("img",{name:"مساحة الرسم بالقلم",exact:true}), marks=canvas.locator("path[data-stroke-id]");
  const before=await marks.count();await canvas.scrollIntoViewIfNeeded();
  const box=await canvas.boundingBox(),bar=await page.getByRole("navigation",{name:"شريط صفحات المذكرة",exact:true}).boundingBox();
  const x=box.x+box.width*.2,y=Math.max(190,Math.min(box.y+box.height*.35,bar.y-70)),length=box.width*.5;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+length,y,{steps:18});await page.mouse.up();
  assert.equal(await marks.count(),before+1);const d=await marks.last().getAttribute("d");
  assert.equal(await marks.last().getAttribute("data-ink-brush"),"pencil");
  assert.match(await marks.last().getAttribute("stroke"),/^url\(#pencil-/);
  return {canvas,marks,d};
}
async function checkPencil(page,artifacts,readSaved){
  const {canvas,marks,d}=await drawPencil(page);
  const definitions=()=>page.locator('[data-notebook-paper] pattern[data-pencil-grain="1"]');
  assert.equal(await definitions().count(),1);
  await page.getByRole("button",{name:"ممحاة",exact:true}).click();
  await page.getByRole("button",{name:"مسح جزء من المسار",exact:true}).click();
  await marks.last().scrollIntoViewIfNeeded();const b=await marks.last().boundingBox(),cx=b.x+b.width/2,cy=b.y+b.height/2;
  await page.mouse.move(cx,cy-20);await page.mouse.down();await page.mouse.move(cx,cy+20,{steps:8});await page.mouse.up();
  const cut=await marks.last().getAttribute("d");assert.notEqual(cut,d);assert.equal((cut.match(/M /g)||[]).length,2);
  await page.getByRole("button",{name:"تراجع سريع",exact:true}).click();assert.equal(await marks.last().getAttribute("d"),d);
  await page.getByRole("button",{name:"إعادة سريعة",exact:true}).click();assert.equal(await marks.last().getAttribute("d"),cut);
  await page.getByRole("status").filter({hasText:/^(تم الحفظ في الخادم|محفوظة في الخادم)$/}).waitFor({timeout:20000});
  const book=JSON.parse(Buffer.from(readSaved().match(/data-json="([^"]+)"/)[1],"base64").toString());
  assert.equal(book.pages.at(-1).strokes.at(-1).brush,"pencil");assert.ok(book.pages.at(-1).strokes.at(-1).cuts.length);
  await page.reload();await page.getByRole("tab",{name:"صفحة 2",exact:true}).click();
  const restored=page.locator('[data-notebook-paper] path[data-ink-brush="pencil"]');
  assert.equal(await restored.getAttribute("d"),cut);assert.equal(await definitions().count(),1);
  await page.screenshot({path:artifacts+"/notebook-pencil-reloaded.png"});
  await page.getByRole("tab",{name:"أقلام",exact:true}).click();await page.getByRole("button",{name:"قلم سلس",exact:true}).click();
}
module.exports={checkPencil,drawPencil};
