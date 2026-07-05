import { ArrowRight, Trash2, Share2, Star, Archive, Copy, Undo2, Redo2, Pencil } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import type { ItemActions } from "@/lib/engine/actions";
import { emit } from "@/lib/engine/block-events";

/**
 * Unified toolbar for every item detail page.
 * Pages pass in `actions` (from `useItemActions`) and optional metadata.
 */
export type ToolbarProps = {
  actions: ItemActions;
  title?: string;
  isFavorite?: boolean;
  isArchived?: boolean;
  editing?: boolean;
  onToggleEdit?: () => void;
  showBack?: boolean;
  right?: React.ReactNode;
  /** Plugin actions rendered before the default action group. */
  extraActions?: React.ReactNode;
};

export function Toolbar({
  actions, title, isFavorite, isArchived, editing, onToggleEdit, showBack = true, right, extraActions,
}: ToolbarProps) {
  const router = useRouter();
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-border/60 bg-background/95 px-3 py-2.5 backdrop-blur">
      {showBack && (
        <button
          onClick={() => router.history.back()}
          aria-label="رجوع"
          className="grid size-9 place-items-center rounded-full bg-card shadow-card transition hover:bg-muted"
        >
          <ArrowRight className="size-4" />
        </button>
      )}
      {title && <h1 className="me-auto truncate text-sm font-extrabold">{title}</h1>}
      {!title && <div className="me-auto" />}
      {right}
      {extraActions}
      {onToggleEdit && (
        <IconBtn label={editing ? "إنهاء التحرير" : "تحرير"} onClick={onToggleEdit} active={!!editing}>
          <Pencil className="size-4" />
        </IconBtn>
      )}
      <IconBtn label="تراجع" onClick={() => emit("history:undo", {})}><Undo2 className="size-4" /></IconBtn>
      <IconBtn label="إعادة" onClick={() => emit("history:redo", {})}><Redo2 className="size-4" /></IconBtn>
      <IconBtn label="مفضلة" onClick={() => actions.favorite(!isFavorite)} active={!!isFavorite}>
        <Star className={`size-4 ${isFavorite ? "fill-current" : ""}`} />
      </IconBtn>
      <IconBtn label="أرشفة" onClick={() => actions.archive(!isArchived)} active={!!isArchived}>
        <Archive className="size-4" />
      </IconBtn>
      <IconBtn label="مشاركة" onClick={() => actions.share({ title })}><Share2 className="size-4" /></IconBtn>
      <IconBtn label="تكرار" onClick={() => actions.duplicate()}><Copy className="size-4" /></IconBtn>
      <IconBtn label="حذف" tone="destructive" onClick={() => actions.remove()}>
        <Trash2 className="size-4" />
      </IconBtn>
    </div>
  );
}

function IconBtn({
  children, label, onClick, active, tone,
}: {
  children: React.ReactNode; label: string; onClick: () => void;
  active?: boolean; tone?: "destructive";
}) {
  const base = "grid size-9 place-items-center rounded-full shadow-card transition";
  const cls = tone === "destructive"
    ? "bg-card text-destructive hover:bg-destructive/10"
    : active
      ? "bg-primary text-primary-foreground"
      : "bg-card text-foreground hover:bg-muted";
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`${base} ${cls}`}>
      {children}
    </button>
  );
}