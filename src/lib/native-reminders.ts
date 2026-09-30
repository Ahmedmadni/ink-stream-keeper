// Native (Android/iOS) local notifications for task reminders.
// Scheduled on the OS so they fire even when the app is closed.
import { isNative } from "@/services/platform";

type ReminderTask = { id: string; title: string; reminder_at: string | null; due_at?: string | null; done?: boolean };

function numId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

async function plugin() {
  const m = await import("@capacitor/local-notifications");
  return m.LocalNotifications;
}

export async function requestNativePermission(): Promise<boolean> {
  if (!isNative()) return false;
  const LN = await plugin();
  const cur = await LN.checkPermissions();
  if (cur.display === "granted") return true;
  const r = await LN.requestPermissions();
  return r.display === "granted";
}

export async function syncNativeReminders(tasks: ReminderTask[]) {
  if (!isNative()) return;
  try {
    const LN = await plugin();
    if ((await LN.checkPermissions()).display !== "granted") return;
    const pending = await LN.getPending();
    if (pending.notifications.length) {
      await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    const now = Date.now();
    const list = tasks
      .filter((t) => !t.done && t.reminder_at && new Date(t.reminder_at).getTime() > now)
      .slice(0, 60)
      .map((t) => ({
        id: numId(t.id),
        title: `⏰ ${t.title}`,
        body: t.due_at
          ? `موعدها: ${new Date(t.due_at).toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`
          : "حان وقت التذكير",
        schedule: { at: new Date(t.reminder_at!), allowWhileIdle: true },
        extra: { taskId: t.id },
      }));
    if (list.length) await LN.schedule({ notifications: list });
  } catch (e) {
    console.warn("native reminders failed", e);
  }
}
