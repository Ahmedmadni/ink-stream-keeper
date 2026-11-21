import {expect,test} from "bun:test";
import {inkShape,hitStroke} from "../src/features/notebook/ink";
import {eraseInkSegments,inkOutline} from "../src/features/notebook/ink-segments";
import {shouldCaptureInkSample} from "../src/features/notebook/ink-capture";
import {stabilizePen} from "../src/features/notebook/pen-stabilizer";
import {createPage,parseNotebook,serializeNotebook,type InkStroke} from "../src/features/notebook/model";
const s=():InkStroke=>({id:crypto.randomUUID(),tool:"pen",color:"#123456",width:20,points:[[100,100],[100,100],[100,100]],
  pressures:[.2,.8,.8],times:[1,2,3],smoothing:false});
test("stationary pressure paints a visible disk without rewriting capture",()=>{
  const source=s(),raw=structuredClone(source);
  for(const aspect of [1,297/210,210/297]){
    expect(inkShape(source,aspect).d).toBe(inkShape({...source,points:[[100,100]],pressures:[.8],times:[1]},aspect).d);
    expect(inkShape(source,aspect).d).toContain(" a ");
    expect(hitStroke(source,[100,100],[100,100],1,aspect)).toBe(true);
    expect(eraseInkSegments([source],[95,100],[105,100],2,aspect)).toEqual([]);
  }
  expect(source).toEqual(raw);const p=createPage();p.strokes=[source];
  expect(parseNotebook(serializeNotebook({version:1,pages:[p]}))!.pages[0].strokes[0]).toEqual(source);
  const relaxed={...source,pressures:[.2,.8,.1],smoothing:true};
  expect(inkShape(relaxed).d).toBe(inkShape({...source,points:[[100,100]],pressures:[.8],times:[1]}).d);
});
test("coincident edited controls stay visible with clipping and offset",()=>{
  const source:InkStroke={...s(),points:[[100,200],[200,300],[300,400]],controlPoints:[[400,400],[400,400],[400,400]],
    offset:[20,30],cuts:[[.3,.6]],span:[.1,.9]};
  const raw=structuredClone(source);
  for(const aspect of [1,1.4,.7]){
    const shape=inkShape(source,aspect);expect(shape.d).not.toMatch(/NaN|Infinity/);expect((shape.d.match(/ a /g)||[]).length).toBe(4);
    expect(hitStroke(source,[420,430],[420,430],1,aspect)).toBe(true);
    expect(eraseInkSegments([source],[415,430],[425,430],3,aspect)).toHaveLength(0);
  }
  expect(source).toEqual(raw);
});
test("stationary runs followed by movement retain the widest disk and normal path shape",()=>{
  const raw=[{x:10,y:20,r:2,t:0},{x:10,y:20,r:5,t:.3},{x:10,y:20,r:3,t:.4},{x:30,y:20,r:5,t:1}];
  const before=structuredClone(raw);
  expect(inkOutline(raw)).toBe(inkOutline([{x:10,y:20,r:5,t:0},{x:30,y:20,r:5,t:1}]));expect(raw).toEqual(before);
});
test("pressure-only capture is pen-move specific; release and duplicates don't fabricate taper samples",()=>{
  const source=s(),event={type:"pointermove",pointerType:"pen",pressure:.3};
  expect(shouldCaptureInkSample(source,[100,100],1,event)).toBe(true);
  for(const e of [{...event,pressure:.8},{...event,pressure:.805},{...event,type:"pointerup",pressure:0},{...event,pointerType:"mouse"},{...event,pointerType:"touch"},{...event,pressure:NaN}])
    expect(shouldCaptureInkSample(source,[100,100],1,e)).toBe(false);
  expect(shouldCaptureInkSample({...source,pressures:undefined},[100,100],1,event)).toBe(false);
  expect(shouldCaptureInkSample(source,[100.36,100],1,{...event,type:"pointerup",pressure:0})).toBe(true);
  expect(shouldCaptureInkSample(source,[100,100.2],2,{...event,pressure:.8})).toBe(true);
  expect(shouldCaptureInkSample(source,[100,100.2],1,{...event,pressure:.8})).toBe(false);
});
test("stabilization never invents geometry for a stationary pressure stroke",()=>{
  const source=s();for(const aspect of [1,1.4,.7])for(const strength of [.55,.75])expect(stabilizePen(source,strength,aspect)).toBe(source);
});
