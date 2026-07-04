import type { ReactNode } from "react";
import type { BlockRendererProps } from "@/lib/engine/blocks";

export type PropertyRow = {
  key: string;
  label: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  value: ReactNode;
  /** When present overrides `value` — an inline editor node. */
  editor?: ReactNode;
};

export type PropertiesBlockProps = {
  items: PropertyRow[];
  columns?: 1 | 2 | 3;
};

export function PropertiesBlock({ block }: BlockRendererProps<PropertiesBlockProps>) {
  const { items, columns = 2 } = block.props;
  const cols = columns === 3 ? "grid-cols-2 sm:grid-cols-3" : columns === 2 ? "grid-cols-2" : "grid-cols-1";
  return (
    <div className={`grid gap-2 ${cols}`}>
      {items.map((p) => {
        const Icon = p.icon;
        return (
          <div key={p.key} className="rounded-xl bg-muted/40 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
              {Icon ? <Icon className="size-3.5" /> : null}
              <span>{p.label}</span>
            </div>
            <div className="text-sm font-bold">
              {p.editor ?? p.value ?? <span className="text-muted-foreground/60">—</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}