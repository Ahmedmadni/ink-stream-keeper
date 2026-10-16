import { useEffect, useRef, useState } from "react";
import { Layers, X, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { useNotes, useTasks } from "@/lib/data";
import {
  floatingSupported,
  floatingPermission,
  requestFloatingPermission,
  showFloating,
  hideFloating,
  type FloatingItem,
} from "@/services/floating";

function useItems(): FloatingItem[] {
  const { data: tasks } = useTasks();
  const { data: notes } = useNotes();
  const t = (tasks ?? []).filter((x) => !x.done).slice(0, 4).map((x) => ({ kind: "task" as const, title: x.title }));
  const n = (notes ?? []).slice(0, 2).map((x) => ({ kind: "note" as const, title: x.title || "ملاحظة" }));
  return [...t, ...n];
}

export function FloatingCardsSettings() {
  const items = useItems();
  const [preview, setPreview] = useState(false);

  async function startNative() {
    let ok = await floatingPermission();
    if (!ok) {
      toast("فعّل «الظهور فوق التطبيقات الأخرى» لـ MemoFlow ثم ارجع واضغط مرة أخرى");
      ok = await requestFloatingPermission();
      if (!ok) return;
    }
    await showFloating(items);
    toast.success("ظهرت البطاقة العائمة");
  }

  return (
    <>
      <div className="flex min-h-16 items-center gap-3 p-4">
        <Layers className="size-5" />
        <div className="flex-1">
          <p className="text-sm font-medium">بطاقات عائمة</p>
          <p className="text-xs text-muted-foreground">
            {floatingSupported() ? "تظهر فوق التطبيقات الأخرى (يحتاج إذناً خاصاً)" : "على أندرويد تظهر فوق التطبيقات الأخرى — جرّب النموذج هنا"}
          </p>
        </div>
        {floatingSupported() ? (
          <div className="flex gap-2">
            <button onClick={startNative} className="rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground">إظهار</button>
            <button onClick={() => hideFloating()} className="rounded-full border border-border px-3 py-1.5 text-xs">إخفاء</button>
          </div>
        ) : (
          <button onClick={() => setPreview((v) => !v)} className="rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground">
            {preview ? "إخفاء النموذج" : "عرض النموذج"}
          </button>
        )}
      </div>
      {preview && <FloatingPreview items={items} onClose={() => setPreview(false)} />}
    </>
  );
}

function FloatingPreview({ items, onClose }: { items: FloatingItem[]; onClose: () => void }) {
  const [pos, setPos] = useState({ x: 24, y: 120 });
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (d) setPos({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) });
    };
    const up = () => (drag.current = null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  return (
    <div
      dir="rtl"
      style={{ left: pos.x, top: pos.y }}
      className="glass-strong fixed z-[100] w-64 touch-none select-none rounded-3xl p-4 shadow-2xl"
      role="dialog"
      aria-label="نموذج البطاقة العائمة"
    >
      <div
        className="mb-2 flex cursor-grab items-center gap-2"
        onPointerDown={(e) => (drag.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y })}
      >
        <GripVertical className="size-4 text-muted-foreground" />
        <span className="flex-1 text-sm font-semibold">MemoFlow • تذكير</span>
        <button onClick={onClose} aria-label="إغلاق" onPointerDown={(e) => e.stopPropagation()}>
          <X className="size-4" />
        </button>
      </div>
      <ul className="space-y-1.5 text-sm">
        {items.length === 0 && <li className="text-muted-foreground">لا توجد عناصر حالياً</li>}
        {items.map((it, i) => (
          <li key={i} className="truncate">{it.kind === "task" ? "☐ " : "📝 "}{it.title}</li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted-foreground">اسحبها لأي مكان — هكذا تظهر فوق التطبيقات على أندرويد</p>
    </div>
  );
}
