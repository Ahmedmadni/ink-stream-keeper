import type { ReactNode } from "react";
import type { ItemTypeKey } from "@/lib/item-types";
import { ITEM_TYPES } from "@/lib/item-types";
import { cn } from "@/lib/utils";
import type { BlockRendererProps } from "@/lib/engine/blocks";

export type HeaderBlockProps = {
  type?: ItemTypeKey;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode[];
  actions?: ReactNode;
  quickActions?: ReactNode;
};

export function HeaderBlock({ block }: BlockRendererProps<HeaderBlockProps>) {
  const { type, title, subtitle, badges, actions, quickActions } = block.props;
  const def = type ? ITEM_TYPES[type] : undefined;
  const Icon = def?.icon;
  const tone = def?.tone ?? "primary";
  const toneClass =
    tone === "success" ? "bg-success/15 text-success"
    : tone === "warning" ? "bg-warning/15 text-warning"
    : tone === "destructive" ? "bg-destructive/15 text-destructive"
    : tone === "accent" ? "bg-accent text-accent-foreground"
    : "bg-primary-soft text-primary";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {Icon ? (
          <div className={cn("grid size-12 place-items-center rounded-2xl", toneClass)}>
            <Icon className="size-6" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {badges && badges.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b, i) => <span key={i} className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary">{b}</span>)}
        </div>
      ) : null}
      {quickActions ? <div className="flex flex-wrap gap-2">{quickActions}</div> : null}
    </div>
  );
}