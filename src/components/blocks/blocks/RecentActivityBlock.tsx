import type { ReactNode } from "react";
import type { BlockRendererProps } from "@/lib/engine/blocks";

export type ActivityItem = { id: string; label: ReactNode; time?: ReactNode };
export type RecentActivityBlockProps = { items: ActivityItem[]; emptyLabel?: string };

export function RecentActivityBlock({ block }: BlockRendererProps<RecentActivityBlockProps>) {
  const { items, emptyLabel = "لا يوجد نشاط بعد." } = block.props;
  if (!items.length) return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((a) => (
        <li key={a.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-1.5 text-xs">
          <span className="truncate">{a.label}</span>
          {a.time ? <span className="shrink-0 ps-2 text-muted-foreground">{a.time}</span> : null}
        </li>
      ))}
    </ul>
  );
}
export default RecentActivityBlock;