import type { ReactNode } from "react";
import { StatisticsCard, type StatEntry } from "@/components/items/StatisticsCard";
import type { BlockRendererProps } from "@/lib/engine/blocks";

export type StatisticsBlockProps = {
  entries: StatEntry[];
  columns?: 2 | 3 | 4;
  emptyLabel?: ReactNode;
};

export function StatisticsBlock({ block }: BlockRendererProps<StatisticsBlockProps>) {
  const { entries, columns = 2, emptyLabel = "لا توجد إحصائيات." } = block.props;
  if (!entries.length) return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  return <StatisticsCard entries={entries} columns={columns} />;
}