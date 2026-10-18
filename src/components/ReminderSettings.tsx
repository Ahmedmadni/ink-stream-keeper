import { useEffect, useState } from "react";
import { Bell, Check, ChevronLeft, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isNative } from "@/services/platform";
import { requestNotificationPermission } from "@/hooks/use-task-reminders";
import {
  nativeReminderStatus,
  openNativeNotificationSettings,
  requestExactReminders,
  testNativeReminder,
} from "@/lib/native-reminders";

export function ReminderSettings() {
  const [status, setStatus] = useState<{ granted: boolean; exact: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const native = isNative();
  const refresh = async () => {
    if (native) setStatus(await nativeReminderStatus());
    else
      setStatus({
        granted: typeof Notification !== "undefined" && Notification.permission === "granted",
        exact: true,
      });
  };
  useEffect(() => {
    const update = () => {
      if (!document.hidden) void refresh().catch(() => undefined);
    };
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
    // Platform does not change during an installed session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر فتح إعدادات الإشعارات");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="p-4">
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          run(async () => {
            if (native && status?.granted) await openNativeNotificationSettings();
            else {
              const permission = await requestNotificationPermission();
              if (permission === "granted") toast.success("إشعارات التذكير مفعّلة");
              else
                toast.info(
                  native
                    ? "فعّل إشعارات MemoFlow من شاشة الهاتف، ثم ارجع للتطبيق."
                    : "اسمح بإشعارات هذا الموقع من إعدادات المتصفح.",
                );
            }
          })
        }
        className="flex min-h-12 w-full items-center gap-3 text-start disabled:opacity-50"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Bell className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">إشعارات التذكير</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {status?.granted
              ? "مفعّلة · اختر موعدًا من تفاصيل المهمة"
              : "السماح بتنبيهات المهام على الهاتف"}
          </span>
        </span>
        {busy ? (
          <Loader2 className="size-5 animate-spin" />
        ) : status?.granted ? (
          <Check className="size-5 text-success" />
        ) : (
          <ChevronLeft className="size-5 text-muted-foreground" />
        )}
      </button>
      {native && status?.granted && (
        <div className="mt-3 grid gap-2 ps-0 sm:ps-14">
          {!status.exact && (
            <button
              disabled={busy}
              onClick={() => run(requestExactReminders)}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-3 text-sm"
            >
              <Clock className="size-4" />
              السماح بالتذكير في موعده الدقيق
            </button>
          )}
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await testNativeReminder();
                toast.success("سيظهر إشعار تجريبي خلال ثوانٍ");
              })
            }
            className="min-h-11 rounded-xl border border-border px-3 text-sm"
          >
            تجربة إشعار
          </button>
        </div>
      )}
    </div>
  );
}
