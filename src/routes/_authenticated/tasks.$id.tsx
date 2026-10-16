import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  useToggleTask,
  useDeleteTask,
  type TaskExt,
} from "@/lib/data";
import { BlockRenderer, BlockProvider } from "@/components/blocks";
import { buildTaskBlocks, type TaskCtx } from "@/lib/engine/compositions";
import { useSubItems, computeSubItemsProgress } from "@/lib/subitems";
import { taskRollupPatch } from "@/features/tasks/task-rules";
import { checkTaskChecklistBackend } from "@/features/tasks/backend-readiness";

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
  const checklistQuery = useChecklist(id);
  const subtaskQuery = useSubtasks(id);
  const subItemQuery = useSubItems("task", id);
  const checklist = checklistQuery.data ?? [];
  const subs = subtaskQuery.data ?? [];
  const checklistBackend = useQuery({
    queryKey: ["backend-readiness", "task-checklist-v1"],
    queryFn: checkTaskChecklistBackend,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const update = useUpdateTask();
  const addCheck = useAddChecklistItem();
  const updCheck = useUpdateChecklistItem();
  const delCheck = useDeleteChecklistItem();
  const addSub = useAddSubtask();
  const updSub = useUpdateSubtask();
  const delSub = useDeleteSubtask();

  const roll = useMemo(() => computeSubItemsProgress(subItemQuery.data ?? []), [subItemQuery.data]);
  const itemCount = roll.total || checklist.length + subs.length;
  const completedItemCount = roll.total
    ? roll.done
    : checklist.filter((item) => item.done).length + subs.filter((item) => item.done).length;
  const taskProgress = task?.progress ?? 0;
  const taskDone = task?.done;
  const taskStatus = task?.status;
  const taskRecurrence = task?.recurrence;
  const rollupInputsReady =
    checklistQuery.isSuccess && subtaskQuery.isSuccess && subItemQuery.isSuccess;
  useEffect(() => {
    if (!rollupInputsReady || taskDone === undefined || !taskStatus || itemCount === 0) return;
    // The database advances and resets recurring checklists atomically. A client
    // write based on the optimistic final check could otherwise mark the freshly
    // reset occurrence complete again.
    if (roll.total > 0 && taskRecurrence !== "none" && completedItemCount === itemCount) return;
    const patch = taskRollupPatch(itemCount, completedItemCount, taskStatus);
    if (taskProgress !== patch.progress || taskDone !== patch.done || taskStatus !== patch.status) {
      update.mutate({ id, patch });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    completedItemCount,
    id,
    itemCount,
    roll.total,
    rollupInputsReady,
    taskDone,
    taskProgress,
    taskRecurrence,
    taskStatus,
  ]);

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
          {checklistBackend.data === "missing" && (
            <div
              role="status"
              className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-6 text-foreground"
            >
              <p>
                تحديث قاعدة البيانات الخاص بإكمال قوائم المهام لم يُفعّل بعد. يمكنك قراءة المهمة
                وتعديلها، لكن المزامنة التلقائية بين الأجهزة لن تكون مضمونة حتى تطبيق التحديث.
              </p>
              <button
                type="button"
                disabled={checklistBackend.isFetching}
                className="mt-2 min-h-10 rounded-xl bg-card px-3 font-semibold disabled:opacity-50"
                onClick={() => {
                  void checklistBackend.refetch();
                }}
              >
                {checklistBackend.isFetching ? "جارٍ الفحص…" : "إعادة فحص التحديث"}
              </button>
            </div>
          )}
          <div className="flex items-center gap-3 rounded-2xl bg-card p-4">
            <input
              type="checkbox"
              checked={task.done}
              disabled={toggle.isPending || !rollupInputsReady || itemCount > 0}
              aria-label="إنجاز المهمة"
              title={
                !rollupInputsReady
                  ? "جارٍ تحميل بنود المهمة"
                  : itemCount > 0
                    ? "تُنجز المهمة تلقائيًا عند اكتمال جميع البنود"
                    : undefined
              }
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
          {itemCount > 0 && (
            <p className="px-2 text-xs leading-6 text-muted-foreground">
              تكتمل المهمة تلقائيًا عند إنجاز جميع البنود، وتعود مفتوحة إذا أعدت فتح أي بند.
            </p>
          )}
          <BlockRenderer
            blocks={blocks
              .filter((block) => ["description", "sub_items", "legacy_migrate"].includes(block.id))
              .map((block) =>
                block.id === "sub_items"
                  ? {
                      ...block,
                      title: "قائمة التحقق الفرعية",
                      props: { ...block.props, title: "قائمة التحقق الفرعية" },
                    }
                  : block,
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
