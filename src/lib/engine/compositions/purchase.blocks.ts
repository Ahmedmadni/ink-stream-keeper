import { PackageOpen, ShoppingBag, TrendingUp } from "lucide-react";
import { defineBlock, type BlockComposition } from "@/lib/engine/blocks";
import type { StatEntry } from "@/components/items/StatisticsCard";

export type PurchaseCtx = {
  list: {
    id: string;
    title: string;
    description?: string | null;
    budget?: number | null;
    currency?: string | null;
    notes?: string | null;
  };
  stats?: {
    expected_total?: number | null;
    actual_total?: number | null;
    remaining_amount?: number | null;
    items_count?: number | null;
    purchased_count?: number | null;
    progress?: number | null;
  } | null;
};

export function buildPurchaseBlocks(ctx: PurchaseCtx): BlockComposition<PurchaseCtx> {
  const { list, stats } = ctx;
  const s = stats ?? {};
  const currency = list.currency ?? "SAR";
  const spent = Number(s.actual_total ?? 0);
  const entries: StatEntry[] = [
    { key: "items", label: "عناصر", value: String(s.items_count ?? 0), icon: PackageOpen, tone: "primary" },
    { key: "bought", label: "تم شراؤه", value: `${s.purchased_count ?? 0}/${s.items_count ?? 0}`, icon: ShoppingBag, tone: "success" },
    { key: "prog", label: "التقدم", value: `${Math.round(Number(s.progress ?? 0))}%`, icon: TrendingUp, tone: "accent" },
  ];
  return [
    defineBlock({ id: "header", type: "header", priority: 0, layout: { bare: true }, props: { type: "purchase_list", title: list.title } as any }),
    defineBlock({ id: "stats", type: "statistics", priority: 10, props: { entries, columns: 3 } }),
    defineBlock({
      id: "budget", type: "budget", priority: 20,
      visibleWhen: (c) => (c.list.budget ?? 0) > 0 || Number(c.stats?.actual_total ?? 0) > 0,
      props: { spent, budget: list.budget ?? null, currency },
    }),
    defineBlock({
      id: "progress", type: "progress", priority: 30,
      props: { value: Number(s.progress ?? 0) },
    }),
    defineBlock({
      id: "rich_text", type: "rich_text", priority: 40,
      visibleWhen: (c) => !!(c.list.description || c.list.notes),
      props: { text: [list.description, list.notes].filter(Boolean).join("\n\n") },
    }),
  ];
}