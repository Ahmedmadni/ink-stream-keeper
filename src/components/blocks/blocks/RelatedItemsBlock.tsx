import type { ReactNode } from "react";
import type { BlockRendererProps } from "@/lib/engine/blocks";

export type RelatedItem = { id: string; title: ReactNode; href?: string; hint?: ReactNode };
export type RelatedItemsBlockProps = { items: RelatedItem[]; emptyLabel?: string };

export function RelatedItemsBlock({ block }: BlockRendererProps<RelatedItemsBlockProps>) {
  const { items, emptyLabel = "لا توجد عناصر مرتبطة." } = block.props;
  if (!items.length) return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((r) => {
        const inner = (
          <div className="flex items-center justify-between">
            <span className="truncate text-sm font-semibold">{r.title}</span>
            {r.hint ? <span className="shrink-0 ps-2 text-[11px] text-muted-foreground">{r.hint}</span> : null}
          </div>
        );
        return (
          <li key={r.id} className="rounded-xl bg-muted/40 p-2.5">
            {r.href ? <a href={r.href}>{inner}</a> : inner}
          </li>
        );
      })}
    </ul>
  );
}
export default RelatedItemsBlock;