import { Capacitor, registerPlugin } from "@capacitor/core";
import { isNative } from "@/services/platform";
import type { LocalNotificationsPlugin } from "@capacitor/local-notifications";

type ReminderTask = {
  id: string;
  title: string;
  reminder_at: string | null;
  due_at?: string | null;
  done?: boolean;
};
const settings = registerPlugin<{ openNotifications(): Promise<void> }>("MemoFlowDeviceSettings");
export const REMINDER_PERMISSION_EVENT = "memoflow:reminder-permission";

function numId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1_999_999_999) + 1;
}

let notificationPlugin: LocalNotificationsPlugin | null = null;
async function plugin(): Promise<LocalNotificationsPlugin> {
  if (!isNative()) throw new Error("التذكيرات الأصلية متاحة داخل التطبيق فقط");
  // The package's JS entry only registers this native bridge. Register lazily
  // through the already loaded core instead of fetching another JS chunk while
  // an Android permission request is pending.
  notificationPlugin ??= registerPlugin<LocalNotificationsPlugin>("LocalNotifications");
  return notificationPlugin;
}

export async function nativeReminderStatus() {
  const LN = await plugin();
  const permission = await LN.checkPermissions();
  const enabled = await LN.areEnabled();
  const exact =
    Capacitor.getPlatform() === "android"
      ? (await LN.checkExactNotificationSetting()).exact_alarm === "granted"
      : true;
  return {
    permission: permission.display,
    granted: permission.display === "granted" && enabled.value,
    exact,
  };
}

export async function openNativeNotificationSettings() {
  await settings.openNotifications();
}

export async function requestNativePermission(): Promise<boolean> {
  if (!isNative()) return false;
  const LN = await plugin();
  const cur = await nativeReminderStatus();
  if (cur.granted) return true;
  if (cur.permission === "denied" || cur.permission === "granted") {
    await openNativeNotificationSettings();
    return false;
  }
  const r = await LN.requestPermissions();
  if (r.display === "granted") window.dispatchEvent(new Event(REMINDER_PERMISSION_EVENT));
  return r.display === "granted";
}

export async function requestExactReminders() {
  await (await plugin()).changeExactNotificationSetting();
  window.dispatchEvent(new Event(REMINDER_PERMISSION_EVENT));
}

export async function testNativeReminder() {
  await (
    await plugin()
  ).schedule({
    notifications: [
      {
        id: 2_000_000_001,
        title: "MemoFlow — الإشعارات تعمل",
        body: "ستصلك تذكيرات المهام هنا بعد تحديد موعدها.",
        schedule: { at: new Date(Date.now() + 5_000) },
        isExactNotification: false,
      },
    ],
  });
}

let syncQueue: Promise<void> = Promise.resolve();
export function syncNativeReminders(tasks: ReminderTask[]): Promise<void> {
  if (!isNative()) return Promise.resolve();
  syncQueue = syncQueue
    .catch(() => undefined)
    .then(async () => {
      const LN = await plugin();
      const status = await nativeReminderStatus();
      if (!status.granted) return;
      const pending = await LN.getPending();
      const taskReminders = pending.notifications.filter(
        (notification) => notification.extra?.taskId,
      );
      if (taskReminders.length) {
        await LN.cancel({ notifications: taskReminders.map((n) => ({ id: n.id })) });
      }
      const now = Date.now();
      const list = tasks
        .filter((t) => !t.done && t.reminder_at && new Date(t.reminder_at).getTime() > now)
        .sort((a, b) => Date.parse(a.reminder_at!) - Date.parse(b.reminder_at!))
        .slice(0, 60)
        .map((t) => ({
          id: numId(t.id),
          title: `⏰ ${t.title}`,
          body: t.due_at
            ? `موعدها: ${new Date(t.due_at).toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`
            : "حان وقت التذكير",
          schedule: { at: new Date(t.reminder_at!), allowWhileIdle: true },
          isExactNotification: status.exact,
          extra: { taskId: t.id },
        }));
      if (list.length) await LN.schedule({ notifications: list });
    });
  return syncQueue;
}
