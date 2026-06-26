import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * Generic checkable/editable row.
 * Reused by: purchase items, task checklists, learning lessons,
 * goal milestones... Memoized to keep large lists snappy (100+ items).
 */
export type EditableChecklistRowProps = {
  id: string;
  checked: boolean;
  text: string;
  /** Optional rich right-side content (price, store, badges). */
  right?: ReactNode;
  /** Optional left/leading content (image, drag handle). */
  leading?: ReactNode;
  /** Optional sub-line under text (metadata). */
  subtitle?: ReactNode;
  className?: string;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
  onTextChange?: (next: string) => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

function EditableChecklistRowImpl(p: EditableChecklistRowProps) {
  const [draft, setDraft] = useState(p.text);
  const last = useRef(p.text);
  useEffect(() => {
    if (p.text !== last.current) {
      last.current = p.text;
      setDraft(p.text);
    }
  }, [p.text]);

  function commit() {
    if (!p.onTextChange) return;
    if (draft.trim() && draft !== p.text) p.onTextChange(draft.trim());
  }

  return (
    <div
      className={cn(
        "group grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-card p-3 shadow-card transition-opacity",
        p.checked && "opacity-70",
        p.className,
      )}
    >
      <Checkbox
        checked={p.checked}
        disabled={p.disabled}
        onCheckedChange={(v) => p.onToggle(!!v)}
        aria-label="تبديل الإنجاز"
      />
      {p.leading ?? <span className="size-0" />}
      <div className="min-w-0">
        {p.onTextChange ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className={cn(
              "w-full bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground",
              p.checked && "line-through",
            )}
            placeholder="اكتب هنا…"
          />
        ) : (
          <p className={cn("truncate text-sm font-semibold", p.checked && "line-through")}>
            {p.text}
          </p>
        )}
        {p.subtitle ? (
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{p.subtitle}</div>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        {p.right}
        {p.onMoveUp ? (
          <button onClick={p.onMoveUp} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted" aria-label="أعلى">
            <ArrowUp className="size-4" />
          </button>
        ) : null}
        {p.onMoveDown ? (
          <button onClick={p.onMoveDown} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted" aria-label="أسفل">
            <ArrowDown className="size-4" />
          </button>
        ) : null}
        {p.onDelete ? (
          <button onClick={p.onDelete} className="grid size-7 place-items-center rounded-md text-destructive hover:bg-destructive/10" aria-label="حذف">
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export const EditableChecklistRow = memo(EditableChecklistRowImpl);