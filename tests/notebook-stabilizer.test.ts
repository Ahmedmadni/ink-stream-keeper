import { test, expect } from "bun:test";
import { stabilizePen } from "../src/features/notebook/pen-stabilizer";
import { createPage, serializeNotebook, parseNotebook, type InkStroke } from "../src/features/notebook/model";
import { inkShape, hitStroke } from "../src/features/notebook/ink";
const stroke = (): InkStroke => ({ id: crypto.randomUUID(), tool: "pen", color: "#123456", width: 4,
  points: [[100,200],[200,220],[220,180],[280,240],[400,200]], pressures: [.2,.4,.8,.3,.5], times: [1,2,3,4,5] });
test("stabilized control geometry retains raw capture and works in every page orientation", () => {
  for (const aspect of [1, 1.414, .707]) {
    const s=stroke(), before=JSON.stringify(s), next=stabilizePen(s,.55,aspect);
    expect(JSON.stringify(s)).toBe(before); expect(next.points).toBe(s.points); expect(next.pressures).toBe(s.pressures); expect(next.times).toBe(s.times);
    expect(next.controlPoints).toHaveLength(s.points.length); expect(next.controlPoints![0]).toEqual(s.points[0]); expect(next.controlPoints!.at(-1)).toEqual(s.points.at(-1));
    expect(inkShape(next,aspect).d).not.toMatch(/NaN|Infinity/); expect(inkShape(next,aspect).d).not.toBe(inkShape(s,aspect).d);
    expect(hitStroke(next,[100,200],[100,200],5,aspect)).toBe(true);
    const page=createPage();page.strokes=[next];expect(parseNotebook(serializeNotebook({version:1,pages:[page]}))!.pages[0].strokes[0]).toEqual(next);
  }
});
test("disabled, edited, clipped, short and highlighter strokes never change",()=>{
  const s=stroke();for(const value of [0,-1,2,NaN])expect(stabilizePen(s,value,1)).toBe(s);
  for(const other of [{...s,tool:"highlighter" as const},{...s,points:[s.points[0]]},{...s,controlPoints:s.points},{...s,cuts:[[.2,.4]] as [number,number][]}]) expect(stabilizePen(other,.5,1)).toBe(other);
});
