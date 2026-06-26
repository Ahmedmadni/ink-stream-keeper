import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * Generic progress card used by every item type that has
 * a sense of completion (purchases / tasks / learning / goals).
 */
export function ProgressCard({
  title, value, subtitle, right, className,
}: {
  title: ReactNode;
  /** 0..100 */
  value: number;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("rounded-2xl bg-card p-4 shadow-card", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{title}</p>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {right}
          <span className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
            {v}%
          </span>
        </div>
      </div>
      <Progress value={v} className="mt-3 h-2" />
    </div>
  );
}