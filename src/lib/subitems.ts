/**
 * Universal Sub-Items layer (P0.1)
 * -----------------------------------------------------------------
 * One polymorphic model for: Task → بنود، Note → checklist،
 * Plan → steps/substeps، Purchase → items، Workspace → أي عنصر.
 * Built ON TOP of the frozen engines — no engine was modified.
 */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SubItemParentType = "task" | "note" | "plan" | "purchase" | "workspace" | "plan_step";

export type SubItem = {
  id: string;
  user_id: string;
  parent_type: string;
  parent_id: string;
  parent_item_id: string | null;
  depth: number;
  title: string;
  description: string | null;
  notes: string | null;
  status: string;
  priority: string;
  progress: number;
  done: boolean;
  done_at: string | null;
  start_at: string | null;
  end_at: string | null;
  reminder_at: string | null;
  position: number;
  converted_task_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export const MAX_SUBITEM_DEPTH = 5; // 0..5 → ستة مستويات

export const subItemKeys = {
  list: (t: string, id: string) => ["sub_items", t, id] as const,
  activity: (t: string, id: string) => ["item_activity", t, id] as const,
};

export function useSubItems(parentType: SubItemParentType, parentId: string | undefined) {
  return useQuery({
    queryKey: subItemKeys.list(parentType, parentId ?? "none"),
    enabled: !!parentId,
    queryFn: async (): Promise<SubItem[]> => {
      const { data, error } = await supabase
        .from("sub_items")
        .select("*")
        .eq("parent_type", parentType)
        .eq("parent_id", parentId!)
        .order("depth", { ascending: true })
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SubItem[];
    },
  });
}

async function logActivity(input: {
  itemId: string;
  action: string;
  parentType: string;
  parentId: string;
  meta?: Record<string, unknown>;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return;
  await supabase.from("item_activity").insert({
    user_id: uid,
    item_type: "sub_item",
    item_id: input.itemId,
    parent_type: input.parentType,
    parent_id: input.parentId,
    action: input.action,
    meta: input.meta ?? {},
  } as never);
}

export function useItemActivity(parentType: SubItemParentType, parentId: string | undefined) {
  return useQuery({
    queryKey: subItemKeys.activity(parentType, parentId ?? "none"),
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_activity")
        .select("*")
        .eq("parent_type", parentType)
        .eq("parent_id", parentId!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** All mutations for one parent — optimistic, debounce-friendly. */
export function useSubItemMutations(parentType: SubItemParentType, parentId: string) {
  const qc = useQueryClient();
  const key = subItemKeys.list(parentType, parentId);
  const patchCache = useCallback(
    (fn: (rows: SubItem[]) => SubItem[]) => {
      qc.setQueryData<SubItem[]>(key, (old) => fn(old ?? []));
    },
    [qc, key],
  );
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: subItemKeys.activity(parentType, parentId) });
    if (parentType === "task") {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks", parentId] });
      qc.invalidateQueries({ queryKey: ["task-sub-item-summaries"] });
    }
  };

  const add = useMutation({
    mutationFn: async (input: {
      title: string;
      parentItemId?: string | null;
      depth?: number;
      position?: number;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("unauthenticated");
      const depth = Math.min(input.depth ?? 0, MAX_SUBITEM_DEPTH);
      const { data, error } = await supabase
        .from("sub_items")
        .insert({
          user_id: uid,
          parent_type: parentType,
          parent_id: parentId,
          parent_item_id: input.parentItemId ?? null,
          depth,
          title: input.title,
          position: input.position ?? 0,
        } as never)
        .select("*")
        .single();
      if (error) throw error;
      const created = data as unknown as Pick<SubItem, "id">;
      await logActivity({
        itemId: created.id,
        action: "created",
        parentType,
        parentId,
        meta: { title: input.title },
      });
      return data as unknown as SubItem;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SubItem> }) => {
      const { error } = await supabase
        .from("sub_items")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
      const action =
        patch.done === true ? "completed" : patch.done === false ? "reopened" : "updated";
      await logActivity({
        itemId: id,
        action,
        parentType,
        parentId,
        meta: patch as Record<string, unknown>,
      });
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<SubItem[]>(key);
      patchCache((rows) => rows.map((r) => (r.id === id ? ({ ...r, ...patch } as SubItem) : r)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sub_items").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<SubItem[]>(key);
      const doomed = new Set<string>([id]);
      let changed = true;
      const rows = prev ?? [];
      while (changed) {
        changed = false;
        for (const r of rows) {
          if (r.parent_item_id && doomed.has(r.parent_item_id) && !doomed.has(r.id)) {
            doomed.add(r.id);
            changed = true;
          }
        }
      }
      patchCache((all) => all.filter((r) => !doomed.has(r.id)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });

  /** Reorder / indent / outdent / move — one primitive. */
  const move = useMutation({
    mutationFn: async (
      rows: { id: string; position: number; parent_item_id: string | null; depth: number }[],
    ) => {
      for (const r of rows) {
        const { error } = await supabase
          .from("sub_items")
          .update({
            position: r.position,
            parent_item_id: r.parent_item_id,
            depth: r.depth,
          } as never)
          .eq("id", r.id);
        if (error) throw error;
      }
      if (rows.length) {
        await logActivity({ itemId: rows[0]!.id, action: "moved", parentType, parentId });
      }
    },
    onMutate: async (rows) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<SubItem[]>(key);
      const byId = new Map(rows.map((r) => [r.id, r]));
      patchCache((all) => all.map((r) => (byId.has(r.id) ? { ...r, ...byId.get(r.id)! } : r)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });

  /** Convert a sub-item into a real Task, keeping a back-link. */
  const convertToTask = useMutation({
    mutationFn: async (item: SubItem) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("unauthenticated");
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: uid,
          title: item.title,
          description: item.description,
          notes: item.notes,
          priority: (item.priority as "low" | "med" | "high") ?? "med",
          due_at: item.end_at,
          start_at: item.start_at,
          reminder_at: item.reminder_at,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      const taskId = (data as unknown as { id: string }).id;
      await supabase
        .from("sub_items")
        .update({ converted_task_id: taskId } as never)
        .eq("id", item.id);
      await logActivity({
        itemId: item.id,
        action: "converted",
        parentType,
        parentId,
        meta: { taskId },
      });
      return taskId;
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  return { add, update, remove, move, convertToTask };
}

/** Rollup: a parent's progress = weighted completion of its whole subtree. */
export function computeSubItemsProgress(rows: SubItem[]): {
  pct: number;
  done: number;
  total: number;
} {
  if (!rows.length) return { pct: 0, done: 0, total: 0 };
  const done = rows.filter((r) => r.done).length;
  return { pct: Math.round((done / rows.length) * 100), done, total: rows.length };
}

/** Progress of a single node including its descendants. */
export function nodeProgress(
  rows: SubItem[],
  id: string,
): { pct: number; done: number; total: number } {
  const children = rows.filter((r) => r.parent_item_id === id);
  if (!children.length) {
    const self = rows.find((r) => r.id === id);
    return { pct: self?.done ? 100 : (self?.progress ?? 0), done: self?.done ? 1 : 0, total: 1 };
  }
  let done = 0,
    total = 0;
  for (const c of children) {
    const p = nodeProgress(rows, c.id);
    done += p.done;
    total += p.total;
  }
  return { pct: total ? Math.round((done / total) * 100) : 0, done, total };
}

/** Build the visible tree order (depth-first) from a flat list. */
export type SubItemNode = SubItem & { children: SubItemNode[] };
export function compareChecklistItems(a: SubItem, b: SubItem): number {
  const priority: Record<string, number> = { high: 0, med: 1, medium: 1, low: 2 };
  return (
    Number(a.done) - Number(b.done) ||
    (priority[a.priority] ?? 1) - (priority[b.priority] ?? 1) ||
    a.position - b.position ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id)
  );
}

export function buildTree(rows: SubItem[], prioritize = false): SubItemNode[] {
  const map = new Map<string, SubItemNode>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));
  const roots: SubItemNode[] = [];
  map.forEach((n) => {
    if (n.parent_item_id && map.has(n.parent_item_id)) map.get(n.parent_item_id)!.children.push(n);
    else roots.push(n);
  });
  const sortRec = (list: SubItemNode[]) => {
    list.sort(
      prioritize
        ? compareChecklistItems
        : (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
    );
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}
/** تحويل نص مخطّط (Outline) إلى قائمة بنود بمستوياتها. */
export function parseOutline(outline: string, flat = false): { depth: number; title: string }[] {
  const out: { depth: number; title: string }[] = [];
  for (const raw of outline.split("\n")) {
    if (!raw.trim()) continue;
    const indent = raw.match(/^[\t ]*/)?.[0] ?? "";
    const tabs = (indent.match(/\t/g) ?? []).length;
    const spaces = indent.replace(/\t/g, "").length;
    const depth = flat ? 0 : Math.min(tabs + Math.floor(spaces / 2), MAX_SUBITEM_DEPTH);
    const title = raw
      .trim()
      .replace(/^[-*•]\s*/, "")
      .replace(/^\[[ xX]\]\s*/, "");
    if (title) out.push({ depth, title });
  }
  return out;
}

/**
 * إنشاء شجرة بنود من نص مخطّط (Outline):
 * كل سطر بند، والمسافات البادئة (أو "-") تحدد المستوى (حتى 6 مستويات).
 * يمكن تمرير `baseDepth` و`baseParentId` لإدراج الشجرة تحت بند موجود.
 */
export async function createSubItemsFromOutline(
  parentType: SubItemParentType,
  parentId: string,
  outline: string,
  opts: {
    baseDepth?: number;
    baseParentId?: string | null;
    startPosition?: number;
    /** Task checklists stay intentionally flat; other item types may use a tree. */
    flat?: boolean;
  } = {},
): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("unauthenticated");

  const lines = parseOutline(outline, opts.flat);
  if (!lines.length) return 0;

  const baseDepth = opts.baseDepth ?? 0;
  const stack: (string | null)[] = [];
  const counters: number[] = [];
  let created = 0;

  for (const line of lines) {
    const depth = opts.flat ? baseDepth : Math.min(line.depth + baseDepth, MAX_SUBITEM_DEPTH);
    const parentItemId = opts.flat
      ? (opts.baseParentId ?? null)
      : depth > baseDepth
        ? (stack[depth - 1] ?? opts.baseParentId ?? null)
        : (opts.baseParentId ?? null);
    counters[depth] =
      (counters[depth] ?? (depth === baseDepth ? (opts.startPosition ?? 0) : 0) - 1) + 1;

    const { data, error } = await supabase
      .from("sub_items")
      .insert({
        user_id: uid,
        parent_type: parentType,
        parent_id: parentId,
        parent_item_id: parentItemId,
        depth,
        title: line.title,
        position: counters[depth]!,
      } as never)
      .select("id")
      .single();
    if (error) throw error;

    stack[depth] = (data as { id: string }).id;
    stack.length = depth + 1;
    created += 1;
  }
  return created;
}

/**
 * ترحيل البنود القديمة (task_checklist + subtasks) إلى شجرة sub_items الموحّدة،
 * ثم حذف الصفوف القديمة — لإزالة الازدواجية نهائياً.
 */
export async function migrateLegacyTaskItems(taskId: string): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("unauthenticated");

  const [{ data: checks }, { data: subs }, { data: existing }] = await Promise.all([
    supabase.from("task_checklist").select("id,text,done,sort_order").eq("task_id", taskId),
    supabase.from("subtasks").select("id,title,done,sort_order").eq("task_id", taskId),
    supabase
      .from("sub_items")
      .select("position")
      .eq("parent_type", "task")
      .eq("parent_id", taskId)
      .is("parent_item_id", null),
  ]);

  const rows = [
    ...((subs ?? []) as { id: string; title: string; done: boolean; sort_order: number }[])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({ title: s.title, done: s.done })),
    ...((checks ?? []) as { id: string; text: string; done: boolean; sort_order: number }[])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({ title: c.text, done: c.done })),
  ];
  if (!rows.length) return 0;

  const base =
    Math.max(-1, ...((existing ?? []) as { position: number }[]).map((r) => r.position)) + 1;
  const { error } = await supabase.from("sub_items").insert(
    rows.map((r, i) => ({
      user_id: uid,
      parent_type: "task",
      parent_id: taskId,
      parent_item_id: null,
      depth: 0,
      title: r.title,
      done: r.done,
      status: r.done ? "done" : "todo",
      progress: r.done ? 100 : 0,
      position: base + i,
    })) as never,
  );
  if (error) throw error;

  await Promise.all([
    supabase.from("task_checklist").delete().eq("task_id", taskId),
    supabase.from("subtasks").delete().eq("task_id", taskId),
  ]);
  return rows.length;
}
