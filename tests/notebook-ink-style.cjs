const assert=require("node:assert/strict");
const panel=page=>page.getByRole("dialog",{name:/^نمط الحبر/});
async function selectAll(page){
  await page.getByRole("tab",{name:"أقلام",exact:true}).click();
  await page.getByRole("button",{name:"تحديد وتحريك",exact:true}).click();
  await page.getByRole("button",{name:"تحديد كل الرسم",exact:true}).click();
  await page.getByRole("button",{name:"تعديل نمط الحبر",exact:true}).click();await panel(page).waitFor();
}
async function draft(page,brush=true){
  const p=panel(page);
  await p.getByLabel("تغيير لون التحديد",{exact:true}).check();await p.getByLabel("لون الحبر المحدد",{exact:true}).fill("#f04372");
  await p.getByLabel("تغيير سمك التحديد",{exact:true}).check();await p.getByLabel("سمك الحبر المحدد",{exact:true}).fill("12");
  if(brush){await p.getByLabel("تغيير خامة التحديد",{exact:true}).check();await p.getByLabel("خامة الحبر المحدد",{exact:true}).selectOption("pencil");}
}
const saved=page=>page.getByRole("status").filter({hasText:/^(تم الحفظ في الخادم|محفوظة في الخادم)$/}).waitFor({timeout:20000});
async function checkInkStyles(page,artifacts,readSaved){
  const decode=()=>JSON.parse(Buffer.from(readSaved().match(/data-json="([^"]+)"/)[1],"base64").toString()).pages.at(-1).strokes;
  await saved(page);const original=decode(),content=readSaved();
  const paths=()=>page.locator('[data-notebook-paper] path[data-stroke-id]').evaluateAll(es=>es.map(e=>({d:e.getAttribute("d"),brush:e.dataset.inkBrush,width:e.getAttribute("stroke-width")})));
  const before=await paths();await selectAll(page);assert.equal(await panel(page).getByRole("button",{name:"تطبيق نمط الحبر",exact:true}).isDisabled(),true);
  await draft(page);
  await panel(page).getByLabel("سمك الحبر المحدد",{exact:true}).fill("0");
  await panel(page).getByRole("alert").filter({hasText:"بين 1 و40"}).waitFor();
  assert.equal(await panel(page).getByRole("button",{name:"تطبيق نمط الحبر",exact:true}).isDisabled(),true);
  await panel(page).getByLabel("سمك الحبر المحدد",{exact:true}).fill("12");
  assert.deepEqual(await paths(),before);assert.equal(readSaved(),content,"preview cannot autosave paint changes");
  await page.setViewportSize({width:390,height:844});
  const box=await panel(page).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=392&&box.y>=0&&box.y+box.height<=845);
  await page.screenshot({path:artifacts+"/notebook-style-mobile.png"});
  await panel(page).getByRole("button",{name:"إلغاء نمط الحبر",exact:true}).focus();await page.keyboard.press("Control+z");
  assert.deepEqual(await paths(),before,"dialog shortcut must not undo notebook ink");
  await page.keyboard.press("Escape");await panel(page).waitFor({state:"hidden"});assert.deepEqual(await paths(),before);assert.equal(readSaved(),content);
  await page.setViewportSize({width:1024,height:768});await selectAll(page);await draft(page);
  await panel(page).getByRole("button",{name:"تطبيق نمط الحبر",exact:true}).click();await panel(page).waitFor({state:"hidden"});await saved(page);
  const styled=decode();assert.equal(styled.length,original.length);
  const geometry=s=>{const {color,width,brush,...rest}=s;return rest;};
  styled.forEach((s,i)=>{assert.equal(s.color,"#f04372");assert.equal(s.width,12);assert.equal(s.brush,"pencil");assert.deepEqual(geometry(s),geometry(original[i]));});
  await page.getByRole("button",{name:"تراجع سريع",exact:true}).click();await saved(page);assert.deepEqual(decode(),original);
  await page.getByRole("button",{name:"إعادة سريعة",exact:true}).click();await saved(page);assert.deepEqual(decode(),styled);
  await page.reload();await page.getByRole("tab",{name:"صفحة 2",exact:true}).click();
  assert.equal(await page.locator('[data-notebook-paper] path[data-ink-brush="pencil"]').count(),styled.length);
  assert.equal(await page.locator('[data-notebook-paper] pattern rect').first().getAttribute("fill"),"#f04372");
}
async function stylePencilForVault(page){await selectAll(page);await draft(page,false);await panel(page).getByRole("button",{name:"تطبيق نمط الحبر",exact:true}).click();await panel(page).waitFor({state:"hidden"});await saved(page);}
function assertStyledPdf(pdf){
  const images=[...pdf.toString("latin1").matchAll(/\/Subtype \/Image \/Width (\d+) \/Height (\d+)[\s\S]*?\/Filter \/FlateDecode \/Length (\d+) >>\nstream\n/g)];
  assert.equal(images.length,2);const im=images[1],start=im.index+im[0].length;
  const pixels=require("node:zlib").inflateSync(pdf.subarray(start,start+(+im[3])));let pink=0;
  for(let i=0;i<pixels.length;i+=3)if(pixels[i]>220&&pixels[i+1]<210&&pixels[i+2]>110&&pixels[i+2]<235)pink++;
  assert.ok(pink>100,"PDF exported from the actual styled note must contain its new pink pencil paint");
}
module.exports={checkInkStyles,stylePencilForVault,assertStyledPdf};
