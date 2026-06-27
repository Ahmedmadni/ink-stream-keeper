import type { ReactNode } from "react";
import type { ItemTypeKey } from "@/lib/item-types";
import { ITEM_TYPES, formatCurrency } from "@/lib/item-types";
import type { ItemTypeSchema } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

/**
 * One card to summarize any row in any list — driven by schema.summary.
 */
export function DynamicSummaryCard<Row extends Record<string, unknown>>({
  schema, row, onClick, right,
}: {
  schema: ItemTypeSchema<Row>;
  row: Row;
  onClick?: () => void;
  right?: ReactNode;
}) {
  const def = ITEM_TYPES[schema.id];
  const Icon = def.icon;
  const cfg = schema.summary;
  const done = cfg.doneField ? Boolean(row[cfg.doneField]) : false;
  const progress = cfg.progressField ? Number(row[cfg.progressField] ?? 0) : null;

  return (
    <button
      onClick={onClick} type="button"
      className={cn(
        "w-full rounded-2xl bg-card p-3 text-right shadow-card transition-transform active:scale-[0.99]",
        done && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{String(row[cfg.primary] ?? "")}</p>
          {cfg.secondary && row[cfg.secondary] ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{String(row[cfg.secondary])}</p>
          ) : null}
          {cfg.metrics && cfg.metrics.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cfg.metrics.map((m) => {
                const raw = row[m.from];
                if (raw == null || raw === "") return null;
                return (
                  <span key={m.from} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {m.label}: {formatMetric(raw, m.format)}
                  </span>
                );
              })}
            </div>
          ) : null}
          {progress != null ? (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
            </div>
          ) : null}
        </div>
        {right}
      </div>
    </button>
  );
}

function formatMetric(v: unknown, fmt?: string) {
  if (fmt === "money") return formatCurrency(Number(v));
  if (fmt === "percent") return `${Number(v)}%`;
  if (fmt === "date") return new Date(String(v)).toLocaleDateString("ar-EG");
  return String(v);
}