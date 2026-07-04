import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { BlockRendererProps } from "@/lib/engine/blocks";
import { emit } from "@/lib/engine/block-events";

export type TagsBlockProps = {
  tags: string[];
  emptyLabel?: string;
  onAdd?: (tag: string) => void;
  onRemove?: (tag: string) => void;
};

export function TagsBlock({ block }: BlockRendererProps<TagsBlockProps>) {
  const { tags, emptyLabel = "لا توجد وسوم.", onAdd, onRemove } = block.props;
  const [draft, setDraft] = useState("");
  const canEdit = !!(onAdd || onRemove);
  if (!tags.length && !canEdit) return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
            {t}
            {onRemove && (
              <button type="button" onClick={() => { onRemove(t); emit("tag:remove", { tag: t }); }} aria-label={`حذف ${t}`}>
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {onAdd && (
        <form
          onSubmit={(e) => { e.preventDefault(); const v = draft.trim(); if (!v) return; onAdd(v); emit("tag:add", { tag: v }); setDraft(""); }}
          className="flex items-center gap-2"
        >
          <Plus className="size-4 text-muted-foreground" />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="وسم جديد..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </form>
      )}
    </div>
  );
}