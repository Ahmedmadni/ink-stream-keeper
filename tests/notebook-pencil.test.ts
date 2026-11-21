import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InkLayer } from "../src/features/notebook/InkMark";
import { createPage, parseNotebook, serializeNotebook, validateNotebook, type InkStroke } from "../src/features/notebook/model";
import { inkShape, moveInk } from "../src/features/notebook/ink";
import { eraseInkSegments } from "../src/features/notebook/ink-segments";
import { splitInk } from "../src/features/notebook/ink-edit";
import { transformInk } from "../src/features/notebook/ink-transform";
const pen=():InkStroke=>({id:crypto.randomUUID(),tool:"pen",color:"#222222",width:20,brush:"pencil",smoothing:false,
  points:[[100,500],[900,500]],pressures:[.5,.5],times:[1,2],pressureResponse:.6});

test("pencil retains shared pressure/erase geometry through split, movement, transform and reload",()=>{
  const s=pen(), ids=new Set([s.id]), cut=eraseInkSegments([s],[500,450],[500,550],10)[0];
  expect(inkShape(s).d).toBe(inkShape({...s,brush:undefined}).d);
  const parts=splitInk([cut],ids).strokes;
  expect(parts).toHaveLength(2);
  expect(parts.map(p=>inkShape(p).d).join(" ")).toBe(inkShape(cut).d);
  for(const p of [...parts,...moveInk([cut],ids,5,5),...transformInk([cut],ids,{scale:.8,rotation:10})]){
    expect(p.brush).toBe("pencil");expect(p.pressures).toBe(s.pressures);expect(p.points).toBe(s.points);expect(p.times).toBe(s.times);
  }
  const p=createPage();p.strokes=parts;
  expect(parseNotebook(serializeNotebook({version:1,pages:[p]}))!.pages[0].strokes).toEqual(parts);
});

test("pencil pattern references are local, unique and support both pressured fills and fixed-width strokes",()=>{
  const a=pen(),b={...pen(),pressures:undefined,pressureResponse:undefined};
  const html=renderToStaticMarkup(createElement(InkLayer,{strokes:[a,b],aspect:297/210}));
  const ids=[...html.matchAll(/<pattern id="([^"]+)"/g)].map(m=>m[1]);
  expect(new Set(ids).size).toBe(2);
  for(const id of ids)expect(html).toContain(`url(#${id})`);
  expect(html).toContain('fill="url(#');expect(html).toContain('stroke="url(#');
  expect(html).toContain('patternUnits="userSpaceOnUse"');
  expect(html).not.toMatch(/<image|<filter|<mask|href=|https:/);
  expect(renderToStaticMarkup(createElement(InkLayer,{strokes:[{...a,brush:undefined}]}))).not.toContain("<pattern");
});

test("unsupported brushes and highlighter texture reject safely; old ink has no texture field",()=>{
  const p=createPage(),s=pen();
  for(const bad of [{...s,brush:"oil"},{...s,tool:"highlighter"}])
    expect(()=>validateNotebook({version:1,pages:[{...p,strokes:[bad]}]})).toThrow();
  const old={...s,brush:undefined};p.strokes=[old];
  const parsed=parseNotebook(serializeNotebook({version:1,pages:[p]}))!.pages[0].strokes[0];
  expect(parsed.brush).toBeUndefined();expect(inkShape(parsed).d).toBe(inkShape(old).d);
});
