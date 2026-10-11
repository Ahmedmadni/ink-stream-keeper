import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { ArrowRight, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/feedback";
import { AppShell } from "@/components/AppShell";
import {
  useTask,
  useUpdateTask,
  useCategories,
  useChecklist,
  useAddChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
  useSubtasks,
  useAddSubtask,
  useUpdateSubtask,
  useDeleteSubtask,
  computeProgress,
  useToggleTask,
  useDeleteTask,
  type TaskExt,
} from "@/lib/data";
import { BlockRenderer, BlockProvider } from "@/components/blocks";
import { buildTaskBlocks, type TaskCtx } from "@/lib/engine/compositions";
import { useSubItems, computeSubItemsProgress } from "@/lib/subitems";

export const Route = createFileRoute("/_authenticated/tasks/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `MemoFlow — مهمة ${params.id}` },
      { name: "description", content: "تفاصيل المهمة، البنود، المهام الفرعية، والوسوم." },
    ],
  }),
  component: TaskDetail,
});

function TaskDetail() {
  const { id } = Route.useParams();
  const { data: task, isLoading, isError, refetch } = useTask(id);
  const navigate = useNavigate();
  const toggle = useToggleTask();
  const remove = useDeleteTask();
  const { data: categories = [] } = useCategories();
  const { data: checklist = [] } = useChecklist(id);
  const { data: subs = [] } = useSubtasks(id);
  const { data: subItems = [] } = useSubItems("task", id);
  const update = useUpdateTask();
  const addCheck = useAddChecklistItem();
  const updCheck = useUpdateChecklistItem();
  const delCheck = useDeleteChecklistItem();
  const addSub = useAddSubtask();
  const updSub = useUpdateSubtask();
  const delSub = useDeleteSubtask();

  const roll = useMemo(() => computeSubItemsProgress(subItems), [subItems]);
  const autoProgress = useMemo(
    () => (roll.total > 0 ? roll.pct : computeProgress(checklist, subs)),
    [roll, checklist, subs],
  );
  useEffect(() => {
    if (!task) return;
    if (roll.total + checklist.length + subs.length === 0) return;
    if ((task.progress ?? 0) !== autoProgress) {
      update.mutate({ id, patch: { progress: autoProgress } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoProgress]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 text-center">
          <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }
  if (isError)
    return (
      <AppShell>
        <ErrorState
          title="تعذر تحميل المهمة"
          onRetry={() => {
            void refetch();
          }}
        />
      </AppShell>
    );
  if (!task) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-muted-foreground">
          لم يتم العثور على المهمة.
          <div className="mt-4">
            <Link to="/tasks" className="text-primary font-semibold">
              العودة للمهام
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const ctx: TaskCtx = {
    task,
    checklist,
    subtasks: subs,
    subSummary: { done: roll.done, total: roll.total, pct: roll.pct },
  };
  const mutations = {
    updateTask: (patch: Record<string, unknown>) =>
      update.mutate(
        { id, patch: patch as Partial<TaskExt> },
        { onError: () => toast.error("تعذر حفظ تعديل المهمة. حاول مجددًا.") },
      ),
    addCheck: (text: string) => addCheck.mutate({ taskId: id, text, sort: checklist.length }),
    updCheck: (cid: string, patch: { text?: string; done?: boolean }) =>
      updCheck.mutate({ id: cid, taskId: id, patch }),
    delCheck: (cid: string) => delCheck.mutate({ id: cid, taskId: id }),
    addSub: (title: string) => addSub.mutate({ taskId: id, title, sort: subs.length }),
    updSub: (sid: string, patch: { title?: string; done?: boolean }) =>
      updSub.mutate({ id: sid, taskId: id, patch }),
    delSub: (sid: string) => delSub.mutate({ id: sid, taskId: id }),
  };
  const blocks = buildTaskBlocks(ctx, { mutations, categories });

  return (
    <AppShell>
      <BlockProvider
        value={{
          kind: "task",
          id,
          item: task,
          permissions: ["edit"],
          readonly: false,
          deviceType: "desktop",
        }}
      >
        <header className="flex items-center gap-3 px-5 py-3">
          <Link
            to="/tasks"
            aria-label="العودة للمهام"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-card"
          >
            <ArrowRight className="size-5" />
          </Link>
          <span className="flex-1 text-sm text-muted-foreground">تفاصيل المهمة</span>
          <button
            aria-label="حذف المهمة"
            disabled={remove.isPending}
            className="grid size-11 place-items-center rounded-full bg-card text-destructive"
            onClick={() => {
              if (confirm("حذف هذه المهمة؟"))
                remove.mutate(id, {
                  onSuccess: () => {
                    void navigate({ to: "/tasks" });
                  },
                  onError: () => toast.error("تعذر حذف المهمة"),
                });
            }}
          >
            <Trash2 className="size-4" />
          </button>
        </header>
        <div className="space-y-4 px-4 py-5">
          <div className="flex items-center gap-3 rounded-2xl bg-card p-4">
            <input
              type="checkbox"
              checked={task.done}
              disabled={toggle.isPending}
              aria-label="إنجاز المهمة"
              className="size-6 shrink-0 accent-primary"
              onChange={(e) =>
                toggle.mutate(
                  { id, done: e.target.checked, task },
                  { onError: () => toast.error("تعذر تحديث حالة المهمة") },
                )
              }
            />
            <input
              key={task.title}
              defaultValue={task.title}
              maxLength={500}
              aria-label="عنوان المهمة"
              className="min-w-0 flex-1 bg-transparent text-xl font-semibold"
              onBlur={(e) => {
                const title = e.currentTarget.value.trim();
                if (!title) {
                  e.currentTarget.value = task.title;
                  return;
                }
                if (title !== task.title) mutations.updateTask({ title });
              }}
            />
          </div>
          <BlockRenderer
            blocks={blocks
              .filter((block) => ["description", "sub_items", "legacy_migrate"].includes(block.id))
              .map((block) =>
                block.id === "sub_items" ? { ...block, title: "بنود المهمة" } : block,
              )}
            context={ctx}
          />
          <details className="rounded-2xl bg-card p-4">
            <summary className="cursor-pointer py-2 text-sm font-medium text-muted-foreground">
              المواعيد وتفاصيل إضافية
            </summary>
            <div className="mt-4 space-y-4">
              <BlockRenderer
                blocks={blocks.filter(
                  (block) =>
                    ![
                      "header",
                      "description",
                      "sub_items",
                      "legacy_migrate",
                      "stats",
                      "progress",
                    ].includes(block.id),
                )}
                context={ctx}
              />
            </div>
          </details>
        </div>
      </BlockProvider>
    </AppShell>
  );
}
