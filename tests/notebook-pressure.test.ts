import { expect, test } from "bun:test";
import { createPage, parseNotebook, serializeNotebook, validateNotebook, type InkStroke } from "../src/features/notebook/model";
import { inkShape, hitStroke, moveInk, InkHistory } from "../src/features/notebook/ink";
import { eraseInkSegments, visibleInkRuns } from "../src/features/notebook/ink-segments";
import { insertInkPoint, splitInk } from "../src/features/notebook/ink-edit";
import { transformInk } from "../src/features/notebook/ink-transform";
const source = (): InkStroke => ({ id: crypto.randomUUID(), tool: "pen", width: 20, color: "#713bc9",
  points: [[200, 500], [800, 500]], pressures: [.25, .25], times: [10, 20], smoothing: false });

test("pressure response changes rendering and hit geometry without rewriting raw capture or stale caches", () => {
  const s = source(), raw = structuredClone(s), old = inkShape(s).d;
  for (const aspect of [1, 297/210, 210/297]) {
    const soft = {...s, pressureResponse: .5}, firm = {...s, pressureResponse: 1.5};
    expect(visibleInkRuns(soft, aspect)[0][0].r).toBe(6.25);
    expect(visibleInkRuns(s, aspect)[0][0].r).toBe(4.375);
    expect(visibleInkRuns(firm, aspect)[0][0].r).toBe(3.4375);
    expect(hitStroke(soft, [500, 500+5/aspect], [500, 500+5/aspect], .1, aspect)).toBe(true);
    expect(hitStroke(s, [500, 500+5/aspect], [500, 500+5/aspect], .1, aspect)).toBe(false);
    expect(inkShape(soft, aspect).d).not.toBe(inkShape(firm, aspect).d);
  }
  expect(inkShape({...s, pressureResponse: 1}).d).toBe(old);
  expect(inkShape(s).d).toBe(old); expect(s).toEqual(raw);
});

test("raw pressure and response survive movement, editing, cuts, splitting, transform, undo and reload", () => {
  const s={...source(), pressureResponse:.6}, ids=new Set([s.id]);
  const moved=moveInk([s],ids,10,10)[0];
  const edited=insertInkPoint(s,0);
  const cut=eraseInkSegments([s],[500,450],[500,550],6)[0];
  const split=splitInk([cut],ids).strokes, transformed=transformInk([s],ids,{scale:.75,rotation:30},297/210);
  for (const item of [moved,edited,cut,...split,...transformed]) {
    expect(item.pressures).toBe(s.pressures); expect(item.points).toBe(s.points); expect(item.times).toBe(s.times);
    expect(item.pressureResponse).toBe(.6); expect(inkShape(item).d).not.toMatch(/NaN|Infinity/);
  }
  const page=createPage(), history=new InkHistory();history.record(page.id,page,{...page,strokes:[s]});
  expect(history.undo(page.id)!.strokes).toEqual([]);expect(history.redo(page.id)!.strokes[0]).toBe(s);
  page.strokes=[s,cut,...split].map(stroke=>({...stroke,id:crypto.randomUUID()}));
  expect(parseNotebook(serializeNotebook({version:1,pages:[page]}))!.pages[0].strokes).toEqual(page.strokes);
});

test("pressure response rejects unsupported values and unpressured strokes without migrating old ink", () => {
  const p=createPage(), s=source();
  for (const pressureResponse of [0,.49,1.51,NaN,Infinity])
    expect(()=>validateNotebook({version:1,pages:[{...p,strokes:[{...s,pressureResponse}]}]})).toThrow();
  for (const bad of [{...s,pressures:undefined,pressureResponse:1},{...s,tool:"highlighter",pressureResponse:1}])
    expect(()=>validateNotebook({version:1,pages:[{...p,strokes:[bad]}]})).toThrow();
  p.strokes=[s];const parsed=parseNotebook(serializeNotebook({version:1,pages:[p]}))!;
  expect(parsed.pages[0].strokes[0].pressureResponse).toBeUndefined();
  expect(inkShape(parsed.pages[0].strokes[0]).d).toBe(inkShape(s).d);
});
