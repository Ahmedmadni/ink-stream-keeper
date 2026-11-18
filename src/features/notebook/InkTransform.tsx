import { useLayoutEffect, useMemo } from "react";
import { Check, RotateCcw, RotateCw, X } from "lucide-react";
import type { InkStroke } from "./model";
import { previewInkTransform, type InkTransformPreview } from "./ink-transform";
import { draftTransformOptions, type InkTransformDraft } from "./transform-handles";

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-3 text-sm font-semibold disabled:opacity-40";
export function InkTransformPanel({ source, ids, aspect, remainingBytes, draft, onDraft, dragging, onPreview, onApply, onCancel }: {
  source: InkStroke[]; ids: Set<string>; aspect: number; remainingBytes: number;
  draft: InkTransformDraft; onDraft: (draft: InkTransformDraft) => void; dragging: boolean;
  onPreview: (preview: InkTransformPreview) => void; onApply: (preview: InkTransformPreview) => void; onCancel: () => void;
}) {
  const { size, rotation } = draft;
  const preview = useMemo(() => previewInkTransform(source, ids,
    draftTransformOptions({ size, rotation }), aspect, remainingBytes),
  [source, ids, size, rotation, aspect, remainingBytes]);
  // Canvas and quick-apply controls must describe the same draft before paint.
  useLayoutEffect(() => { onPreview(preview); }, [preview, onPreview]);
  const rotate = (delta: number) => {
    const value = Number(rotation);
    onDraft({ ...draft, rotation: String((((Number.isFinite(value) ? value : 0) + delta + 180) % 360 + 360) % 360 - 180) });
  };
  return <div className="space-y-3" aria-label="معاينة تغيير حجم الرسم وتدويره">
    <div className="flex flex-wrap items-center justify-between gap-2"><strong>حجم الرسم وتدويره · {ids.size} ضربة</strong>
      <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs text-primary">معاينة قبل التطبيق</span></div>
    <div className="grid grid-cols-2 gap-3">
      <label className="text-xs">الحجم %<input type="number" min={25} max={400} step={.1} value={size} disabled={dragging} dir="ltr" aria-label="حجم الرسم المحدد بالمئة"
        onChange={(event) => onDraft({ ...draft, size: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm disabled:opacity-50"/></label>
      <label className="text-xs">التدوير °<input type="number" min={-180} max={180} step={.1} value={rotation} disabled={dragging} dir="ltr" aria-label="زاوية تدوير الرسم المحدد"
        onChange={(event) => onDraft({ ...draft, rotation: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm disabled:opacity-50"/></label>
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button} disabled={dragging} onClick={() => rotate(90)}><RotateCw className="size-4"/>90° يمين</button>
      <button type="button" className={button} disabled={dragging} onClick={() => rotate(-90)}><RotateCcw className="size-4"/>90° يسار</button>
      <button type="button" className={button} disabled={dragging} onClick={() => onDraft({ size: "100", rotation: "0" })}>إعادة ضبط المعاينة</button>
    </div>
    <p className="text-xs leading-6 text-muted-foreground">يتحول الحبر المحدد حول مركزه على الورقة، مع ثبات سُمك الخط. لا تتغير النصوص أو الملصقات. افحص الرسم ثم طبّق أو ألغِ؛ Escape يلغي المعاينة.</p>
    <details className="text-xs leading-6 text-muted-foreground"><summary className="flex min-h-11 cursor-pointer items-center">إرشادات المقابض والكيبورد</summary>
      <p>اسحب أحد مربعات الزوايا لتغيير الحجم، أو المقبض الدائري للتدوير. الأسهم تضبط المقبض المحدد، ومع Shift تكون الخطوة أكبر؛ أثناء السحب يثبت Shift الحجم كل 10% أو الزاوية كل 15°. Escape أثناء السحب يعيد قيم ما قبله، وHome/End ينتقلان لحدود المجال.</p>
    </details>
    {preview.error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{preview.error} تُعرض الرسمة قبل التحويل.</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button.replace("bg-secondary", "bg-primary text-primary-foreground")} disabled={dragging || !preview.changed || !!preview.error}
        onClick={() => onApply(preview)}><Check className="size-4"/>تطبيق تحويل الرسم</button>
      <button type="button" className={button} onClick={onCancel}><X className="size-4"/>إلغاء تحويل الرسم</button>
    </div>
  </div>;
}
