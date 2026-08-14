import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  useTask, useUpdateTask, useCategories,
  useChecklist, useAddChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem,
  useSubtasks, useAddSubtask, useUpdateSubtask, useDeleteSubtask,
  computeProgress,
} from "@/lib/data";
import { BlockRenderer, Toolbar, BlockProvider } from "@/components/blocks";
import { useItemActions } from "@/lib/engine/actions";
import { buildTaskBlocks } from "@/lib/engine/compositions";
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
  const { data: task, isLoading } = useTask(id);
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
  const actions = useItemActions("task", id);

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
    return <AppShell><div className="p-8 text-center"><Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" /></div></AppShell>;
  }
  if (!task) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-muted-foreground">
          لم يتم العثور على المهمة.
          <div className="mt-4"><Link to="/tasks" className="text-primary font-semibold">العودة للمهام</Link></div>
        </div>
      </AppShell>
    );
  }

  const ctx = {
    task, checklist, subtasks: subs,
    subSummary: { done: roll.done, total: roll.total, pct: roll.pct },
  } as any;
  const mutations = {
    updateTask: (patch: Record<string, unknown>) => update.mutate({ id, patch: patch as any }),
    addCheck: (text: string) => addCheck.mutate({ taskId: id, text, sort: checklist.length }),
    updCheck: (cid: string, patch: { text?: string; done?: boolean }) => updCheck.mutate({ id: cid, taskId: id, patch }),
    delCheck: (cid: string) => delCheck.mutate({ id: cid, taskId: id }),
    addSub: (title: string) => addSub.mutate({ taskId: id, title, sort: subs.length }),
    updSub: (sid: string, patch: { title?: string; done?: boolean }) => updSub.mutate({ id: sid, taskId: id, patch }),
    delSub: (sid: string) => delSub.mutate({ id: sid, taskId: id }),
  };
  const blocks = buildTaskBlocks(ctx, { mutations, categories });

  return (
    <AppShell>
      <BlockProvider value={{ kind: "task", id, item: task, permissions: ["edit"], readonly: false, deviceType: "desktop" }}>
        <Toolbar actions={actions} title={task.title} isFavorite={(task as any).favorite} isArchived={(task as any).archived} />
        <div className="space-y-4 px-4 py-5">
          <BlockRenderer blocks={blocks} context={ctx} />
        </div>
      </BlockProvider>
    </AppShell>
  );
}
