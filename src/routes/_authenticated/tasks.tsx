import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Filter, Check, Bell, Repeat, CalendarDays, List, ChevronRight, ChevronLeft } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useTasks, useToggleTask, tsOf, type Task } from "@/lib/data";
import { formatTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "MemoFlow — المهام" },
      { name: "description", content: "كل مهامك اليوم وغداً والأسبوع القادم في مكان واحد." },
    ],
  }),
  component: TasksPage,
});

type Tab = "all" | "today" | "tomorrow" | "done";
type View = "list" | "calendar";

function TasksPage() {
  const { data: tasks = [] } = useTasks();
  const toggle = useToggleTask();
  const [tab, setTab] = useState<Tab>("all");
  const [view, setView] = useState<View>("list");

  const groups = useMemo(() => {
    const today: Task[] = [], tomorrow: Task[] = [], upcoming: Task[] = [], done: Task[] = [];
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const tomorrowStart = startOfDay.getTime() + 86_400_000;
    const dayAfter = tomorrowStart + 86_400_000;
    for (const t of tasks) {
      if (t.done) { done.push(t); continue; }
      const due = t.due_at ? tsOf(t.due_at) : Infinity;
      if (due < tomorrowStart) today.push(t);
      else if (due < dayAfter) tomorrow.push(t);
      else upcoming.push(t);
    }
    const s = (a: Task, b: Task) => (a.due_at ? tsOf(a.due_at) : 0) - (b.due_at ? tsOf(b.due_at) : 0);
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
      <PageHeader title="المهام" action={
        <div className="flex gap-2">
          <button
            onClick={() => setView(view === "list" ? "calendar" : "list")}
            className="grid size-10 place-items-center rounded-full bg-card shadow-card"
            aria-label="تبديل العرض"
          >
            {view === "list" ? <CalendarDays className="size-4" /> : <List className="size-4" />}
          </button>
          <button className="grid size-10 place-items-center rounded-full bg-card shadow-card" aria-label="بحث"><Search className="size-4" /></button>
          <button className="grid size-10 place-items-center rounded-full bg-card shadow-card" aria-label="فلتر"><Filter className="size-4" /></button>
        </div>
      } />

      {view === "calendar" ? (
        <CalendarView tasks={tasks} onToggle={(t) => toggle.mutate({ id: t.id, done: !t.done, task: t })} />
      ) : (
        <>
      <div className="px-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["all", "today", "tomorrow", "done"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-full px-5 py-2 text-xs font-bold transition-colors ${tab === t ? "bg-primary text-primary-foreground shadow-card" : "bg-card text-muted-foreground hover:text-foreground"}`}>
              {({ all: "الكل", today: "اليوم", tomorrow: "غداً", done: "مكتملة" } as const)[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-6 px-5">
        {Object.entries(visible).map(([label, items]) => (
          <section key={label}>
            <h2 className="mb-3 text-sm font-bold text-muted-foreground">{label}</h2>
            {items.length === 0 ? (
              <p className="rounded-2xl bg-card p-5 text-center text-xs text-muted-foreground shadow-card">لا توجد مهام هنا.</p>
            ) : (
              <div className="space-y-2">
                {items.map((t) => (<TaskRow key={t.id} task={t} onToggle={() => toggle.mutate({ id: t.id, done: !t.done, task: t })} />))}
              </div>
            )}
          </section>
        ))}
      </div>
      </>
      )}
    </AppShell>
  );
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const dot = task.priority === "high" ? "bg-destructive" : task.priority === "med" ? "bg-warning" : "bg-success";
  const recLabel = task.recurrence === "daily" ? "يومي" : task.recurrence === "weekly" ? "أسبوعي" : task.recurrence === "monthly" ? "شهري" : null;
  const progress = task.progress ?? 0;
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
      <button onClick={onToggle} className={`grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors ${task.done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-transparent"}`} aria-label={task.done ? "إلغاء الإنجاز" : "إنجاز"}>
        {task.done && <Check className="size-4" strokeWidth={3} />}
      </button>
      <Link to="/tasks/$id" params={{ id: task.id }} className="min-w-0 block">
        <p className={`truncate text-sm font-bold ${task.done ? "text-muted-foreground line-through" : ""}`}>{task.title}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
          {task.due_at && <span className="text-primary">{formatTime(tsOf(task.due_at))}</span>}
          {task.reminder_at && (
            <span className="inline-flex items-center gap-0.5 text-muted-foreground"><Bell className="size-3" /> تذكير</span>
          )}
          {recLabel && (
            <span className="inline-flex items-center gap-0.5 text-muted-foreground"><Repeat className="size-3" /> {recLabel}</span>
          )}
          {progress > 0 && !task.done && (
            <span className="text-muted-foreground">{progress}%</span>
          )}
        </div>
        {progress > 0 && !task.done && (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </Link>
      <span className={`block size-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
    </div>
  );
}

// -------- Calendar view
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const WEEK_AR = ["أحد","اثن","ثلا","أرب","خمي","جمع","سبت"];

function CalendarView({ tasks, onToggle }: { tasks: Task[]; onToggle: (t: Task) => void }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due_at) continue;
      const key = new Date(t.due_at).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tasks]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: ({ d: number; key: string } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    cells.push({ d, key: dt.toISOString().slice(0, 10) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = new Date().toISOString().slice(0, 10);
  const items = byDay.get(selected) ?? [];

  return (
    <div className="px-5 pb-6">
      <div className="flex items-center justify-between rounded-2xl bg-card px-3 py-3 shadow-card">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary" aria-label="الشهر السابق">
          <ChevronRight className="size-5" />
        </button>
        <p className="text-sm font-extrabold">{MONTHS_AR[month]} {year}</p>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary" aria-label="الشهر التالي">
          <ChevronLeft className="size-5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted-foreground">
        {WEEK_AR.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={i} className="aspect-square" />;
          const count = byDay.get(c.key)?.length ?? 0;
          const isSel = c.key === selected;
          const isToday = c.key === todayKey;
          return (
            <button
              key={i}
              onClick={() => setSelected(c.key)}
              className={`relative aspect-square rounded-xl text-sm font-bold transition-colors ${
                isSel ? "bg-primary text-primary-foreground shadow-card" :
                isToday ? "bg-primary-soft text-primary" :
                "bg-card text-foreground hover:bg-secondary"
              }`}
            >
              {c.d}
              {count > 0 && (
                <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[9px] font-bold ${isSel ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <section className="mt-5">
        <h2 className="mb-3 text-sm font-bold text-muted-foreground">
          مهام {new Date(selected).toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}
        </h2>
        {items.length === 0 ? (
          <p className="rounded-2xl bg-card p-5 text-center text-xs text-muted-foreground shadow-card">لا توجد مهام في هذا اليوم.</p>
        ) : (
          <div className="space-y-2">
            {items.map((t) => (<TaskRow key={t.id} task={t} onToggle={() => onToggle(t)} />))}
          </div>
        )}
      </section>
    </div>
  );
}