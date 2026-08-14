import { createElement, Fragment } from "react";
import { Calendar, CheckCircle2, Clock, Flag, ListChecks, Tag as TagIcon, TrendingUp } from "lucide-react";
import { defineBlock, type BlockComposition } from "@/lib/engine/blocks";
import type { StatEntry } from "@/components/items/StatisticsCard";
import type { PropertyRow } from "@/components/blocks/blocks/PropertiesBlock";

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
    category_id?: string | null;
  };
  checklist: { id: string; text: string; done: boolean }[];
  subtasks: { id: string; title: string; done: boolean }[];
  /** Rollup summary of the unified hierarchical sub-items tree. */
  subSummary?: { done: number; total: number; pct: number };
};

export type TaskMutations = {
  updateTask: (patch: Record<string, unknown>) => void;
  addCheck: (text: string) => void;
  updCheck: (id: string, patch: { text?: string; done?: boolean }) => void;
  delCheck: (id: string) => void;
  addSub: (title: string) => void;
  updSub: (id: string, patch: { title?: string; done?: boolean }) => void;
  delSub: (id: string) => void;
};

export type TaskBuildOpts = {
  mutations?: TaskMutations;
  categories?: { id: string; name: string }[];
  readonly?: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  todo: "للقيام به", in_progress: "قيد التنفيذ", blocked: "موقوفة", done: "مكتملة",
};
const PRIO_LABEL: Record<string, string> = { low: "منخفضة", med: "متوسطة", high: "عالية" };

function toLocalInput(s: string | null | undefined) {
  if (!s) return "";
  const d = new Date(s);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function buildTaskBlocks(ctx: TaskCtx, opts: TaskBuildOpts = {}): BlockComposition<TaskCtx> {
  const { task, checklist, subtasks } = ctx;
  const m = opts.mutations;
  const readonly = opts.readonly ?? !m;
  const legacyTotal = checklist.length + subtasks.length;
  const legacyDone = checklist.filter((c) => c.done).length + subtasks.filter((s) => s.done).length;
  const total = ctx.subSummary?.total ?? legacyTotal;
  const done = ctx.subSummary?.done ?? legacyDone;
  const stats: StatEntry[] = [
    { key: "prog", label: "الإنجاز", value: `${task.progress ?? 0}%`, icon: TrendingUp, tone: "primary" },
    { key: "chk", label: "البنود", value: `${done}/${total}`, icon: ListChecks, tone: "accent" },
    { key: "st", label: "الحالة", value: STATUS_LABEL[task.status ?? "todo"] ?? "—", icon: CheckCircle2, tone: task.done ? "success" : "muted" },
  ];

  const inputCls = "w-full bg-transparent text-sm font-bold outline-none";
  const dateInputCls = "w-full bg-transparent text-xs font-bold outline-none";
  const upd = (patch: Record<string, unknown>) => m?.updateTask(patch);

  const propRows: PropertyRow[] = [
    {
      key: "status", label: "الحالة", icon: Flag,
      value: STATUS_LABEL[task.status ?? "todo"] ?? "—",
      editor: readonly ? undefined : createElement("select", {
        value: task.status ?? "todo", className: inputCls,
        onChange: (e: any) => upd({ status: e.target.value, done: e.target.value === "done" }),
      }, Object.entries(STATUS_LABEL).map(([k, v]) => createElement("option", { key: k, value: k }, v))),
    },
    {
      key: "priority", label: "الأولوية", icon: Flag,
      value: PRIO_LABEL[task.priority ?? "med"] ?? "—",
      editor: readonly ? undefined : createElement("select", {
        value: task.priority ?? "med", className: inputCls,
        onChange: (e: any) => upd({ priority: e.target.value }),
      }, Object.entries(PRIO_LABEL).map(([k, v]) => createElement("option", { key: k, value: k }, v))),
    },
    {
      key: "start", label: "تاريخ البداية", icon: Calendar,
      value: task.start_at ? new Date(task.start_at).toLocaleString("ar-EG") : "—",
      editor: readonly ? undefined : createElement("input", {
        type: "datetime-local", value: toLocalInput(task.start_at), className: dateInputCls,
        onChange: (e: any) => upd({ start_at: e.target.value ? new Date(e.target.value).toISOString() : null }),
      }),
    },
    {
      key: "due", label: "تاريخ النهاية", icon: Clock,
      value: task.due_at ? new Date(task.due_at).toLocaleString("ar-EG") : "—",
      editor: readonly ? undefined : createElement("input", {
        type: "datetime-local", value: toLocalInput(task.due_at), className: dateInputCls,
        onChange: (e: any) => upd({ due_at: e.target.value ? new Date(e.target.value).toISOString() : null }),
      }),
    },
    ...(opts.categories && opts.categories.length ? [{
      key: "category", label: "التصنيف", icon: TagIcon,
      value: opts.categories.find((c) => c.id === task.category_id)?.name ?? "—",
      editor: readonly ? undefined : createElement("select", {
        value: task.category_id ?? "", className: inputCls,
        onChange: (e: any) => upd({ category_id: e.target.value || null }),
      }, [
        createElement("option", { key: "__none", value: "" }, "— بدون —"),
        ...opts.categories.map((c) => createElement("option", { key: c.id, value: c.id }, c.name)),
      ]),
    } as PropertyRow] : []),
    {
      key: "recurrence", label: "التكرار", icon: Clock,
      value: ({ none: "بدون", daily: "يومي", weekly: "أسبوعي", monthly: "شهري" } as Record<string,string>)[task.recurrence ?? "none"] ?? "—",
      editor: readonly ? undefined : createElement("select", {
        value: task.recurrence ?? "none", className: inputCls,
        onChange: (e: any) => upd({ recurrence: e.target.value }),
      }, [
        createElement("option", { key: "none", value: "none" }, "بدون"),
        createElement("option", { key: "daily", value: "daily" }, "يومي"),
        createElement("option", { key: "weekly", value: "weekly" }, "أسبوعي"),
        createElement("option", { key: "monthly", value: "monthly" }, "شهري"),
      ]),
    },
  ];

  const addRemove = <T,>(list: T[], value: T) => Array.from(new Set([...(list as any[]), value])) as T[];

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
      id: "description", type: "rich_text", priority: 30, title: "الوصف",
      props: {
        text: task.description ?? "",
        placeholder: "أضف وصفاً للمهمة...",
        onSave: readonly ? undefined : (v: string) => upd({ description: v }),
      },
    }),
    defineBlock({
      id: "notes", type: "rich_text", priority: 35, title: "ملاحظات",
      props: {
        text: task.notes ?? "",
        placeholder: "ملاحظات إضافية...",
        onSave: readonly ? undefined : (v: string) => upd({ notes: v }),
      },
    }),
    defineBlock({
      id: "properties", type: "properties", priority: 40,
      props: { items: propRows, columns: 2 },
    }),
    defineBlock({
      id: "checklist", type: "checklist", priority: 50,
      title: "قائمة البنود",
      props: {
        items: checklist.map((c) => ({ id: c.id, text: c.text, done: c.done })),
        onToggle: readonly ? undefined : (id: string, next: boolean) => m?.updCheck(id, { done: next }),
        onEdit: readonly ? undefined : (id: string, text: string) => m?.updCheck(id, { text }),
        onDelete: readonly ? undefined : (id: string) => m?.delCheck(id),
        onAdd: readonly ? undefined : (text: string) => m?.addCheck(text),
      },
    }),
    defineBlock({
      id: "subtasks", type: "checklist", priority: 55, title: "المهام الفرعية",
      props: {
        items: subtasks.map((s) => ({ id: s.id, text: s.title, done: s.done })),
        onToggle: readonly ? undefined : (id: string, next: boolean) => m?.updSub(id, { done: next }),
        onEdit: readonly ? undefined : (id: string, text: string) => m?.updSub(id, { title: text }),
        onDelete: readonly ? undefined : (id: string) => m?.delSub(id),
        onAdd: readonly ? undefined : (title: string) => m?.addSub(title),
      },
    }),
    defineBlock({
      id: "sub_items", type: "sub_items", priority: 57, title: "التقسيم الفرعي",
      layout: { span: 4 },
      props: { parentType: "task", parentId: task.id, readonly, allowConvertToTask: true },
    }),
    defineBlock({
      id: "tags", type: "tags", priority: 60,
      props: {
        tags: task.tags ?? [],
        onAdd: readonly ? undefined : (t: string) => upd({ tags: addRemove(task.tags ?? [], t) }),
        onRemove: readonly ? undefined : (t: string) => upd({ tags: (task.tags ?? []).filter((x) => x !== t) }),
      },
    }),
    defineBlock({
      id: "links", type: "links", priority: 65,
      props: {
        links: task.links ?? [],
        onAdd: readonly ? undefined : (l: string) => upd({ links: addRemove(task.links ?? [], l) }),
        onRemove: readonly ? undefined : (l: string) => upd({ links: (task.links ?? []).filter((x) => x !== l) }),
      },
    }),
  ];
}

// keep Fragment referenced (avoid tree-shake surprise in tests)
void Fragment;