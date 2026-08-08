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

export const MAX_SUBITEM_DEPTH = 2; // 0,1,2 → ثلاثة مستويات

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
  itemId: string; action: string; parentType: string; parentId: string; meta?: Record<string, unknown>;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return;
  await supabase.from("item_activity").insert({
    user_id: uid, item_type: "sub_item", item_id: input.itemId,
    parent_type: input.parentType, parent_id: input.parentId,
    action: input.action, meta: input.meta ?? {},
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
  };

  const add = useMutation({
    mutationFn: async (input: { title: string; parentItemId?: string | null; depth?: number; position?: number }) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("unauthenticated");
      const depth = Math.min(input.depth ?? 0, MAX_SUBITEM_DEPTH);
      const { data, error } = await supabase.from("sub_items").insert({
        user_id: uid,
        parent_type: parentType,
        parent_id: parentId,
        parent_item_id: input.parentItemId ?? null,
        depth,
        title: input.title,
        position: input.position ?? 0,
      } as never).select("*").single();
      if (error) throw error;
      await logActivity({ itemId: (data as any).id, action: "created", parentType, parentId, meta: { title: input.title } });
      return data as unknown as SubItem;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SubItem> }) => {
      const { error } = await supabase.from("sub_items").update(patch as never).eq("id", id);
      if (error) throw error;
      const action = patch.done === true ? "completed" : patch.done === false ? "reopened" : "updated";
      await logActivity({ itemId: id, action, parentType, parentId, meta: patch as Record<string, unknown> });
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<SubItem[]>(key);
      patchCache((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } as SubItem : r)));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
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
          if (r.parent_item_id && doomed.has(r.parent_item_id) && !doomed.has(r.id)) { doomed.add(r.id); changed = true; }
        }
      }
      patchCache((all) => all.filter((r) => !doomed.has(r.id)));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: invalidate,
  });

  /** Reorder / indent / outdent / move — one primitive. */
  const move = useMutation({
    mutationFn: async (rows: { id: string; position: number; parent_item_id: string | null; depth: number }[]) => {
      for (const r of rows) {
        const { error } = await supabase.from("sub_items")
          .update({ position: r.position, parent_item_id: r.parent_item_id, depth: r.depth } as never)
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
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: invalidate,
  });

  /** Convert a sub-item into a real Task, keeping a back-link. */
  const convertToTask = useMutation({
    mutationFn: async (item: SubItem) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("unauthenticated");
      const { data, error } = await supabase.from("tasks").insert({
        user_id: uid,
        title: item.title,
        description: item.description,
        notes: item.notes,
        priority: (item.priority as "low" | "med" | "high") ?? "med",
        due_at: item.end_at,
        start_at: item.start_at,
        reminder_at: item.reminder_at,
      } as never).select("id").single();
      if (error) throw error;
      const taskId = (data as any).id as string;
      await supabase.from("sub_items").update({ converted_task_id: taskId } as never).eq("id", item.id);
      await logActivity({ itemId: item.id, action: "converted", parentType, parentId, meta: { taskId } });
      return taskId;
    },
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["tasks"] }); },
  });

  return { add, update, remove, move, convertToTask };
}

/** Rollup: a parent's progress = weighted completion of its whole subtree. */
export function computeSubItemsProgress(rows: SubItem[]): { pct: number; done: number; total: number } {
  if (!rows.length) return { pct: 0, done: 0, total: 0 };
  const done = rows.filter((r) => r.done).length;
  return { pct: Math.round((done / rows.length) * 100), done, total: rows.length };
}

/** Progress of a single node including its descendants. */
export function nodeProgress(rows: SubItem[], id: string): { pct: number; done: number; total: number } {
  const children = rows.filter((r) => r.parent_item_id === id);
  if (!children.length) {
    const self = rows.find((r) => r.id === id);
    return { pct: self?.done ? 100 : (self?.progress ?? 0), done: self?.done ? 1 : 0, total: 1 };
  }
  let done = 0, total = 0;
  for (const c of children) {
    const p = nodeProgress(rows, c.id);
    done += p.done; total += p.total;
  }
  return { pct: total ? Math.round((done / total) * 100) : 0, done, total };
}

/** Build the visible tree order (depth-first) from a flat list. */
export type SubItemNode = SubItem & { children: SubItemNode[] };
export function buildTree(rows: SubItem[]): SubItemNode[] {
  const map = new Map<string, SubItemNode>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));
  const roots: SubItemNode[] = [];
  map.forEach((n) => {
    if (n.parent_item_id && map.has(n.parent_item_id)) map.get(n.parent_item_id)!.children.push(n);
    else roots.push(n);
  });
  const sortRec = (list: SubItemNode[]) => {
    list.sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}