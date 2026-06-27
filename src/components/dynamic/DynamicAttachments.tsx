import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Paperclip, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ItemTypeKey } from "@/lib/item-types";

type ItemAttachment = {
  id: string; user_id: string;
  item_type: string; item_id: string;
  name: string; mime_type: string; size_bytes: number;
  storage_path: string; created_at: string;
};

/**
 * Polymorphic attachments — works for any item type (task, purchase_list,
 * learning_plan, goal...). Reads/writes `item_attachments`.
 */
export function DynamicAttachments({
  itemType, itemId, bucket = "note-attachments",
}: {
  itemType: ItemTypeKey;
  itemId: string;
  bucket?: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const queryKey = ["item_attachments", itemType, itemId] as const;

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_attachments").select("*")
        .eq("item_type", itemType).eq("item_id", itemId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as ItemAttachment[];
      return Promise.all(list.map(async (a) => {
        const { data: s } = await supabase.storage.from(bucket).createSignedUrl(a.storage_path, 3600);
        return { ...a, url: s?.signedUrl ?? "" };
      }));
    },
    enabled: !!itemId,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل الدخول");
      const path = `${u.user.id}/${itemType}/${itemId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600", upsert: false,
        contentType: file.type || "application/octet-stream",
      });
      if (upErr) throw upErr;
      const { error } = await supabase.from("item_attachments").insert({
        user_id: u.user.id, item_type: itemType, item_id: itemId,
        name: file.name, mime_type: file.type || "application/octet-stream",
        size_bytes: file.size, storage_path: path,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: async (a: ItemAttachment) => {
      await supabase.storage.from(bucket).remove([a.storage_path]);
      const { error } = await supabase.from("item_attachments").delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">المرفقات</h3>
        <button
          type="button" onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary"
        >
          {upload.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
          إضافة
        </button>
        <input ref={fileRef} type="file" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
      </div>
      {isLoading ? <p className="text-xs text-muted-foreground">جاري التحميل...</p> : null}
      {items.length === 0 && !isLoading ? (
        <p className="rounded-2xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">لا توجد مرفقات.</p>
      ) : null}
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-2 rounded-2xl bg-card p-2 shadow-card">
            <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-xs font-semibold text-primary">
              {a.name}
            </a>
            <span className="text-[10px] text-muted-foreground">{(a.size_bytes / 1024).toFixed(1)} KB</span>
            <button type="button" onClick={() => remove.mutate(a)} className="grid size-7 place-items-center rounded-full text-destructive hover:bg-destructive/10">
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}