import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "success" | "warning" | "destructive" | "accent" | "muted";

const toneClass: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  accent: "bg-accent text-accent-foreground",
  muted: "bg-muted text-muted-foreground",
};

/**
 * Generic compact KPI card. Reused across every item type
 * (budget / total / remaining / progress / counts...).
 */
export function SummaryCard({
  label, value, hint, icon: Icon, tone = "primary", className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl bg-card p-3 shadow-card", className)}>
      <div className="flex items-center gap-2">
        {Icon ? (
          <span className={cn("grid size-8 place-items-center rounded-xl", toneClass[tone])}>
            <Icon className="size-4" />
          </span>
        ) : null}
        <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 truncate text-lg font-extrabold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}