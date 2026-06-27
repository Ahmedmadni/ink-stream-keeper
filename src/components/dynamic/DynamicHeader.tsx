import type { ReactNode } from "react";
import type { ItemTypeKey } from "@/lib/item-types";
import { ITEM_TYPES } from "@/lib/item-types";
import { cn } from "@/lib/utils";

/**
 * Common page header for any item-type detail page: icon tile + title + actions.
 */
export function DynamicHeader({
  type, title, subtitle, actions,
}: {
  type: ItemTypeKey;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  const def = ITEM_TYPES[type];
  const Icon = def.icon;
  const tone = def.tone;
  const toneClass =
    tone === "success" ? "bg-success/15 text-success"
    : tone === "warning" ? "bg-warning/15 text-warning"
    : tone === "destructive" ? "bg-destructive/15 text-destructive"
    : tone === "accent" ? "bg-accent text-accent-foreground"
    : "bg-primary-soft text-primary";
  return (
    <header className="flex items-center gap-3 px-5 pb-2 pt-6">
      <div className={cn("grid size-12 place-items-center rounded-2xl", toneClass)}>
        <Icon className="size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-extrabold">{title}</h1>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions}
    </header>
  );
}