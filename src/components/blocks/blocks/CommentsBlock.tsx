import type { ReactNode } from "react";
import type { BlockRendererProps } from "@/lib/engine/blocks";

export type CommentItem = { id: string; author: ReactNode; body: ReactNode; time?: ReactNode };
export type CommentsBlockProps = { items: CommentItem[]; emptyLabel?: string };

export function CommentsBlock({ block }: BlockRendererProps<CommentsBlockProps>) {
  const { items, emptyLabel = "لا توجد تعليقات." } = block.props;
  if (!items.length) return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li key={c.id} className="rounded-xl bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">{c.author}</span>
            {c.time ? <span className="text-[10px] text-muted-foreground">{c.time}</span> : null}
          </div>
          <div className="mt-1 text-sm leading-relaxed">{c.body}</div>
        </li>
      ))}
    </ul>
  );
}
export default CommentsBlock;