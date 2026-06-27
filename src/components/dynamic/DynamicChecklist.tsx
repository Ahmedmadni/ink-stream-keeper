import { useState } from "react";
import { Plus } from "lucide-react";
import { EditableChecklistRow } from "@/components/items/EditableChecklistRow";

export type DynamicChecklistItem = {
  id: string; text: string; done: boolean;
  right?: React.ReactNode; subtitle?: React.ReactNode;
};

/**
 * Schema-agnostic checklist wrapper around the existing EditableChecklistRow.
 * Used for task checklists, purchase items, learning lessons, milestones...
 */
export function DynamicChecklist({
  title = "العناصر", items, onAdd, onToggle, onTextChange, onDelete, addPlaceholder = "أضف عنصراً...",
}: {
  title?: React.ReactNode;
  items: DynamicChecklistItem[];
  onAdd: (text: string) => void | Promise<void>;
  onToggle: (id: string, next: boolean) => void | Promise<void>;
  onTextChange?: (id: string, next: string) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  addPlaceholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const submit = () => { const t = draft.trim(); if (!t) return; onAdd(t); setDraft(""); };
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.id}>
            <EditableChecklistRow
              id={i.id} checked={i.done} text={i.text}
              right={i.right} subtitle={i.subtitle}
              onToggle={(n) => onToggle(i.id, n)}
              onTextChange={onTextChange ? (n) => onTextChange(i.id, n) : undefined}
              onDelete={onDelete ? () => onDelete(i.id) : undefined}
            />
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="flex items-center gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={addPlaceholder}
          className="flex-1 rounded-2xl bg-card px-4 py-2.5 text-sm outline-none shadow-card focus:ring-2 focus:ring-primary" />
        <button type="submit" className="grid size-10 place-items-center rounded-full gradient-primary text-primary-foreground shadow-fab">
          <Plus className="size-4" />
        </button>
      </form>
    </section>
  );
}