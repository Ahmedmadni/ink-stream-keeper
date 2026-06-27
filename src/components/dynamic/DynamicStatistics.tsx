import type { ItemTypeSchema } from "@/lib/engine/types";
import { StatisticsCard, type StatEntry } from "@/components/items/StatisticsCard";

/**
 * Build the dashboard stats grid for any item type from its schema definition.
 * Reuses the existing StatisticsCard primitive so styling stays consistent.
 */
export function DynamicStatistics<Row>({
  schema, rows, columns = 2,
}: { schema: ItemTypeSchema<Row>; rows: Row[]; columns?: 2 | 3 | 4 }) {
  const entries: StatEntry[] = (schema.stats ?? []).map((s) => {
    const r = s.compute(rows);
    return { key: s.key, label: s.label, value: r.value, hint: r.hint, icon: s.icon, tone: s.tone ?? "primary" };
  });
  if (entries.length === 0) return null;
  return <StatisticsCard entries={entries} columns={columns} />;
}