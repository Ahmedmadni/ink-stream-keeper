import { useEffect, useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNotes, useTasks } from "@/lib/data";
import {
  floatingSupported,
  floatingStatus,
  showFloating,
  hideFloating,
  type FloatingItem,
} from "@/services/floating";

export function FloatingCardsSettings() {
  const { data: tasks } = useTasks();
  const { data: notes } = useNotes();
  const [status, setStatus] = useState({ granted: false, running: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!floatingSupported()) return;
    let active = true;
    const refresh = () => {
      if (document.hidden) return;
      void floatingStatus()
        .then((value) => {
          if (active) setStatus(value);
        })
        .catch(() => undefined);
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  if (!floatingSupported()) return null;
  const toggle = async () => {
    setBusy(true);
    try {
      if (status.running) await hideFloating();
      else {
        if (!status.granted)
          toast.info("اختر MemoFlow وفعّل «الظهور فوق التطبيقات الأخرى»، ثم ارجع للتطبيق.");
        const items: FloatingItem[] = [
          ...(tasks ?? [])
            .filter((task) => !task.done)
            .slice(0, 4)
            .map((task) => ({ kind: "task" as const, title: task.title })),
          ...(notes ?? [])
            .slice(0, 2)
            .map((note) => ({ kind: "note" as const, title: note.title || "مذكرة" })),
        ];
        await showFloating(items);
      }
      setStatus(await floatingStatus());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "تعذر إظهار البطاقة العائمة؛ راجع إذن الظهور فوق التطبيقات.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Layers className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">البطاقة العائمة</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {status.running
              ? "ظاهرة فوق التطبيقات الأخرى"
              : "اعرض أهم المهام أثناء استخدام تطبيقات أخرى."}
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={toggle}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 text-sm font-semibold disabled:opacity-50"
      >
        {busy && <Loader2 className="size-5 animate-spin" />}
        {busy
          ? "جارٍ فتح إعدادات الهاتف…"
          : status.running
            ? "إخفاء البطاقة"
            : status.granted
              ? "إظهار البطاقة"
              : "السماح وإظهار البطاقة"}
      </button>
    </div>
  );
}
