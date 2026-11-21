import {expect,test} from "bun:test";
import {styleInk,previewInkStyle,type InkStylePatch} from "../src/features/notebook/ink-style";
import {createPage,parseNotebook,serializeNotebook,type InkStroke} from "../src/features/notebook/model";
import {InkHistory} from "../src/features/notebook/ink";
const pen=():InkStroke=>({id:crypto.randomUUID(),tool:"pen",color:"#123456",width:4,points:[[200,500],[800,500]],
  controlPoints:[[200,400],[800,400]],offset:[1,2],pressures:[.2,.8],pressureResponse:.6,times:[10,20],cuts:[[.4,.6]],span:[.1,.9],smoothing:false});
test("batch styles preserve immutable capture, edited geometry, cuts and untouched strokes",()=>{
  const a=pen(),b=pen(),all=[a,b],old=structuredClone(all);
  for(const aspect of [1,297/210,210/297]){
    const next=styleInk(all,new Set([a.id]),{color:"#abcdef",width:12,brush:"pencil"},aspect);
    expect(next[1]).toBe(b);expect(next[0]).toMatchObject({color:"#abcdef",width:12,brush:"pencil",pressureResponse:.6});
    for(const k of ["points","pressures","times","cuts","controlPoints","offset","span"] as const)expect(next[0][k]).toBe(a[k]);
  }
  expect(all).toEqual(old);
});
test("neutral edits retain references, and highlighters keep compositing and tool semantics",()=>{
  const a=pen(),s=[a];expect(styleInk(s,new Set([a.id]),{})).toBe(s);
  expect(styleInk(s,new Set([a.id]),{color:"#123456",width:4,brush:"solid"})).toBe(s);
  const h:InkStroke={...pen(),tool:"highlighter",pressureResponse:undefined,paintGroup:crypto.randomUUID()};
  const all=[a,h],ids=new Set(all.map(s=>s.id)),next=styleInk(all,ids,{color:"#ABCDEF",width:20});
  expect(next[1].tool).toBe("highlighter");expect(next[1].paintGroup).toBe(h.paintGroup);
  expect(()=>styleInk(all,ids,{brush:"pencil"})).toThrow("ضربات قلم فقط");
  expect(h.brush).toBeUndefined();
});
test("invalid values, budgets and width overflow reject the whole batch without mutation",()=>{
  const a=pen(),edge:InkStroke={...pen(),points:[[2,10],[500,10]],controlPoints:undefined,offset:undefined,pressures:undefined,pressureResponse:undefined,cuts:undefined,span:undefined};
  const all=[a,edge],ids=new Set(all.map(s=>s.id)),old=structuredClone(all);
  for(const aspect of [1,1.4,.7])expect(()=>styleInk(all,ids,{color:"#abcdef",width:40},aspect)).toThrow("خارج الورقة");
  expect(styleInk([edge],new Set([edge.id]),{color:"#abcdef"})[0].color).toBe("#abcdef");
  expect(styleInk([edge],new Set([edge.id]),{width:2})[0].width).toBe(2);
  for(const patch of [{width:0},{width:41},{width:NaN},{color:"url(x)"},{brush:"oil"},{points:[]}])expect(()=>styleInk(all,ids,patch as InkStylePatch)).toThrow();
  expect(()=>styleInk([a],new Set([a.id]),{brush:"pencil"},1,0)).toThrow("حجم الدفتر");
  expect(()=>styleInk(all,new Set(),{color:"#123456"})).toThrow();
  expect(()=>styleInk(all,ids,{},0)).toThrow();expect(all).toEqual(old);
});
test("style preview is non-mutating and reports failure without returning partial candidates",()=>{
  const a=pen(),all=[a],ids=new Set([a.id]),bad=previewInkStyle(all,ids,{width:NaN});
  expect(bad.source).toBe(all);expect(bad.strokes).toBe(all);expect(bad.changed).toBe(false);expect(bad.error).not.toBe("");
  const good=previewInkStyle(all,ids,{brush:"pencil"});expect(good.changed).toBe(true);expect(a.brush).toBeUndefined();
});
test("applied batch is one history step and survives notebook round-trip",()=>{
  const p=createPage(),a=pen(),b=pen();p.strokes=[a,b];
  const after={...p,strokes:styleInk(p.strokes,new Set([a.id,b.id]),{color:"#00aabb",brush:"pencil"})},h=new InkHistory();
  h.record(p.id,p,after);expect(h.undo(p.id)!.strokes).toBe(p.strokes);expect(h.canUndo(p.id)).toBe(false);
  expect(h.redo(p.id)!.strokes).toBe(after.strokes);
  expect(parseNotebook(serializeNotebook({version:1,pages:[after]}))!.pages[0].strokes).toEqual(after.strokes);
});
