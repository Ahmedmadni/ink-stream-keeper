import { formatCurrency } from "@/lib/item-types";
import type { BlockRendererProps } from "@/lib/engine/blocks";
import { emit } from "@/lib/engine/block-events";

export type BudgetBlockProps = {
  spent: number;
  budget?: number | null;
  currency?: string;
  onBudgetChange?: (v: number | null) => void;
};

export function BudgetBlock({ block }: BlockRendererProps<BudgetBlockProps>) {
  const { spent, budget, currency = "SAR", onBudgetChange } = block.props;
  const pct = budget && budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const over = budget != null && spent > budget;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold text-muted-foreground">المصروف</span>
        <span className={`text-sm font-extrabold ${over ? "text-destructive" : ""}`}>{formatCurrency(spent, currency)}</span>
      </div>
      {onBudgetChange ? (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-bold text-muted-foreground">الميزانية</span>
          <input
            type="number" min={0} step={1} defaultValue={budget ?? ""}
            placeholder="—"
            onBlur={(e) => {
              const raw = e.target.value.trim();
              const v = raw === "" ? null : Number(raw);
              if (v !== budget) { onBudgetChange(v); emit("field:save", { name: "budget", value: v }); }
            }}
            className="w-28 rounded-md bg-transparent px-2 py-1 text-end text-sm font-extrabold outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      ) : budget != null ? (
        <>
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold text-muted-foreground">الميزانية</span>
            <span className="text-sm font-extrabold">{formatCurrency(budget, currency)}</span>
          </div>
        </>
      ) : null}
      {budget != null && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className={`h-full transition-all ${over ? "bg-destructive" : "bg-gradient-to-l from-primary to-primary/70"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}