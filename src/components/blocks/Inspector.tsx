import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { PropertiesBlock, type PropertyRow } from "./blocks/PropertiesBlock";
import { defineBlock } from "@/lib/engine/blocks";

export type InspectorSection = { id: string; title: string; content: ReactNode };

/**
 * Inspector — side panel that shows/edits an item's properties independent
 * of any specific detail page. Uses PropertiesBlock under the hood, so any
 * change made here flows through the same block engine.
 */
export type InspectorProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  rows?: PropertyRow[];
  /** Extra sections registered by blocks or the page. */
  sections?: InspectorSection[];
};

export function Inspector({ open, onClose, title = "الخصائص", rows = [], sections = [] }: InspectorProps) {
  const isMobile = useIsMobile();
  if (!open) return null;

  const block = defineBlock({
    id: "inspector-props", type: "properties", props: { items: rows, columns: 1 },
  });

  const panel = (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-extrabold">{title}</h2>
        <button onClick={onClose} aria-label="إغلاق" className="grid size-8 place-items-center rounded-full hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {rows.length > 0 && <PropertiesBlock block={block as any} context={undefined} />}
        {sections.map((s) => (
          <section key={s.id} className="space-y-2">
            <h3 className="text-xs font-extrabold text-muted-foreground">{s.title}</h3>
            <div>{s.content}</div>
          </section>
        ))}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50" role="dialog" aria-modal>
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-hidden rounded-t-2xl">
          {panel}
        </div>
      </div>
    );
  }
  return (
    <aside className="fixed inset-y-0 end-0 z-40 w-[360px] border-s border-border/60 shadow-xl">
      {panel}
    </aside>
  );
}