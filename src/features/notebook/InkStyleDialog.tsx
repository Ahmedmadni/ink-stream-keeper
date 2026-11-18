import { useEffect,useMemo,useState } from "react";
import { Dialog,DialogContent,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { InkLayer } from "./InkMark";
import { inkBounds } from "./ink";
import { previewInkStyle,type InkStylePreview } from "./ink-style";
import type { InkStroke } from "./model";

export type InkStyleSession={pageId:string;source:InkStroke[];ids:Set<string>;aspect:number;remainingBytes:number};
export function InkStyleDialog({session,onApply,onCancel}:{session:InkStyleSession;onApply:(preview:InkStylePreview)=>boolean;onCancel:()=>void}){
  const selected=session.source.filter(s=>session.ids.has(s.id)),first=selected[0];
  const [color,setColor]=useState(first?.color??"#293648"),[width,setWidth]=useState(String(first?.width??4));
  const [brush,setBrush]=useState<"solid"|"pencil">(first?.brush??"solid");
  const [editColor,setEditColor]=useState(false),[editWidth,setEditWidth]=useState(false),[editBrush,setEditBrush]=useState(false);
  const [applyError,setApplyError]=useState("");
  useEffect(()=>setApplyError(""),[color,width,brush,editColor,editWidth,editBrush]);
  const mixedColor=selected.some(s=>s.color.toLowerCase()!==first?.color.toLowerCase());
  const mixedWidth=selected.some(s=>s.width!==first?.width),mixedBrush=selected.some(s=>s.brush!==first?.brush);
  const preview=useMemo(()=>previewInkStyle(session.source,session.ids,{
    ...(editColor?{color}:{}),...(editWidth?{width:width.trim()?Number(width):NaN}:{}),...(editBrush?{brush}:{}),
  },session.aspect,session.remainingBytes),[session,color,width,brush,editColor,editWidth,editBrush]);
  const bounds=inkBounds(preview.strokes.filter(s=>session.ids.has(s.id)),session.aspect);
  const canBrush=selected.length>0&&selected.every(s=>s.tool==="pen");
  const button="min-h-11 rounded-xl border border-border bg-secondary px-4 text-sm font-semibold disabled:opacity-40";
  return <Dialog open onOpenChange={open=>{if(!open)onCancel();}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" aria-label="تعديل نمط الحبر المحدد">
    <DialogTitle className="ps-7">نمط الحبر · {selected.length} ضربة</DialogTitle>
    <DialogDescription>فعّل الخصائص التي تريد تغييرها. المعاينة للتحديد فقط؛ تُحفظ التغييرات عند التطبيق بخطوة تراجع واحدة.</DialogDescription>
    <div className="space-y-3">
      <div className="flex items-center gap-3"><label className="flex min-h-11 flex-1 items-center gap-2"><input type="checkbox" checked={editColor} onChange={e=>setEditColor(e.target.checked)} aria-label="تغيير لون التحديد"/>اللون {mixedColor&&!editColor&&<small className="text-muted-foreground">متعدد</small>}</label>
        <input type="color" disabled={!editColor} value={color} aria-label="لون الحبر المحدد" onChange={e=>setColor(e.target.value)} className="h-11 w-16"/></div>
      <div className="flex items-center gap-3"><label className="flex min-h-11 flex-1 items-center gap-2"><input type="checkbox" checked={editWidth} onChange={e=>setEditWidth(e.target.checked)} aria-label="تغيير سمك التحديد"/>السمك {mixedWidth&&!editWidth&&<small className="text-muted-foreground">متعدد</small>}</label>
        <input type="number" disabled={!editWidth} min={1} max={40} step={.5} value={width} aria-label="سمك الحبر المحدد" onChange={e=>setWidth(e.target.value)} className="min-h-11 w-24 rounded-lg border border-border bg-background px-2"/></div>
      <div className="flex items-center gap-3"><label className="flex min-h-11 flex-1 items-center gap-2"><input type="checkbox" disabled={!canBrush} checked={editBrush} onChange={e=>setEditBrush(e.target.checked)} aria-label="تغيير خامة التحديد"/>خامة القلم {mixedBrush&&!editBrush&&<small className="text-muted-foreground">متعدد</small>}</label>
        <select disabled={!editBrush} value={brush} aria-label="خامة الحبر المحدد" onChange={e=>setBrush(e.target.value as "solid"|"pencil")} className="min-h-11 rounded-lg border border-border bg-background px-2"><option value="solid">حبر مصمت</option><option value="pencil">قلم رصاص</option></select></div>
      {!canBrush&&<p className="text-xs text-muted-foreground">لتغيير الخامة، حدد ضربات قلم دون مظلل.</p>}
    </div>
    <svg role="img" aria-label="معاينة نمط الحبر المحدد" className="h-40 w-full rounded-xl border border-border bg-white" viewBox={bounds?`${bounds.x-30} ${bounds.y*session.aspect-30} ${Math.max(60,bounds.width+60)} ${Math.max(60,bounds.height*session.aspect+60)}`:"0 0 1000 200"}>
      <InkLayer strokes={preview.strokes.filter(s=>session.ids.has(s.id))} aspect={session.aspect}/>
    </svg>
    {preview.error&&<p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{preview.error}</p>}
    {applyError&&<p role="alert" className="text-sm text-destructive">{applyError}</p>}
    <div className="flex gap-2"><button type="button" className={button.replace("bg-secondary","bg-primary text-primary-foreground")} disabled={!preview.changed||!!preview.error} onClick={()=>{if(!onApply(preview))setApplyError("تعذر حفظ نمط الحبر. قلّل التعديل أو ألغِ المعاينة وراجع حالة المذكرة.");}}>تطبيق نمط الحبر</button>
      <button type="button" className={button} onClick={onCancel}>إلغاء نمط الحبر</button></div>
  </DialogContent></Dialog>;
}
