import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, Bell, ChevronLeft, Check, FolderPlus, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { LoadingState, ErrorState, EmptyState } from "@/components/feedback";
import {
  useAddCategory,
  useCategories,
  useTaskSubItemSummaries,
  useTasks,
  useToggleTask,
  type Task,
  type TaskSubItemSummary,
} from "@/lib/data";
import { localDayKey, matchesTask, type TaskFilter } from "@/features/tasks/task-rules";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/tasks/")({
  head: () => ({
    meta: [
      { title: "MemoFlow — المهام" },
      { name: "description", content: "بطاقات مهامك مع مواعيدها وأولوياتها وتقدم البنود الفرعية." },
      { property: "og:title", content: "MemoFlow — المهام" },
      {
        property: "og:description",
        content: "تابع مهامك وبنودها الفرعية في بطاقات مرتبة حسب التصنيف.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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
  const { data: categories = [] } = useCategories();
  const summaryQuery = useTaskSubItemSummaries();
  const summaries = summaryQuery.data ?? {};
  const addCategory = useAddCategory();
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const tasks = useMemo(
    () =>
      (query.data ?? [])
        .filter(
          (task) =>
            matchesTask(task, filter, search) &&
            (priority === "all" || task.priority === priority) &&
            (categoryId === "all"
              ? true
              : categoryId === "none"
                ? !task.category_id
                : task.category_id === categoryId),
        )
        .sort(
          (a, b) =>
            (a.due_at ? Date.parse(a.due_at) : Infinity) -
            (b.due_at ? Date.parse(b.due_at) : Infinity),
        ),
    [query.data, filter, search, priority, categoryId],
  );
  const groups = useMemo(() => {
    const categoryName = new Map(categories.map((category) => [category.id, category.name]));
    const map = new Map<string, { id: string; name: string; tasks: Task[] }>();
    for (const task of tasks) {
      const id = task.category_id ?? "none";
      const group = map.get(id) ?? {
        id,
        name: id === "none" ? "بدون تصنيف" : (categoryName.get(id) ?? "تصنيف محذوف"),
        tasks: [],
      };
      group.tasks.push(task);
      map.set(id, group);
    }
    return [...map.values()].sort((a, b) => {
      if (a.id === "none") return 1;
      if (b.id === "none") return -1;
      return a.name.localeCompare(b.name, "ar");
    });
  }, [tasks, categories]);
  return (
    <AppShell>
      <PageHeader
        title="المهام"
        subtitle="خطوة واحدة في كل مرة"
        action={
          <Link
            to="/create"
            search={{
              kind: "task",
              category: categoryId !== "all" && categoryId !== "none" ? categoryId : undefined,
            }}
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
        <section aria-labelledby="task-categories-title" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="task-categories-title" className="text-xs font-medium text-muted-foreground">
              التصنيفات
            </h2>
            <button
              onClick={() => setAddingCategory((value) => !value)}
              className="flex min-h-10 items-center gap-2 rounded-full bg-card px-3 text-xs font-medium text-primary"
            >
              <FolderPlus className="size-4" />
              تصنيف جديد
            </button>
          </div>
          {addingCategory && (
            <form
              className="flex items-center gap-2 rounded-2xl bg-card p-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const name = categoryDraft.trim();
                if (!name || addCategory.isPending) return;
                try {
                  const category = await addCategory.mutateAsync({ name, icon: "ListChecks" });
                  setCategoryId(category.id);
                  setCategoryDraft("");
                  setAddingCategory(false);
                } catch {
                  toast.error("تعذر إنشاء التصنيف. حاول مجددًا.");
                }
              }}
            >
              <input
                autoFocus
                aria-label="اسم التصنيف الجديد"
                value={categoryDraft}
                maxLength={80}
                onChange={(event) => setCategoryDraft(event.target.value)}
                placeholder="مثل: العمل أو تطوير المواقع"
                className="min-h-11 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={!categoryDraft.trim() || addCategory.isPending}
                className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                حفظ
              </button>
            </form>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="تصفية حسب التصنيف">
            <CategoryButton
              active={categoryId === "all"}
              label="الكل"
              count={(query.data ?? []).length}
              onClick={() => setCategoryId("all")}
            />
            {categories.map((category) => (
              <CategoryButton
                key={category.id}
                active={categoryId === category.id}
                label={category.name}
                count={(query.data ?? []).filter((task) => task.category_id === category.id).length}
                onClick={() => setCategoryId(category.id)}
              />
            ))}
            <CategoryButton
              active={categoryId === "none"}
              label="بدون تصنيف"
              count={(query.data ?? []).filter((task) => !task.category_id).length}
              onClick={() => setCategoryId("none")}
            />
          </div>
        </section>
        {summaryQuery.isError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3"
          >
            <p className="text-xs leading-6 text-destructive">
              تعذر تحميل تقدم البنود. أُوقف الإكمال اليدوي مؤقتًا لحماية حالة المهام.
            </p>
            <button
              type="button"
              className="min-h-10 shrink-0 rounded-xl bg-card px-3 text-xs font-semibold"
              onClick={() => {
                void summaryQuery.refetch();
              }}
            >
              إعادة المحاولة
            </button>
          </div>
        )}
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
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.id} aria-labelledby={`task-group-${group.id}`}>
                <div className="mb-2 flex items-center justify-between gap-3 px-1">
                  <h2 id={`task-group-${group.id}`} className="font-semibold">
                    {group.name}
                  </h2>
                  <span className="text-xs text-muted-foreground">{group.tasks.length} مهمة</span>
                </div>
                <ul
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                  aria-label={`بطاقات ${group.name}`}
                >
                  {group.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      summary={summaries[task.id]}
                      summariesReady={summaryQuery.isSuccess}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function CategoryButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-medium ${active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
    >
      <span>{label}</span>
      <span className={`rounded-full px-1.5 py-0.5 ${active ? "bg-white/20" : "bg-secondary"}`}>
        {count}
      </span>
    </button>
  );
}

function TaskCard({
  task,
  summary,
  summariesReady,
}: {
  task: Task;
  summary?: TaskSubItemSummary;
  summariesReady: boolean;
}) {
  const toggle = useToggleTask();
  const due = task.due_at ? new Date(task.due_at) : null;
  const overdue = due && !task.done && localDayKey(due) < localDayKey(new Date());
  const autoManaged = (summary?.total ?? 0) > 0;
  const completionUnavailable = !summariesReady || autoManaged;
  const completionLabel = !summariesReady
    ? `جارٍ تحميل بنود ${task.title}`
    : autoManaged
      ? `تكتمل ${task.title} تلقائيًا بعد إنجاز جميع البنود`
      : `${task.done ? "إلغاء إنجاز" : "إنجاز"} ${task.title}`;
  return (
    <li className="relative flex min-h-52 items-start gap-2 rounded-2xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-elevated">
      <Button
        variant="ghost"
        size="icon"
        role="checkbox"
        aria-checked={task.done}
        aria-label={completionLabel}
        title={autoManaged ? "تكتمل المهمة تلقائيًا عند إنجاز جميع البنود" : undefined}
        disabled={toggle.isPending || completionUnavailable}
        onClick={() =>
          toggle.mutate(
            { id: task.id, done: !task.done, task },
            { onError: () => toast.error("تعذر حفظ حالة المهمة. حاول مجددًا.") },
          )
        }
        className="size-11 shrink-0 rounded-xl disabled:opacity-50"
      >
        <span
          className={`grid size-6 place-items-center rounded-full border-2 ${task.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}
        >
          {task.done && <Check className="size-4" />}
        </span>
      </Button>
      <Link
        to="/tasks/$id"
        params={{ id: task.id }}
        className="flex min-h-44 min-w-0 flex-1 flex-col items-stretch gap-3 rounded-lg py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <p
            className={`line-clamp-3 break-words text-base font-semibold ${task.done ? "text-muted-foreground line-through" : ""}`}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="mt-2 line-clamp-2 break-words text-sm leading-relaxed text-muted-foreground">
              {task.description}
            </p>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-xs text-muted-foreground">
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
            {summary && (
              <span className="inline-flex items-center gap-1">
                <ListChecks className="size-3" />
                {summary.done} من {summary.total}
              </span>
            )}
          </div>
          {summary && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${summary.progress}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {task.done
              ? "مكتملة"
              : summary && summary.total > 0
                ? `${summary.progress}% مكتمل`
                : "غير مكتملة"}
          </span>
          <ChevronLeft className="size-4 shrink-0" />
        </div>
      </Link>
    </li>
  );
}
