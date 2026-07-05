import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useDeleteTask, useUpdateTask } from "@/lib/data";
import { useDeletePurchaseList, useUpdatePurchaseList } from "@/lib/purchases";
import { useDeletePlan, useUpdatePlan } from "@/lib/plans";
import { share as shareService } from "@/services";
import { emit } from "./block-events";

export type ItemKind = "task" | "purchase" | "plan" | "note" | "workspace";

/**
 * Common actions for any item kind. Pages call `useItemActions(kind, id)`
 * once and pass the result to the Toolbar / Inspector — no per-page glue.
 */
export function useItemActions(kind: ItemKind, id: string) {
  const nav = useNavigate();
  const updateTask = useUpdateTask();
  const delTask = useDeleteTask();
  const updatePurchase = useUpdatePurchaseList();
  const delPurchase = useDeletePurchaseList();
  const updatePlan = useUpdatePlan();
  const delPlan = useDeletePlan();

  const listRoute: Record<ItemKind, string> = {
    task: "/tasks", purchase: "/purchases", plan: "/plans", note: "/notes", workspace: "/workspaces",
  };

  const update = useCallback((patch: Record<string, unknown>) => {
    emit("item:update", { kind, id, patch });
    if (kind === "task") updateTask.mutate({ id, patch: patch as any });
    else if (kind === "purchase") updatePurchase.mutate({ id, patch: patch as any });
    else if (kind === "plan") updatePlan.mutate({ id, patch: patch as any });
  }, [kind, id, updateTask, updatePurchase, updatePlan]);

  const remove = useCallback(() => {
    if (typeof window !== "undefined" && !window.confirm("حذف هذا العنصر؟")) return;
    emit("item:delete", { kind, id });
    const done = () => { nav({ to: listRoute[kind] }); };
    if (kind === "task") delTask.mutate(id, { onSuccess: done });
    else if (kind === "purchase") delPurchase.mutate(id, { onSuccess: done });
    else if (kind === "plan") delPlan.mutate(id, { onSuccess: done });
  }, [kind, id, delTask, delPurchase, delPlan, nav]);

  const favorite = useCallback((value: boolean) => {
    emit("item:favorite", { kind, id, value });
    if (kind === "task") update({ favorite: value });
    else if (kind === "plan") update({ is_favorite: value });
    // purchase list has no favorite field — no-op
  }, [kind, id, update]);

  const archive = useCallback((value: boolean) => {
    emit("item:archive", { kind, id, value });
    if (kind === "task") update({ archived: value });
    else if (kind === "purchase") update({ status: value ? "archived" : "active" });
    else if (kind === "plan") update({ archived_at: value ? new Date().toISOString() : null });
  }, [kind, id, update]);

  const share = useCallback(async (payload?: { title?: string; text?: string; url?: string }) => {
    emit("item:share", { kind, id });
    const url = payload?.url ?? (typeof window !== "undefined" ? window.location.href : "");
    await shareService.share({ title: payload?.title, text: payload?.text, url });
  }, [kind, id]);

  const duplicate = useCallback(() => { emit("item:duplicate", { kind, id }); }, [kind, id]);
  const exportItem = useCallback((format?: string) => { emit("item:export", { kind, id, format }); }, [kind, id]);

  return { update, remove, favorite, archive, share, duplicate, export: exportItem };
}

export type ItemActions = ReturnType<typeof useItemActions>;