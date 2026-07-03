import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlockInstance } from "@/lib/engine/blocks";

/**
 * Common shell around every block: card background, optional title,
 * collapsible affordance, layout span. Blocks may opt-out via layout.bare.
 */
export function BlockChrome({
  block, title, children,
}: {
  block: BlockInstance;
  title?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!block.collapsed);
  const bare = block.layout?.bare;
  const span = block.layout?.span ?? 4;
  const spanClass = spanToClass(span);

  const body = bare ? (
    <div className={spanClass}>{children}</div>
  ) : (
    <section className={cn("rounded-2xl bg-card p-4 shadow-card", spanClass, block.layout?.sticky && "sticky top-2")}>
      {title ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mb-3 flex w-full items-center justify-between text-sm font-extrabold"
          aria-expanded={open}
        >
          <span>{title}</span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
        </button>
      ) : null}
      {open ? children : null}
    </section>
  );
  return body;
}

function spanToClass(span: 1 | 2 | 3 | 4): string {
  switch (span) {
    case 1: return "md:col-span-1";
    case 2: return "md:col-span-2";
    case 3: return "md:col-span-3";
    default: return "md:col-span-4";
  }
}