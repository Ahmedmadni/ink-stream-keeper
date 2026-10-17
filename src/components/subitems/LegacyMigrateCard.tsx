import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDownUp, Loader2 } from "lucide-react";
import { migrateLegacyTaskItems, subItemKeys } from "@/lib/subitems";

/**
 * بطاقة ترحيل البنود القديمة (Checklist + Subtasks) إلى نظام البنود الحالي.
 * تظهر فقط عند وجود بنود قديمة — لتجنب وجود أكثر من نظام بنود في الصفحة.
 */
export function LegacyMigrateCard({ taskId, count }: { taskId: string; count: number }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (count <= 0) return null;

  return (
    <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
      <p className="text-sm font-bold">لديك {count} بنداً بالنظام القديم</p>
      <p className="mt-1 text-xs text-muted-foreground">
        انقلها إلى «بنود المهمة» ليصبح لديك نظام واحد فقط بحساب إنجاز موحّد.
      </p>
      {err && <p className="mt-2 text-xs font-semibold text-destructive">{err}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await migrateLegacyTaskItems(taskId);
            qc.invalidateQueries({ queryKey: subItemKeys.list("task", taskId) });
            qc.invalidateQueries({ queryKey: ["task_checklist", taskId] });
            qc.invalidateQueries({ queryKey: ["subtasks", taskId] });
            qc.invalidateQueries({ queryKey: ["tasks"] });
            qc.invalidateQueries({ queryKey: ["task-sub-item-summaries"] });
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
        className="mt-3 inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-fab disabled:opacity-70"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowDownUp className="size-4" />}
        نقل البنود القديمة
      </button>
    </div>
  );
}
