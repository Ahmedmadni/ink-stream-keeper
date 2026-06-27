import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ItemTypeKey } from "@/lib/item-types";

type Comment = { id: string; user_id: string; item_type: string; item_id: string; body: string; created_at: string };

export function DynamicComments({ itemType, itemId }: { itemType: ItemTypeKey; itemId: string }) {
  const qc = useQueryClient();
  const queryKey = ["item_comments", itemType, itemId] as const;
  const [draft, setDraft] = useState("");

  const { data: items = [] } = useQuery({
    queryKey,
    queryFn: async (): Promise<Comment[]> => {
      const { data, error } = await supabase.from("item_comments").select("*")
        .eq("item_type", itemType).eq("item_id", itemId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Comment[];
    },
    enabled: !!itemId,
  });

  const add = useMutation({
    mutationFn: async (body: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل الدخول");
      const { error } = await supabase.from("item_comments").insert({
        user_id: u.user.id, item_type: itemType, item_id: itemId, body,
      });
      if (error) throw error;
    },
    onSuccess: () => { setDraft(""); qc.invalidateQueries({ queryKey }); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("item_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold">التعليقات</h3>
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id} className="flex items-start gap-2 rounded-2xl bg-card p-3 shadow-card">
            <p className="flex-1 whitespace-pre-wrap text-sm">{c.body}</p>
            <button type="button" onClick={() => remove.mutate(c.id)} className="grid size-7 place-items-center rounded-full text-destructive hover:bg-destructive/10">
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); if (draft.trim()) add.mutate(draft.trim()); }}
        className="flex items-center gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="أضف تعليقاً..."
          className="flex-1 rounded-2xl bg-card px-4 py-2.5 text-sm outline-none shadow-card focus:ring-2 focus:ring-primary" />
        <button type="submit" disabled={add.isPending || !draft.trim()}
          className="grid size-10 place-items-center rounded-full gradient-primary text-primary-foreground shadow-fab disabled:opacity-60">
          {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </div>
  );
}