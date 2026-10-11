import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, Bell, ChevronLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { LoadingState, ErrorState, EmptyState } from "@/components/feedback";
import { useTasks, useToggleTask, type Task } from "@/lib/data";
import { localDayKey, matchesTask, type TaskFilter } from "@/features/tasks/task-rules";

export const Route = createFileRoute("/_authenticated/tasks/")({
  head: () => ({ meta: [{ title: "MemoFlow — المهام" }] }),
  component: TasksPage,
});

const filters: { key: TaskFilter; label: string }[] = [
  { key: "all", label: "غير المكتملة" },
  { key: "today", label: "اليوم" },
  { key: "upcoming", label: "القادمة" },
  { key: "done", label: "المكتملة" },
];

function TasksPage() {
  const query = useTasks();
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const tasks = useMemo(
    () =>
      (query.data ?? [])
        .filter(
          (task) =>
            matchesTask(task, filter, search) && (priority === "all" || task.priority === priority),
        )
        .sort(
          (a, b) =>
            (a.due_at ? Date.parse(a.due_at) : Infinity) -
            (b.due_at ? Date.parse(b.due_at) : Infinity),
        ),
    [query.data, filter, search, priority],
  );
  return (
    <AppShell>
      <PageHeader
        title="المهام"
        subtitle="خطوة واحدة في كل مرة"
        action={
          <Link
            to="/create"
            search={{ kind: "task" }}
            className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground"
            aria-label="مهمة جديدة"
          >
            <Plus className="size-6" />
          </Link>
        }
      />
      <div className="space-y-5 px-5">
        <label className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5">
          <Search className="size-5 text-muted-foreground" />
          <input
            aria-label="بحث في المهام"
            type="search"
            placeholder="بحث في المهام"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2" aria-label="تصفية المهام">
          {filters.map((item) => (
            <button
              key={item.key}
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={`min-h-11 rounded-full px-4 text-xs font-medium ${filter === item.key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
            >
              {item.label}
            </button>
          ))}
          <select
            aria-label="أولوية المهام"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="min-h-11 rounded-full bg-card px-3 text-xs"
          >
            <option value="all">كل الأولويات</option>
            <option value="high">عالية</option>
            <option value="med">متوسطة</option>
            <option value="low">منخفضة</option>
          </select>
        </div>
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState
            title="تعذر تحميل المهام"
            onRetry={() => {
              void query.refetch();
            }}
          />
        ) : tasks.length === 0 ? (
          <EmptyState
            title={search ? "لا توجد نتائج" : "لا توجد مهام هنا"}
            description="أضف مهمة بسيطة، ثم افتحها لإضافة التفاصيل."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl bg-card">
            <ul className="divide-y divide-border">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function TaskRow({ task }: { task: Task }) {
  const toggle = useToggleTask();
  const due = task.due_at ? new Date(task.due_at) : null;
  const overdue = due && !task.done && localDayKey(due) < localDayKey(new Date());
  return (
    <li className="flex items-center gap-1 px-2 py-2">
      <button
        role="checkbox"
        aria-checked={task.done}
        aria-label={`${task.done ? "إلغاء إنجاز" : "إنجاز"} ${task.title}`}
        disabled={toggle.isPending}
        onClick={() =>
          toggle.mutate(
            { id: task.id, done: !task.done, task },
            { onError: () => toast.error("تعذر حفظ حالة المهمة. حاول مجددًا.") },
          )
        }
        className="grid size-12 shrink-0 place-items-center rounded-xl disabled:opacity-50"
      >
        <span
          className={`grid size-6 place-items-center rounded-full border-2 ${task.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}
        >
          {task.done && <Check className="size-4" />}
        </span>
      </button>
      <Link
        to="/tasks/$id"
        params={{ id: task.id }}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pe-3"
      >
        <div className="min-w-0 flex-1">
          <p
            className={`break-words text-[15px] font-medium ${task.done ? "text-muted-foreground line-through" : ""}`}
          >
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {due && (
              <span className={overdue ? "text-destructive" : ""}>
                {overdue ? "متأخرة · " : ""}
                {due.toLocaleDateString("ar-SA", {
                  calendar: "gregory",
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
            {task.reminder_at && <Bell aria-label="تذكير" className="size-3" />}
            {task.priority === "high" && <span className="text-destructive">أولوية عالية</span>}
          </div>
        </div>
        <ChevronLeft className="size-4 shrink-0 text-muted-foreground/60" />
      </Link>
    </li>
  );
}
