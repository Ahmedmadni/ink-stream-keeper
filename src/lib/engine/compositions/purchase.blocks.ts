import { createElement, type ReactNode } from "react";
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

export type PurchaseMutations = {
  updateList: (patch: Record<string, unknown>) => void;
};

export type PurchaseBuildOpts = {
  mutations?: PurchaseMutations;
  readonly?: boolean;
  /** Optional custom slot for the items editor (rendered as a custom block). */
  itemsSlot?: () => ReactNode;
};

export function buildPurchaseBlocks(ctx: PurchaseCtx, opts: PurchaseBuildOpts = {}): BlockComposition<PurchaseCtx> {
  const { list, stats } = ctx;
  const s = stats ?? {};
  const currency = list.currency ?? "SAR";
  const spent = Number(s.actual_total ?? 0);
  const readonly = opts.readonly ?? !opts.mutations;

  const entries: StatEntry[] = [
    { key: "items", label: "عناصر", value: String(s.items_count ?? 0), icon: PackageOpen, tone: "primary" },
    { key: "bought", label: "تم شراؤه", value: `${s.purchased_count ?? 0}/${s.items_count ?? 0}`, icon: ShoppingBag, tone: "success" },
    { key: "prog", label: "التقدم", value: `${Math.round(Number(s.progress ?? 0))}%`, icon: TrendingUp, tone: "accent" },
  ];

  const blocks: BlockComposition<PurchaseCtx> = [
    defineBlock({ id: "header", type: "header", priority: 0, layout: { bare: true }, props: { type: "purchase_list", title: list.title } as any }),
    defineBlock({ id: "stats", type: "statistics", priority: 10, props: { entries, columns: 3 } }),
    defineBlock({
      id: "sub_items", type: "sub_items", priority: 15, title: "التقسيم الفرعي",
      layout: { span: 4 },
      props: { parentType: "purchase", parentId: list.id, readonly, allowConvertToTask: true },
    }),
    defineBlock({
      id: "budget", type: "budget", priority: 20,
      visibleWhen: (c) => (c.list.budget ?? 0) > 0 || Number(c.stats?.actual_total ?? 0) > 0 || !readonly,
      props: {
        spent,
        budget: list.budget ?? null,
        currency,
        onBudgetChange: readonly ? undefined : (v: number | null) => opts.mutations?.updateList({ budget: v ?? 0 }),
      } as any,
    }),
    defineBlock({
      id: "progress", type: "progress", priority: 30,
      props: { value: Number(s.progress ?? 0) },
    }),
    defineBlock({
      id: "description", type: "rich_text", priority: 40, title: "الوصف",
      props: {
        text: [list.description, list.notes].filter(Boolean).join("\n\n"),
        placeholder: "أضف وصفاً أو ملاحظات...",
        onSave: readonly ? undefined : (v: string) => opts.mutations?.updateList({ description: v }),
      },
    }),
  ];

  if (opts.itemsSlot) {
    blocks.push(defineBlock({
      id: "items", type: "custom", priority: 60, title: "عناصر القائمة", layout: { span: 4 },
      props: { render: () => createElement("div", null, opts.itemsSlot!()) } as any,
    }));
  }

  return blocks;
}
