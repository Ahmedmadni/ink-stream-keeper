import type { ReactNode } from "react";

/** Keep creation visible while the category strip scrolls independently in RTL. */
export function CategoryBar({ children, action }: { children: ReactNode; action: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3" aria-label="التصنيفات والإضافة">
      <div
        role="group"
        aria-label="تصفية حسب التصنيف"
        className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-max min-w-full items-center gap-2 py-1">{children}</div>
      </div>
      {action}
    </div>
  );
}

export function CategoryChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={`rounded-full px-1.5 text-xs ${active ? "bg-white/20" : "bg-secondary"}`}>
          {count}
        </span>
      )}
    </button>
  );
}
