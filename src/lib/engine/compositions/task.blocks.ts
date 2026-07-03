import { CheckCircle2, ListChecks, TrendingUp } from "lucide-react";
import { defineBlock, type BlockComposition } from "@/lib/engine/blocks";
import type { StatEntry } from "@/components/items/StatisticsCard";

export type TaskCtx = {
  task: {
    id: string;
    title: string;
    description?: string | null;
    notes?: string | null;
    progress?: number | null;
    status?: string | null;
    priority?: string | null;
    done?: boolean | null;
    start_at?: string | null;
    due_at?: string | null;
    recurrence?: string | null;
    tags?: string[] | null;
    links?: string[] | null;
  };
  checklist: { id: string; text: string; done: boolean }[];
  subtasks: { id: string; title: string; done: boolean }[];
};

const STATUS_LABEL: Record<string, string> = {
  todo: "للقيام به", in_progress: "قيد التنفيذ", blocked: "موقوفة", done: "مكتملة",
};
const PRIO_LABEL: Record<string, string> = { low: "منخفضة", med: "متوسطة", high: "عالية" };

function fmt(d?: string | null) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString("ar-EG"); } catch { return d; }
}

export function buildTaskBlocks(ctx: TaskCtx): BlockComposition<TaskCtx> {
  const { task, checklist, subtasks } = ctx;
  const total = checklist.length + subtasks.length;
  const done = checklist.filter((c) => c.done).length + subtasks.filter((s) => s.done).length;
  const stats: StatEntry[] = [
    { key: "prog", label: "الإنجاز", value: `${task.progress ?? 0}%`, icon: TrendingUp, tone: "primary" },
    { key: "chk", label: "البنود", value: `${done}/${total}`, icon: ListChecks, tone: "accent" },
    { key: "st", label: "الحالة", value: STATUS_LABEL[task.status ?? "todo"] ?? "—", icon: CheckCircle2, tone: task.done ? "success" : "muted" },
  ];
  return [
    defineBlock<{ type: "task"; title: string; badges: string[] }, TaskCtx>({
      id: "header", type: "header", priority: 0,
      layout: { bare: true },
      props: {
        type: "task", title: task.title,
        badges: [PRIO_LABEL[task.priority ?? "med"] ?? "", STATUS_LABEL[task.status ?? "todo"] ?? ""].filter(Boolean),
      } as any,
    }),
    defineBlock({ id: "stats", type: "statistics", priority: 10, props: { entries: stats, columns: 3 } }),
    defineBlock({
      id: "progress", type: "progress", priority: 20,
      props: { value: task.progress ?? 0, hint: total ? `${done} من ${total} بنداً` : undefined },
    }),
    defineBlock({
      id: "rich_text", type: "rich_text", priority: 30,
      visibleWhen: (c) => !!(c.task.description || c.task.notes),
      props: { text: [task.description, task.notes].filter(Boolean).join("\n\n") },
    }),
    defineBlock({
      id: "calendar", type: "calendar", priority: 40,
      visibleWhen: (c) => !!(c.task.start_at || c.task.due_at || (c.task.recurrence && c.task.recurrence !== "none")),
      props: { start: fmt(task.start_at), end: fmt(task.due_at), recurrence: task.recurrence && task.recurrence !== "none" ? task.recurrence : null },
    }),
    defineBlock({
      id: "checklist", type: "checklist", priority: 50,
      visibleWhen: (c) => c.checklist.length > 0,
      props: { items: checklist.map((c) => ({ id: c.id, text: c.text, done: c.done })) },
    }),
    defineBlock({
      id: "subtasks", type: "checklist", priority: 55, title: "المهام الفرعية",
      visibleWhen: (c) => c.subtasks.length > 0,
      props: { items: subtasks.map((s) => ({ id: s.id, text: s.title, done: s.done })) },
    }),
    defineBlock({
      id: "tags", type: "tags", priority: 60,
      visibleWhen: (c) => (c.task.tags?.length ?? 0) > 0,
      props: { tags: task.tags ?? [] },
    }),
    defineBlock({
      id: "links", type: "links", priority: 65,
      visibleWhen: (c) => (c.task.links?.length ?? 0) > 0,
      props: { links: task.links ?? [] },
    }),
  ];
}