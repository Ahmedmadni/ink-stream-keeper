import { formatCurrency } from "@/lib/item-types";
import type { BlockRendererProps } from "@/lib/engine/blocks";

export type BudgetBlockProps = { spent: number; budget?: number | null; currency?: string };

export function BudgetBlock({ block }: BlockRendererProps<BudgetBlockProps>) {
  const { spent, budget, currency = "SAR" } = block.props;
  const pct = budget && budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const over = budget != null && spent > budget;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold text-muted-foreground">المصروف</span>
        <span className={`text-sm font-extrabold ${over ? "text-destructive" : ""}`}>{formatCurrency(spent, currency)}</span>
      </div>
      {budget != null ? (
        <>
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold text-muted-foreground">الميزانية</span>
            <span className="text-sm font-extrabold">{formatCurrency(budget, currency)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className={`h-full transition-all ${over ? "bg-destructive" : "bg-gradient-to-l from-primary to-primary/70"}`} style={{ width: `${pct}%` }} />
          </div>
        </>
      ) : null}
    </div>
  );
}