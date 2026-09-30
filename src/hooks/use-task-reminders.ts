import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTasks, type Task } from "@/lib/data";
import { isNative } from "@/services/platform";
import { requestNativePermission, syncNativeReminders } from "@/lib/native-reminders";

const FIRED_KEY = "memoflow.firedReminders";

function loadFired(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch { return new Set(); }
}
function saveFired(set: Set<string>) {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify([...set].slice(-500))); } catch {}
}

function fireReminder(task: Task) {
  const body = task.due_at
    ? `موعدها: ${new Date(task.due_at).toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`
    : "حان وقت التذكير";
  toast(`⏰ ${task.title}`, { description: body, duration: 10000 });
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(`MemoFlow — ${task.title}`, {
        body,
        icon: "/icon.svg",
        tag: `task-${task.id}`,
      });
    } catch {}
  }
}

export function useTaskReminders() {
  const { data: tasks = [] } = useTasks();
  const timersRef = useRef<number[]>([]);
  const firedRef = useRef<Set<string>>(loadFired());

  useEffect(() => {
    // clear existing timers
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];

    if (isNative()) {
      // OS-level scheduling: fires even when the app is closed.
      syncNativeReminders(tasks);
      return;
    }

    const now = Date.now();
    for (const task of tasks) {
      if (task.done || !task.reminder_at) continue;
      const fireKey = `${task.id}@${task.reminder_at}`;
      if (firedRef.current.has(fireKey)) continue;
      const at = new Date(task.reminder_at).getTime();
      const delay = at - now;
      if (delay < -60_000) continue; // older than a minute, skip
      if (delay <= 0) {
        fireReminder(task);
        firedRef.current.add(fireKey);
        saveFired(firedRef.current);
        continue;
      }
      // setTimeout caps around 2^31ms (~24.8 days); skip if further
      if (delay > 2_000_000_000) continue;
      const id = window.setTimeout(() => {
        fireReminder(task);
        firedRef.current.add(fireKey);
        saveFired(firedRef.current);
      }, delay);
      timersRef.current.push(id);
    }

    return () => {
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
    };
  }, [tasks]);
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (isNative()) return (await requestNativePermission()) ? "granted" : "denied";
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}