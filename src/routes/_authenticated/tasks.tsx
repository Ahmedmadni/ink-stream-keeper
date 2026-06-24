import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Filter, Check } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { actions, formatTime, useStore } from "@/lib/store";
import type { Task } from "@/lib/store";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "MemoFlow — المهام" },
      { name: "description", content: "كل مهامك اليوم وغداً والأسبوع القادم في مكان واحد." },
    ],
  }),
  component: TasksPage,
});

type Tab = "all" | "today" | "tomorrow" | "done";

function TasksPage() {
  const tasks = useStore((s) => s.tasks);
  const [tab, setTab] = useState<Tab>("all");

  const groups = useMemo(() => {
    const today: Task[] = [];
    const tomorrow: Task[] = [];
    const upcoming: Task[] = [];
    const done: Task[] = [];
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const tomorrowStart = startOfDay.getTime() + 86_400_000;
    const dayAfter = tomorrowStart + 86_400_000;
    for (const t of tasks) {
      if (t.done) { done.push(t); continue; }
      const due = t.due ?? Infinity;
      if (due < tomorrowStart) today.push(t);
      else if (due < dayAfter) tomorrow.push(t);
      else upcoming.push(t);
    }
    const s = (a: Task, b: Task) => (a.due ?? 0) - (b.due ?? 0);
    today.sort(s); tomorrow.sort(s); upcoming.sort(s);
    return { today, tomorrow, upcoming, done };
  }, [tasks]);

  const visible: Record<string, Task[]> =
    tab === "today" ? { اليوم: groups.today }
    : tab === "tomorrow" ? { غداً: groups.tomorrow }
    : tab === "done" ? { المكتملة: groups.done }
    : { اليوم: groups.today, غداً: groups.tomorrow, "الأسبوع القادم": groups.upcoming };

  return (
    <AppShell>
      <PageHeader
        title="المهام"
        action={
          <div className="flex gap-2">
            <button className="grid size-10 place-items-center rounded-full bg-card shadow-card" aria-label="بحث">
              <Search className="size-4" />
            </button>
            <button className="grid size-10 place-items-center rounded-full bg-card shadow-card" aria-label="فلتر">
              <Filter className="size-4" />
            </button>
          </div>
        }
      />

      <div className="px-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["all", "today", "tomorrow", "done"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-full px-5 py-2 text-xs font-bold transition-colors ${
                tab === t
                  ? "bg-primary text-primary-foreground shadow-card"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {labelOf(t)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-6 px-5">
        {Object.entries(visible).map(([label, items]) => (
          <section key={label}>
            <h2 className="mb-3 text-sm font-bold text-muted-foreground">{label}</h2>
            {items.length === 0 ? (
              <p className="rounded-2xl bg-card p-5 text-center text-xs text-muted-foreground shadow-card">
                لا توجد مهام هنا.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            )}
          </section>
        ))}
      </div>
    </AppShell>
  );
}

function labelOf(t: Tab) {
  return { all: "الكل", today: "اليوم", tomorrow: "غداً", done: "مكتملة" }[t];
}

function TaskRow({ task }: { task: Task }) {
  const dot = task.priority === "high" ? "bg-destructive" : task.priority === "med" ? "bg-warning" : "bg-success";
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
      <button
        onClick={() => actions.toggleTask(task.id)}
        className={`grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors ${
          task.done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-transparent"
        }`}
        aria-label={task.done ? "إلغاء الإنجاز" : "إنجاز"}
      >
        {task.done && <Check className="size-4" strokeWidth={3} />}
      </button>
      <div className="min-w-0">
        <p className={`truncate text-sm font-bold ${task.done ? "text-muted-foreground line-through" : ""}`}>
          {task.title}
        </p>
        {task.due && <p className="text-[11px] text-primary">{formatTime(task.due)}</p>}
      </div>
      <span className={`block size-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
    </div>
  );
}