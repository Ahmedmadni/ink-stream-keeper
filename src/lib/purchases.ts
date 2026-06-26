import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PurchaseList = {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  budget: number;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  status: "active" | "completed" | "archived" | "cancelled";
  priority: "low" | "med" | "high";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseItem = {
  id: string;
  user_id: string;
  purchase_list_id: string;
  title: string;
  quantity: number;
  expected_price: number;
  actual_price: number | null;
  store_name: string | null;
  brand: string | null;
  image_url: string | null;
  barcode: string | null;
  purchased: boolean;
  purchased_at: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PurchaseStats = {
  purchase_list_id: string;
  expected_total: number;
  actual_total: number;
  remaining_amount: number;
  items_count: number;
  purchased_count: number;
  progress: number;
};

export const purchaseKeys = {
  lists: ["purchase_lists"] as const,
  list: (id: string) => ["purchase_lists", id] as const,
  items: (listId: string) => ["purchase_items", listId] as const,
  stats: (listId: string) => ["purchase_stats", listId] as const,
  allStats: ["purchase_stats"] as const,
};

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("غير مسجل الدخول");
  return data.user.id;
}

export const purchaseListsQuery = queryOptions({
  queryKey: purchaseKeys.lists,
  queryFn: async (): Promise<PurchaseList[]> => {
    const { data, error } = await supabase
      .from("purchase_lists")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PurchaseList[];
  },
});

export function usePurchaseLists() { return useQuery(purchaseListsQuery); }

export function usePurchaseList(id: string) {
  return useQuery({
    queryKey: purchaseKeys.list(id),
    queryFn: async (): Promise<PurchaseList | null> => {
      const { data, error } = await supabase
        .from("purchase_lists").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as PurchaseList | null) ?? null;
    },
    enabled: !!id,
  });
}

export function usePurchaseItems(listId: string) {
  return useQuery({
    queryKey: purchaseKeys.items(listId),
    queryFn: async (): Promise<PurchaseItem[]> => {
      const { data, error } = await supabase
        .from("purchase_items")
        .select("*")
        .eq("purchase_list_id", listId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PurchaseItem[];
    },
    enabled: !!listId,
  });
}

export function usePurchaseStats(listId: string) {
  return useQuery({
    queryKey: purchaseKeys.stats(listId),
    queryFn: async (): Promise<PurchaseStats | null> => {
      const { data, error } = await supabase
        .from("purchase_list_stats")
        .select("*")
        .eq("purchase_list_id", listId)
        .maybeSingle();
      if (error) throw error;
      return (data as PurchaseStats | null) ?? null;
    },
    enabled: !!listId,
  });
}

export function useAllPurchaseStats() {
  return useQuery({
    queryKey: purchaseKeys.allStats,
    queryFn: async (): Promise<PurchaseStats[]> => {
      const { data, error } = await supabase.from("purchase_list_stats").select("*");
      if (error) throw error;
      return (data ?? []) as PurchaseStats[];
    },
  });
}

export function useCreatePurchaseList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PurchaseList> & { title: string }) => {
      const user_id = await uid();
      const { data, error } = await supabase
        .from("purchase_lists")
        .insert({
          user_id,
          title: input.title,
          description: input.description ?? null,
          budget: input.budget ?? 0,
          currency: input.currency ?? "SAR",
          priority: input.priority ?? "med",
          status: input.status ?? "active",
          category_id: input.category_id ?? null,
          start_date: input.start_date ?? null,
          end_date: input.end_date ?? null,
          notes: input.notes ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as PurchaseList;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: purchaseKeys.lists }),
  });
}

export function useUpdatePurchaseList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PurchaseList> }) => {
      const { error } = await supabase.from("purchase_lists").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: purchaseKeys.lists });
      qc.invalidateQueries({ queryKey: purchaseKeys.list(vars.id) });
      qc.invalidateQueries({ queryKey: purchaseKeys.stats(vars.id) });
    },
  });
}

export function useDeletePurchaseList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: purchaseKeys.lists }),
  });
}

export function useAddPurchaseItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, sort, ...rest }: {
      listId: string; sort: number;
      title: string; quantity?: number; expected_price?: number;
      store_name?: string | null; brand?: string | null;
    }) => {
      const user_id = await uid();
      const { error } = await supabase.from("purchase_items").insert({
        user_id, purchase_list_id: listId, sort_order: sort,
        title: rest.title,
        quantity: rest.quantity ?? 1,
        expected_price: rest.expected_price ?? 0,
        store_name: rest.store_name ?? null,
        brand: rest.brand ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: purchaseKeys.items(vars.listId) });
      qc.invalidateQueries({ queryKey: purchaseKeys.stats(vars.listId) });
    },
  });
}

export function useUpdatePurchaseItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, listId, patch }: {
      id: string; listId: string; patch: Partial<PurchaseItem>;
    }) => {
      // Stamp purchased_at automatically when toggling
      const next: Partial<PurchaseItem> = { ...patch };
      if (patch.purchased === true) next.purchased_at = new Date().toISOString();
      if (patch.purchased === false) next.purchased_at = null;
      const { error } = await supabase.from("purchase_items").update(next).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: purchaseKeys.items(vars.listId) });
      qc.invalidateQueries({ queryKey: purchaseKeys.stats(vars.listId) });
    },
  });
}

export function useDeletePurchaseItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; listId: string }) => {
      const { error } = await supabase.from("purchase_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: purchaseKeys.items(vars.listId) });
      qc.invalidateQueries({ queryKey: purchaseKeys.stats(vars.listId) });
    },
  });
}

export function useReorderPurchaseItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, ordered }: { listId: string; ordered: string[] }) => {
      // Send one update per id; small lists, fine in parallel.
      await Promise.all(
        ordered.map((id, idx) =>
          supabase.from("purchase_items").update({ sort_order: idx }).eq("id", id),
        ),
      );
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: purchaseKeys.items(vars.listId) }),
  });
}