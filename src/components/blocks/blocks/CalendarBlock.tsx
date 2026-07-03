import type { ReactNode } from "react";
import type { BlockRendererProps } from "@/lib/engine/blocks";

export type CalendarBlockProps = { start?: ReactNode; end?: ReactNode; recurrence?: ReactNode };

export function CalendarBlock({ block }: BlockRendererProps<CalendarBlockProps>) {
  const { start, end, recurrence } = block.props;
  return (
    <div className="grid grid-cols-3 gap-2 text-center text-xs">
      <Cell label="البداية" value={start} />
      <Cell label="النهاية" value={end} />
      <Cell label="التكرار" value={recurrence} />
    </div>
  );
}
function Cell({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/40 p-2">
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold">{value ?? <span className="text-muted-foreground/60">—</span>}</p>
    </div>
  );
}
export default CalendarBlock;