import { useSyncExternalStore } from "react";

function subscribe(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}
function onlineSnapshot() {
  return navigator.onLine;
}

/** An explicit limitation notice, not a claim of full offline synchronization. */
export function OfflineModeNotice() {
  const online = useSyncExternalStore(subscribe, onlineSnapshot, () => true);
  if (online) return null;
  return (
    <div role="status" className="mx-auto mb-3 max-w-3xl px-4 sm:px-5">
      <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-xs leading-6 text-foreground">
        وضع دون اتصال: يمكنك قراءة البيانات التي سبق تحميلها في هذه الجلسة.
        تعديلات المذكرات قد تُحفظ كمسودات على الجهاز، أما إنشاء المهام وتعديلها
        فيحتاجان إلى الإنترنت. لا تُغلق التطبيق قبل التأكد من حالة حفظ مسودتك.
      </p>
    </div>
  );
}
