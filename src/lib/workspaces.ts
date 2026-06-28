import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ItemTypeKey } from "@/lib/item-types";

export type WorkspaceStatus = "active" | "planning" | "on_hold" | "done" | "archived";

export type Workspace = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  cover_url: string | null;
  start_date: string | null;
  end_date: string | null;
  status: WorkspaceStatus;
  favorite: boolean;
  archived: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type WorkspaceItem = {
  id: string;
  user_id: string;
  workspace_id: string;
  item_type: ItemTypeKey;
  item_id: string;
  position: number;
  added_at: string;
};

export type WorkspaceLink = {
  id: string;
  user_id: string;
  workspace_id: string;
  title: string;
  url: string;
  description: string | null;
  favicon: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type SmartCollection = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  name: string;
  icon: string;
  color: string;
  item_type: ItemTypeKey;
  filters: Record<string, unknown>;
  position: number;
  created_at: string;
  updated_at: string;
};

export type WorkspaceActivity = {
  id: string;
  workspace_id: string;
  user_id: string;
  item_type: ItemTypeKey | null;
  item_id: string | null;
  action: "added" | "removed" | "updated" | "completed";
  meta: Record<string, unknown>;
  created_at: string;
};

export type WorkspaceStats = {
  workspace_id: string;
  tasks_count: number;
  notes_count: number;
  purchases_count: number;
  goals_count: number;
  learning_count: number;
  projects_count: number;
  travel_count: number;
  maintenance_count: number;
  items_count: number;
  done_tasks: number;
  total_tasks: number;
  progress: number;
  last_activity: string | null;
};

export const wsKeys = {
  all: ["workspaces"] as const,
  one: (id: string) => ["workspaces", id] as const,
  items: (id: string) => ["workspace_items", id] as const,
  links: (id: string) => ["workspace_links", id] as const,
  collections: (id: string | null) => ["smart_collections", id ?? "all"] as const,
  activity: (id: string) => ["workspace_activity", id] as const,
  stats: ["workspace_stats"] as const,
  statsOne: (id: string) => ["workspace_stats", id] as const,
};

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("غير مسجل الدخول");
  return data.user.id;
}

// ----------------- Workspaces -----------------
export const workspacesQuery = queryOptions({
  queryKey: wsKeys.all,
  queryFn: async (): Promise<Workspace[]> => {
    const { data, error } = await supabase
      .from("workspaces").select("*")
      .order("favorite", { ascending: false })
      .order("position", { ascending: true })
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Workspace[];
  },
});

export function useWorkspaces() { return useQuery(workspacesQuery); }

export function useWorkspace(id: string) {
  return useQuery({
    queryKey: wsKeys.one(id),
    queryFn: async (): Promise<Workspace | null> => {
      const { data, error } = await supabase.from("workspaces").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as Workspace | null) ?? null;
    },
    enabled: !!id,
  });
}

export function useAllWorkspaceStats() {
  return useQuery({
    queryKey: wsKeys.stats,
    queryFn: async (): Promise<WorkspaceStats[]> => {
      const { data, error } = await supabase.from("workspace_stats").select("*");
      if (error) throw error;
      return (data ?? []) as WorkspaceStats[];
    },
  });
}

export function useWorkspaceStats(id: string) {
  return useQuery({
    queryKey: wsKeys.statsOne(id),
    queryFn: async (): Promise<WorkspaceStats | null> => {
      const { data, error } = await supabase.from("workspace_stats").select("*").eq("workspace_id", id).maybeSingle();
      if (error) throw error;
      return (data as WorkspaceStats | null) ?? null;
    },
    enabled: !!id,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Workspace> & { name: string }): Promise<Workspace> => {
      const user_id = await uid();
      const { data, error } = await supabase.from("workspaces").insert({
        user_id,
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? "primary",
        icon: input.icon ?? "FolderKanban",
        cover_url: input.cover_url ?? null,
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
        status: input.status ?? "active",
      }).select("*").single();
      if (error) throw error;
      return data as Workspace;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: wsKeys.all }),
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Workspace> }) => {
      const { error } = await supabase.from("workspaces").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: wsKeys.all });
      qc.invalidateQueries({ queryKey: wsKeys.one(v.id) });
    },
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspaces").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: wsKeys.all }),
  });
}

// ----------------- Items (polymorphic link) -----------------
export function useWorkspaceItems(workspaceId: string) {
  return useQuery({
    queryKey: wsKeys.items(workspaceId),
    queryFn: async (): Promise<WorkspaceItem[]> => {
      const { data, error } = await supabase
        .from("workspace_items").select("*")
        .eq("workspace_id", workspaceId)
        .order("position", { ascending: true })
        .order("added_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WorkspaceItem[];
    },
    enabled: !!workspaceId,
  });
}

export function useLinkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, itemType, itemId }: {
      workspaceId: string; itemType: ItemTypeKey; itemId: string;
    }) => {
      const user_id = await uid();
      const { error } = await supabase.from("workspace_items").upsert({
        workspace_id: workspaceId, user_id, item_type: itemType, item_id: itemId,
      }, { onConflict: "workspace_id,item_type,item_id" });
      if (error) throw error;
      await supabase.from("workspace_activity").insert({
        workspace_id: workspaceId, user_id, item_type: itemType, item_id: itemId, action: "added", meta: {},
      });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: wsKeys.items(v.workspaceId) });
      qc.invalidateQueries({ queryKey: wsKeys.stats });
      qc.invalidateQueries({ queryKey: wsKeys.statsOne(v.workspaceId) });
      qc.invalidateQueries({ queryKey: wsKeys.activity(v.workspaceId) });
    },
  });
}

export function useUnlinkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, itemType, itemId }: {
      workspaceId: string; itemType: ItemTypeKey; itemId: string;
    }) => {
      const user_id = await uid();
      const { error } = await supabase.from("workspace_items").delete()
        .eq("workspace_id", workspaceId).eq("item_type", itemType).eq("item_id", itemId);
      if (error) throw error;
      await supabase.from("workspace_activity").insert({
        workspace_id: workspaceId, user_id, item_type: itemType, item_id: itemId, action: "removed", meta: {},
      });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: wsKeys.items(v.workspaceId) });
      qc.invalidateQueries({ queryKey: wsKeys.stats });
      qc.invalidateQueries({ queryKey: wsKeys.statsOne(v.workspaceId) });
      qc.invalidateQueries({ queryKey: wsKeys.activity(v.workspaceId) });
    },
  });
}

// ----------------- Links -----------------
export function useWorkspaceLinks(workspaceId: string) {
  return useQuery({
    queryKey: wsKeys.links(workspaceId),
    queryFn: async (): Promise<WorkspaceLink[]> => {
      const { data, error } = await supabase.from("workspace_links")
        .select("*").eq("workspace_id", workspaceId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorkspaceLink[];
    },
    enabled: !!workspaceId,
  });
}

export function useAddLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, title, url, description }: {
      workspaceId: string; title: string; url: string; description?: string;
    }) => {
      const user_id = await uid();
      let favicon: string | null = null;
      try { favicon = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; } catch { /* ignore */ }
      const { error } = await supabase.from("workspace_links").insert({
        user_id, workspace_id: workspaceId, title, url, description: description ?? null, favicon,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: wsKeys.links(v.workspaceId) }),
  });
}

export function useDeleteLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; workspaceId: string }) => {
      const { error } = await supabase.from("workspace_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: wsKeys.links(v.workspaceId) }),
  });
}

// ----------------- Activity -----------------
export function useWorkspaceActivity(workspaceId: string, limit = 20) {
  return useQuery({
    queryKey: wsKeys.activity(workspaceId),
    queryFn: async (): Promise<WorkspaceActivity[]> => {
      const { data, error } = await supabase.from("workspace_activity")
        .select("*").eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []) as WorkspaceActivity[];
    },
    enabled: !!workspaceId,
  });
}

// ----------------- Smart Collections -----------------
export function useSmartCollections(workspaceId: string | null) {
  return useQuery({
    queryKey: wsKeys.collections(workspaceId),
    queryFn: async (): Promise<SmartCollection[]> => {
      let q = supabase.from("smart_collections").select("*").order("position", { ascending: true });
      q = workspaceId ? q.eq("workspace_id", workspaceId) : q.is("workspace_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SmartCollection[];
    },
  });
}

export function useCreateSmartCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<SmartCollection> & { name: string; item_type: ItemTypeKey }) => {
      const user_id = await uid();
      const { error } = await supabase.from("smart_collections").insert({
        user_id,
        workspace_id: input.workspace_id ?? null,
        name: input.name,
        icon: input.icon ?? "Sparkles",
        color: input.color ?? "accent",
        item_type: input.item_type,
        filters: (input.filters ?? {}) as never,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: wsKeys.collections(v.workspace_id ?? null) }),
  });
}

export function useDeleteSmartCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; workspaceId: string | null }) => {
      const { error } = await supabase.from("smart_collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: wsKeys.collections(v.workspaceId) }),
  });
}