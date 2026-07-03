import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import type { BlockRendererProps } from "@/lib/engine/blocks";

export type AttachmentItem = { id: string; name: string; url?: string; size?: ReactNode; mime?: string };
export type AttachmentsBlockProps = { items: AttachmentItem[]; emptyLabel?: string };

export function AttachmentsBlock({ block }: BlockRendererProps<AttachmentsBlockProps>) {
  const { items, emptyLabel = "لا توجد مرفقات." } = block.props;
  if (!items.length) return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  return (
    <ul className="space-y-2">
      {items.map((a) => (
        <li key={a.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-muted/40 p-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary"><FileText className="size-4" /></div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{a.name}</p>
            {a.size ? <p className="text-[11px] text-muted-foreground">{a.size}</p> : null}
          </div>
          {a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary">فتح</a> : null}
        </li>
      ))}
    </ul>
  );
}
export default AttachmentsBlock;