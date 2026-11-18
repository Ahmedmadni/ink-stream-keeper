import { useEffect, useRef, useState } from "react";
import { X, ScanText, Download, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { NotebookPage } from "./model";
import { recognitionInput } from "./handwriting";

/** Experimental native recognition. Never auto-replace ink, auto-download a
 * language model, or treat a mocked test candidate as an accuracy measurement. */
export function HandwritingPanel({ page, selection, onClose, onAddPage }: {
  page: NotebookPage; selection: Set<string>; onClose: () => void;
  onAddPage: (text: string, font: "ruqaa" | "ibm") => boolean;
}) {
  const [status, setStatus] = useState<"checking" | "unsupported" | "missing" | "ready">("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [font, setFont] = useState<"ruqaa" | "ibm">("ruqaa");
  const epoch = useRef(0);
  const [source] = useState(() => {
    try { return { input: recognitionInput(page, selection), error: "" }; }
    catch (e) { return { input: null, error: e instanceof Error ? e.message : "تعذر قراءة الكتابة." }; }
  });
  useEffect(() => {
    let active = true;
    import("@/services/handwriting").then(({ handwriting }) => handwriting.status())
      .then((value) => { if (active) setStatus(!value.supported ? "unsupported" : value.ready ? "ready" : "missing"); })
      .catch(() => { if (active) { setStatus("unsupported"); setError("تعذر فحص محرك التعرف في هذه النسخة."); } });
    const hide = () => { if (document.hidden) { epoch.current++; setText(""); setCandidates([]); onClose(); } };
    document.addEventListener("visibilitychange", hide);
    return () => {
      active = false; epoch.current++; document.removeEventListener("visibilitychange", hide);
      void import("@/services/handwriting").then(({ handwriting }) => handwriting.cancel()).catch(() => {});
    };
  }, [onClose]);
  async function run(download: boolean) {
    const ticket = ++epoch.current;
    setBusy(true); setError("");
    try {
      const { handwriting } = await import("@/services/handwriting");
      if (download) { await handwriting.download(); if (ticket === epoch.current) setStatus("ready"); }
      else if (source.input) {
        const suggestions = await handwriting.recognize(source.input);
        if (ticket !== epoch.current) return;
        setCandidates(suggestions); setText(suggestions[0] || "");
        if (!suggestions.length) setError("لم يتعرف المحرك على هذا الجزء. جرب كلمة أو سطرًا أوضح.");
      }
    } catch (e) { if (ticket === epoch.current) setError(e instanceof Error ? e.message : "تعذرت العملية. أعد المحاولة."); }
    finally { if (ticket === epoch.current) setBusy(false); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-24px)] max-w-xl space-y-4 overflow-y-auto rounded-3xl border border-border bg-card p-4 shadow-xl sm:p-6 [&>button:last-child]:hidden">
      <header className="flex items-center justify-between gap-3">
        <div><DialogTitle className="font-bold">التعرف على الخط العربي · تجريبي</DialogTitle>
          <DialogDescription className="mt-1 text-xs leading-6 text-muted-foreground">اقتراحات تراجعها قبل حفظها بخط منسق في صفحة جديدة. تبقى الكتابة بالقلم محفوظة.</DialogDescription></div>
        <button type="button" aria-label="إغلاق التعرف على الخط" className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary" onClick={onClose}><X className="size-5"/></button>
      </header>
      <p className="rounded-xl bg-secondary p-3 text-sm leading-7">
        حدد كلمة أو سطرًا واحدًا لنتائج أفضل. راجع الأرقام والأسماء بعناية؛ دقة الكتابة العربية لم تعتمد بعد باختبار أقلام وأجهزة فعلية.
      </p>
      {status === "checking" && <p role="status" className="text-sm">فحص المحرك المحلي...</p>}
      {status === "unsupported" && <p role="status" className="text-sm leading-7">هذه النسخة لا توفر محرك التعرف المحلي. التجربة متاحة في أندرويد عند تضمين المحرك؛ يمكنك مواصلة الكتابة والرسم والتصدير هنا.</p>}
      {(status === "missing" || status === "ready") && <div className="space-y-3">
        <p className="text-xs leading-6 text-muted-foreground">التعرف يعمل على الجهاز بعد تنزيل نموذج العربية من Google (نحو 20 ميجابايت). لا يرسل ML Kit الحبر أو النص الناتج إلى Google؛ قد يرسل مقاييس أداء واستخدام ويتصل لتحديث النماذج.</p>
        <a href="https://developers.google.com/ml-kit/terms" target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">شروط ML Kit والخصوصية</a>
        <button type="button" disabled={busy || (status === "ready" && !source.input)} onClick={() => void run(status === "missing")}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin"/> : status === "missing" ? <Download className="size-4"/> : <ScanText className="size-4"/>}
          {busy ? "جارٍ التنفيذ..." : status === "missing" ? "تنزيل نموذج العربية" : "اقتراح نص من الحبر"}
        </button>
        {status === "ready" && <button type="button" disabled={busy} className="min-h-11 rounded-xl border border-border px-3 text-xs text-muted-foreground"
          onClick={async () => {
            const ticket = ++epoch.current; setBusy(true); setError("");
            try {
              const { handwriting } = await import("@/services/handwriting"); await handwriting.remove();
              if (ticket === epoch.current) { setStatus("missing"); setCandidates([]); setText(""); }
            } catch { if (ticket === epoch.current) setError("تعذر إزالة النموذج. أعد المحاولة لاحقًا."); }
            finally { if (ticket === epoch.current) setBusy(false); }
          }}>إزالة نموذج العربية من الجهاز</button>}
      </div>}
      {source.error && <p role="alert" className="text-sm text-destructive">{source.error}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!!candidates.length && <div className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="اقتراحات التعرف">
          {candidates.map((candidate, index) => <button type="button" key={index} onClick={() => setText(candidate)}
            className="min-h-11 rounded-xl border border-border bg-secondary px-3 text-sm">{candidate}</button>)}
        </div>
        <label className="block text-sm">راجع النص وعدله
          <textarea aria-label="النص المقترح للكتابة" value={text} onChange={(e) => setText(e.target.value)} maxLength={5000}
            className="mt-2 min-h-32 w-full rounded-xl border border-border bg-background p-3 text-2xl leading-10 outline-none"
            style={{ fontFamily: font === "ruqaa" ? '"Aref Ruqaa",serif' : '"IBM Plex Sans Arabic",sans-serif' }}/>
        </label>
        <label className="flex items-center gap-2 text-sm">خط الصفحة
          <select aria-label="خط النص المعترف به" value={font} onChange={(e) => setFont(e.target.value as "ruqaa" | "ibm")} className="min-h-11 rounded-xl border border-border bg-background px-3">
            <option value="ruqaa">عارف رقعة</option><option value="ibm">IBM Plex Sans Arabic</option>
          </select>
        </label>
        <button type="button" disabled={!text.trim() || busy} onClick={() => {
          try { if (onAddPage(text, font)) onClose(); else setError("تعذر إضافة الصفحة. تحقق من حد الصفحات ومساحة الحفظ قبل المحاولة مجددًا."); }
          catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ الصفحة."); }
        }}
          className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">حفظ صفحة بالنص المنسق</button>
      </div>}
    </DialogContent>
  </Dialog>;
}
