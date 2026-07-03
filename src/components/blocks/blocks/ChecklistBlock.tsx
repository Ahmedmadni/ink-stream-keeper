import type { ReactNode } from "react";
import { Check as CheckIcon } from "lucide-react";
import type { BlockRendererProps } from "@/lib/engine/blocks";

export type ChecklistBlockItem = { id: string; text: ReactNode; done: boolean };
export type ChecklistBlockProps = {
  items: ChecklistBlockItem[];
  emptyLabel?: string;
  onToggle?: (id: string, done: boolean) => void;
};

export function ChecklistBlock({ block }: BlockRendererProps<ChecklistBlockProps>) {
  const { items, emptyLabel = "لا توجد بنود.", onToggle } = block.props;
  if (!items.length) return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((c) => (
        <li key={c.id} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-secondary/60">
          <button
            type="button"
            onClick={() => onToggle?.(c.id, !c.done)}
            className={`grid size-5 shrink-0 place-items-center rounded border-2 transition-colors ${c.done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
            aria-label="تبديل"
          >
            {c.done && <CheckIcon className="size-3.5" strokeWidth={3} />}
          </button>
          <span className={`min-w-0 flex-1 text-sm ${c.done ? "text-muted-foreground line-through" : ""}`}>{c.text}</span>
        </li>
      ))}
    </ul>
  );
}