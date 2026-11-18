const assert=require("node:assert/strict");
async function drawStationaryDot(page){
  await page.getByRole("tab",{name:"أقلام",exact:true}).click();await page.getByRole("button",{name:"قلم سلس",exact:true}).click();
  await page.getByRole("button",{name:"ضغط متوازن",exact:true}).click();
  const canvas=page.getByRole("img",{name:"مساحة الرسم بالقلم",exact:true}),marks=canvas.locator("path[data-stroke-id]");
  const count=await marks.count();await canvas.scrollIntoViewIfNeeded();
  const b=await canvas.boundingBox(),bar=await page.getByRole("navigation",{name:"شريط صفحات المذكرة",exact:true}).boundingBox();
  const x=b.x+b.width*.83,y=Math.max(190,Math.min(b.y+b.height*.2,bar.y-70)),cdp=await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchMouseEvent",{type:"mousePressed",x,y,button:"left",buttons:1,pointerType:"pen",force:.15});
  for(const force of [.9,.3])await cdp.send("Input.dispatchMouseEvent",{type:"mouseMoved",x,y,button:"left",buttons:1,pointerType:"pen",force});
  await cdp.send("Input.dispatchMouseEvent",{type:"mouseReleased",x,y,button:"left",pointerType:"pen"});await cdp.detach();
  assert.equal(await marks.count(),count+1);const id=await marks.last().getAttribute("data-stroke-id"),d=await marks.last().getAttribute("d");
  assert.ok(d.includes(" a "),"stationary pressure must paint a disk rather than a zero-area outline");
  const bounds=await marks.last().boundingBox();assert.ok(bounds.width>0&&bounds.height>0);
  return {id,d,count};
}
async function checkStationaryPen(page,readSaved){
  const {id,d,count}=await drawStationaryDot(page);
  const path=()=>page.locator(`[data-notebook-paper] path[data-stroke-id="${id}"]`);
  const saved=()=>page.getByRole("status").filter({hasText:/^(تم الحفظ في الخادم|محفوظة في الخادم)$/}).waitFor({timeout:20000});
  await saved();const s=JSON.parse(Buffer.from(readSaved().match(/data-json="([^"]+)"/)[1],"base64").toString()).pages.at(-1).strokes.at(-1);
  assert.ok(s.points.length>=3);assert.equal(s.controlPoints,undefined);
  assert.ok(s.points.every(p=>p[0]===s.points[0][0]&&p[1]===s.points[0][1]));
  assert.ok(s.pressures.some(p=>Math.abs(p-.9)<1e-6));assert.ok(Math.abs(s.pressures.at(-1)-.3)<1e-6);
  assert.equal(s.points.length,s.pressures.length);assert.equal(s.times.length,s.points.length);
  await page.getByRole("button",{name:"تراجع سريع",exact:true}).click();assert.equal(await path().count(),0);
  await page.getByRole("button",{name:"إعادة سريعة",exact:true}).click();assert.equal(await path().getAttribute("d"),d);await saved();
  await page.reload();await page.getByRole("tab",{name:"صفحة 2",exact:true}).click();assert.equal(await path().getAttribute("d"),d);
  await page.getByRole("tab",{name:"أقلام",exact:true}).click();await page.getByRole("button",{name:"ممحاة",exact:true}).click();
  await page.getByRole("button",{name:"مسح المسار كاملًا",exact:true}).click();await path().scrollIntoViewIfNeeded();
  const b=await path().boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
  assert.equal(await path().count(),0);assert.equal(await page.locator('[data-notebook-paper] path[data-stroke-id]').count(),count);
  await page.getByRole("button",{name:"تراجع سريع",exact:true}).click();assert.equal(await path().getAttribute("d"),d);
  await page.getByRole("button",{name:"قلم سلس",exact:true}).click();
}
function assertStationaryPdf(pdf,path){
  const images=[...pdf.toString("latin1").matchAll(/\/Subtype \/Image \/Width (\d+) \/Height (\d+)[\s\S]*?\/Filter \/FlateDecode \/Length (\d+) >>\nstream\n/g)];
  assert.equal(images.length,2);const im=images[1],w=+im[1],start=im.index+im[0].length;
  const p=require("node:zlib").inflateSync(pdf.subarray(start,start+(+im[3]))),dot=/^M ([\d.]+) ([\d.]+) a ([\d.]+)/.exec(path);assert.ok(dot);
  const x=(+dot[1]+(+dot[3]))/1000*w,y=+dot[2]/1000*w,r=Math.max(1,Math.floor(+dot[3]/1000*w*.5));let color=0;
  for(let yy=Math.floor(y)-r;yy<=Math.ceil(y)+r;yy++)for(let xx=Math.floor(x)-r;xx<=Math.ceil(x)+r;xx++){
    const i=(yy*w+xx)*3;if(p[i]>220&&p[i+1]<110&&p[i+2]>90&&p[i+2]<160)color++;
  }
  assert.ok(color>=4,"PDF must paint the stationary pressure disk at the retained coordinates");
}
module.exports={drawStationaryDot,checkStationaryPen,assertStationaryPdf};
