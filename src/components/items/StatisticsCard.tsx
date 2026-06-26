import type { ReactNode } from "react";
import { SummaryCard } from "./SummaryCard";

export type StatTone = "primary" | "success" | "warning" | "destructive" | "accent" | "muted";

export type StatEntry = {
  key: string;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: StatTone;
};

/**
 * Generic responsive grid of summary KPIs.
 * Reused by every item type's detail page.
 */
export function StatisticsCard({
  entries, columns = 2,
}: {
  entries: StatEntry[];
  columns?: 2 | 3 | 4;
}) {
  const cols = columns === 4 ? "grid-cols-2 sm:grid-cols-4"
    : columns === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2";
  return (
    <div className={`grid ${cols} gap-2`}>
      {entries.map((e) => (
        <SummaryCard
          key={e.key} label={e.label} value={e.value}
          hint={e.hint} icon={e.icon} tone={e.tone ?? "primary"}
        />
      ))}
    </div>
  );
}