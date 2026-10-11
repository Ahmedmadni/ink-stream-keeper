export type DatedTask = { title: string; done: boolean; due_at: string | null; priority: string };
export type TaskFilter = "all" | "today" | "upcoming" | "done";

export function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function matchesTask(
  task: DatedTask,
  filter: TaskFilter,
  query: string,
  now = new Date(),
): boolean {
  const text = query.trim().toLocaleLowerCase("ar");
  if (text && !task.title.toLocaleLowerCase("ar").includes(text)) return false;
  if (filter === "done") return task.done;
  if (task.done) return false;
  if (filter === "all") return true;
  if (!task.due_at) return false;
  const due = new Date(task.due_at);
  if (!Number.isFinite(due.getTime())) return false;
  if (filter === "today") return localDayKey(due) === localDayKey(now);
  const tomorrow = new Date(now);
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return due >= tomorrow;
}

/** Month-end dates stay within the next month (Jan 31 → Feb 28/29). */
export function advanceTaskDate(
  date: Date,
  recurrence: "none" | "daily" | "weekly" | "monthly",
): Date {
  const next = new Date(date);
  if (recurrence === "daily") next.setDate(next.getDate() + 1);
  if (recurrence === "weekly") next.setDate(next.getDate() + 7);
  if (recurrence === "monthly") {
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, last));
  }
  return next;
}

export function taskCompletionPatch(done: boolean) {
  return { done, status: done ? ("done" as const) : ("todo" as const) };
}
