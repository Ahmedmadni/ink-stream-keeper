import { useEffect, useState } from "react";
import { Save, Trash2, PenLine } from "lucide-react";
import { clearPenFavorites, penFavoritesKey, readPenFavorites, writePenFavorite, type PenFavorites as Favorites, type PenPreset } from "./pen-favorites";

export function PenFavorites({scope,value,onUse}:{scope:string;value:PenPreset;onUse:(value:PenPreset)=>void}){
  const [data,setData]=useState<Favorites|null>(null),[error,setError]=useState(""),[status,setStatus]=useState("");
  useEffect(()=>{
    const refresh=()=>{try{setData(readPenFavorites(window.localStorage,scope));setError("");}
      catch{setData(null);setError("تعذر قراءة الأقلام المفضلة على هذا الجهاز. يمكنك إعادة ضبطها أو متابعة الرسم.");}};
    refresh();
    const changed=(e:StorageEvent)=>{if(e.key===null||e.key===penFavoritesKey(scope)){setStatus("");refresh();}};
    window.addEventListener("storage",changed);return()=>window.removeEventListener("storage",changed);
  },[scope]);
  const save=(slot:number,pen:PenPreset|null)=>{
    try{setData(writePenFavorite(window.localStorage,scope,slot,pen));setError("");setStatus(pen?`حُفظ إعداد القلم ${slot+1} على هذا الجهاز.`:`أُزيل القلم المفضل ${slot+1}.`);}
    catch{setError("تعذر حفظ إعدادات الأقلام على هذا الجهاز. حاول مجددًا؛ يمكنك متابعة الرسم.");setStatus("");}
  };
  return <details className="rounded-xl border border-border bg-secondary/20 px-3">
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">أقلامي المفضلة</summary>
    <p className="mb-2 text-xs leading-5 text-muted-foreground">ثلاثة أقلام لهذا الحساب على هذا الجهاز. تُستخدم إعداداتها للرسم الجديد.</p>
    <div className="space-y-2 pb-3">
      {[0,1,2].map(i=>{const pen=data?.pens[i];return <div key={i} className="flex items-center gap-1">
        <button type="button" aria-label={`استخدام القلم المفضل ${i+1}`} disabled={!pen} onClick={()=>{if(pen)onUse(pen);}}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-background px-2 text-sm disabled:opacity-50">
          <PenLine className="size-4 shrink-0" style={{color:pen?.color}}/><span className="text-start">قلم {i+1}<small className="ms-1 text-xs text-muted-foreground">{pen?`${pen.brush==="pencil"?"رصاص":"حبر"} · ${pen.width}`:"فارغ"}</small></span>
        </button>
        <button type="button" aria-label={`حفظ الإعدادات في القلم ${i+1}`} title={pen?"استبدال هذا القلم بالإعدادات الحالية":"حفظ إعدادات القلم الحالية"} disabled={!data}
          onClick={()=>save(i,value)} className="grid size-11 shrink-0 place-items-center rounded-xl bg-background disabled:opacity-40"><Save className="size-4"/></button>
        <button type="button" aria-label={`مسح القلم المفضل ${i+1}`} disabled={!pen} onClick={()=>save(i,null)}
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-background text-destructive disabled:opacity-40"><Trash2 className="size-4"/></button>
      </div>;})}
      {status&&<p role="status" className="text-xs text-primary">{status}</p>}
      {error&&<p role="alert" className="text-xs leading-5 text-destructive">{error}</p>}
      {error&&<button type="button" className="min-h-11 rounded-lg px-2 text-xs underline" onClick={()=>{
        try{clearPenFavorites(window.localStorage,scope);setData(readPenFavorites(window.localStorage,scope));setError("");setStatus("أُعيد ضبط الأقلام المفضلة لهذا الحساب على هذا الجهاز.");}
        catch{setError("تعذر إعادة ضبط إعدادات الأقلام على هذا الجهاز.");}
      }}>إعادة ضبط الأقلام المفضلة</button>}
    </div>
  </details>;
}
