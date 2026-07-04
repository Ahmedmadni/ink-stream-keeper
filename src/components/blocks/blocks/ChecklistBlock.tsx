import { useState, type ReactNode } from "react";
import { Check as CheckIcon, Plus, X } from "lucide-react";
import type { BlockRendererProps } from "@/lib/engine/blocks";
import { emit } from "@/lib/engine/block-events";

export type ChecklistBlockItem = { id: string; text: ReactNode; done: boolean };
export type ChecklistBlockProps = {
  items: ChecklistBlockItem[];
  emptyLabel?: string;
  onToggle?: (id: string, done: boolean) => void;
  onAdd?: (text: string) => void;
  onEdit?: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
  editable?: boolean;
};

export function ChecklistBlock({ block }: BlockRendererProps<ChecklistBlockProps>) {
  const { items, emptyLabel = "لا توجد بنود.", onToggle, onAdd, onEdit, onDelete, editable } = block.props;
  const [draft, setDraft] = useState("");
  const canEdit = editable ?? !!(onAdd || onEdit || onDelete);
  if (!items.length && !canEdit) return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  return (
    <>
    <ul className="space-y-1.5">
      {items.map((c) => (
        <li key={c.id} className="group flex items-center gap-2 rounded-lg p-1.5 hover:bg-secondary/60">
          <button
            type="button"
            onClick={() => { onToggle?.(c.id, !c.done); emit("checklist:toggle", { itemId: c.id, done: !c.done }); }}
            className={`grid size-5 shrink-0 place-items-center rounded border-2 transition-colors ${c.done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
            aria-label="تبديل"
          >
            {c.done && <CheckIcon className="size-3.5" strokeWidth={3} />}
          </button>
          {onEdit && typeof c.text === "string" ? (
            <input
              defaultValue={c.text}
              onBlur={(e) => { if (e.target.value !== c.text) { onEdit(c.id, e.target.value); emit("checklist:edit", { itemId: c.id, text: e.target.value }); } }}
              className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${c.done ? "text-muted-foreground line-through" : ""}`}
            />
          ) : (
            <span className={`min-w-0 flex-1 text-sm ${c.done ? "text-muted-foreground line-through" : ""}`}>{c.text}</span>
          )}
          {onDelete && (
            <button onClick={() => { onDelete(c.id); emit("checklist:delete", { itemId: c.id }); }} className="opacity-0 group-hover:opacity-100" aria-label="حذف">
              <X className="size-4 text-muted-foreground" />
            </button>
          )}
        </li>
      ))}
    </ul>
    {onAdd && (
      <form
        onSubmit={(e) => { e.preventDefault(); const v = draft.trim(); if (!v) return; onAdd(v); emit("checklist:add", { text: v }); setDraft(""); }}
        className="mt-2 flex items-center gap-2"
      >
        <Plus className="size-4 text-muted-foreground" />
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="إضافة بند..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </form>
    )}
    </>
  );
}