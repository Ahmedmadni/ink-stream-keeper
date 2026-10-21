import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus,
  Bell,
  ChevronLeft,
  Check,
  FolderPlus,
  ListChecks,
  Circle,
  CircleCheck,
} from "lucide-react";
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
import { CategoryBar, CategoryChip } from "@/components/CategoryBar";
import { DesktopFloatingCard } from "@/components/DesktopFloatingCard";
import { desktopTaskSnapshot } from "@/features/tasks/desktop-floating";
import { isDesktop } from "@/services/desktop";
import { TaskSearch } from "@/features/tasks/TaskSearch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
      <PageHeader title="المهام" subtitle="خطوة واحدة في كل مرة" />
      <div className="space-y-4 px-5">
        <TaskSearch
          search={search}
          onSearch={setSearch}
          filter={filter}
          onFilter={setFilter}
          priority={priority}
          onPriority={setPriority}
        />
        <CategoryBar
          action={
            <Link
              to="/create"
              search={{
                kind: "task",
                category: categoryId !== "all" && categoryId !== "none" ? categoryId : undefined,
              }}
              className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"
              aria-label="مهمة جديدة"
            >
              <Plus className="size-6" />
            </Link>
          }
        >
          <CategoryChip
            active={categoryId === "all"}
            label="الكل"
            count={(query.data ?? []).length}
            onClick={() => setCategoryId("all")}
          />
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              active={categoryId === category.id}
              label={category.name}
              count={(query.data ?? []).filter((task) => task.category_id === category.id).length}
              onClick={() => setCategoryId(category.id)}
            />
          ))}
          <CategoryChip
            active={categoryId === "none"}
            label="بدون تصنيف"
            count={(query.data ?? []).filter((task) => !task.category_id).length}
            onClick={() => setCategoryId("none")}
          />
          <button
            type="button"
            onClick={() => setAddingCategory(true)}
            className="flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-dashed border-border px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            <FolderPlus className="size-4" />
            تصنيف جديد
          </button>
        </CategoryBar>
        <Dialog open={addingCategory} onOpenChange={setAddingCategory}>
          <DialogContent dir="rtl" className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>تصنيف جديد</DialogTitle>
            </DialogHeader>
            <form
              className="flex items-center gap-2"
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
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={!categoryDraft.trim() || addCategory.isPending}
                className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                حفظ
              </button>
            </form>
          </DialogContent>
        </Dialog>
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
    <li>
      <DesktopFloatingCard
        card={desktopTaskSnapshot(task, summary)}
        disabled={!summariesReady}
        className="flex min-h-40 items-start gap-2 rounded-2xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-elevated"
      >
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
          className={`flex min-h-32 min-w-0 flex-1 flex-col items-stretch gap-3 rounded-lg py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isDesktop() ? "pe-11" : ""}`}
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <p
              className={`line-clamp-3 break-words text-base font-semibold ${task.done ? "text-muted-foreground line-through" : ""}`}
            >
              {task.title}
            </p>
            {!!summary?.items.length && (
              <ul
                aria-label={`بنود ${task.title}`}
                className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted-foreground"
              >
                {summary.items.slice(0, 3).map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    {item.done ? (
                      <CircleCheck
                        aria-hidden="true"
                        className="mt-0.5 size-3.5 shrink-0 text-primary/60"
                      />
                    ) : (
                      <Circle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 opacity-60" />
                    )}
                    <span
                      className={`line-clamp-2 break-words ${item.done ? "line-through opacity-70" : ""}`}
                    >
                      {item.title}
                    </span>
                  </li>
                ))}
                {summary.items.length > 3 && (
                  <li className="ps-5.5 text-muted-foreground/80">
                    + {summary.items.length - 3} بنود أخرى
                  </li>
                )}
              </ul>
            )}
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
      </DesktopFloatingCard>
    </li>
  );
}
