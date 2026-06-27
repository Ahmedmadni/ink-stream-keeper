import type { ReactNode } from "react";

export type TimelineEntry = { id: string; date?: ReactNode; title: ReactNode; description?: ReactNode };

export function DynamicTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="rounded-2xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">لا توجد سجلات.</p>;
  }
  return (
    <ol className="relative space-y-3 border-r border-border pr-4">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute right-[-21px] top-2 grid size-3 place-items-center rounded-full bg-primary ring-4 ring-background" />
          <div className="rounded-2xl bg-card p-3 shadow-card">
            {e.date ? <p className="text-[10px] font-bold text-muted-foreground">{e.date}</p> : null}
            <p className="text-sm font-bold">{e.title}</p>
            {e.description ? <div className="mt-1 text-xs text-muted-foreground">{e.description}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}