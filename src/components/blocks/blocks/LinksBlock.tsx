import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { BlockRendererProps } from "@/lib/engine/blocks";
import { emit } from "@/lib/engine/block-events";

export type LinksBlockProps = {
  links: string[];
  emptyLabel?: string;
  onAdd?: (url: string) => void;
  onRemove?: (url: string) => void;
};

export function LinksBlock({ block }: BlockRendererProps<LinksBlockProps>) {
  const { links, emptyLabel = "لا توجد روابط.", onAdd, onRemove } = block.props;
  const [draft, setDraft] = useState("");
  const canEdit = !!(onAdd || onRemove);
  if (!links.length && !canEdit) return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {links.map((l) => (
          <li key={l} className="group flex items-center gap-2 rounded-md p-1 hover:bg-secondary/60">
            <a href={l} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-xs text-primary underline">{l}</a>
            {onRemove && (
              <button type="button" onClick={() => { onRemove(l); emit("link:remove", { url: l }); }} className="opacity-0 group-hover:opacity-100" aria-label="حذف">
                <X className="size-4 text-muted-foreground" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {onAdd && (
        <form
          onSubmit={(e) => { e.preventDefault(); const v = draft.trim(); if (!v) return; onAdd(v); emit("link:add", { url: v }); setDraft(""); }}
          className="flex items-center gap-2"
        >
          <Plus className="size-4 text-muted-foreground" />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="https://..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </form>
      )}
    </div>
  );
}