import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DynamicSection({
  title, description, columns = 1, children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  children: ReactNode;
}) {
  const cols = columns === 4 ? "sm:grid-cols-4"
    : columns === 3 ? "sm:grid-cols-3"
    : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-1";
  return (
    <section className="space-y-3">
      {title ? (
        <header>
          <h3 className="text-sm font-bold">{title}</h3>
          {description ? <p className="text-[11px] text-muted-foreground">{description}</p> : null}
        </header>
      ) : null}
      <div className={cn("grid grid-cols-1 gap-3", cols)}>{children}</div>
    </section>
  );
}