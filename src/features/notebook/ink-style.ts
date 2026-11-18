import { z } from "zod";
import { MAX_NOTEBOOK_BYTES, type InkStroke } from "./model";
import { visibleInkBounds, visibleInkRuns } from "./ink-segments";

const schema=z.object({color:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),width:z.number().finite().min(1).max(40).optional(),
  brush:z.enum(["solid","pencil"]).optional()}).strict();
export type InkStylePatch=z.infer<typeof schema>;
export type InkStylePreview={source:InkStroke[];strokes:InkStroke[];changed:boolean;error:string};
/** Explicit paint edits leave capture, editing geometry and eraser domains
 * intact. Preflight the complete selection before returning any replacement. */
export function styleInk(source:InkStroke[],ids:Set<string>,input:InkStylePatch,aspect=1,remainingBytes=MAX_NOTEBOOK_BYTES):InkStroke[]{
  const parsed=schema.safeParse(input);
  if(!parsed.success)throw Error("اختر لونًا صحيحًا وسمكًا بين 1 و40 وخامة مدعومة.");
  const patch=parsed.data;
  if(!Number.isFinite(aspect)||aspect<=0||!Number.isFinite(remainingBytes)||remainingBytes<0)throw Error("أبعاد المعاينة أو مساحة الحفظ غير صالحة.");
  const selected=source.filter(s=>ids.has(s.id));
  if(!selected.length)throw Error("حدد حبرًا لتعديل نمطه أولًا.");
  if(patch.brush!==undefined&&selected.some(s=>s.tool!=="pen"))throw Error("تغيير الخامة يحتاج تحديد ضربات قلم فقط. يمكنك تغيير لون المظلل وسمكه.");
  const next=source.map(s=>{
    if(!ids.has(s.id))return s;
    const color=patch.color!==undefined&&patch.color.toLowerCase()!==s.color.toLowerCase()?patch.color:s.color;
    const width=patch.width??s.width,brush=patch.brush===undefined?s.brush:patch.brush==="solid"?undefined:"pencil";
    if(color===s.color&&width===s.width&&brush===s.brush)return s;
    const changed={...s,color,width,brush};
    if(width>s.width){
      const b=visibleInkBounds(changed,aspect);let r=width/2;
      if(changed.tool==="pen"&&changed.pressures){r=0;for(const run of visibleInkRuns(changed,aspect))for(const p of run)r=Math.max(r,p.r);}
      if(b&&(b.x-r < -1e-5||b.y-r/aspect < -1e-5||b.x+b.width+r>1000.00001||b.y+b.height+r/aspect>1000.00001))
        throw Error("زيادة السمك قد تُخرج الحبر خارج الورقة. قلّل السمك أو حرّك التحديد إلى الداخل.");
    }
    return changed;
  });
  if(next.every((s,i)=>s===source[i]))return source;
  if(JSON.stringify(next).length-JSON.stringify(source).length>remainingBytes)throw Error("حجم الدفتر لا يسمح بهذا التعديل مع حفظ الأصل.");
  return next;
}
export function previewInkStyle(source:InkStroke[],ids:Set<string>,patch:InkStylePatch,aspect=1,remainingBytes=MAX_NOTEBOOK_BYTES):InkStylePreview{
  try{const strokes=styleInk(source,ids,patch,aspect,remainingBytes);return {source,strokes,changed:strokes!==source,error:""};}
  catch(error){return {source,strokes:source,changed:false,error:error instanceof Error?error.message:"تعذر تعديل نمط الحبر."};}
}
