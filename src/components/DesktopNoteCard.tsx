import { useEffect, useRef, useState, type ReactNode } from "react";
import { PictureInPicture2 } from "lucide-react";
import { toast } from "sonner";
import type { Note } from "@/lib/data";
import { desktopBridge, isDesktop } from "@/services/desktop";
import { desktopNoteSnapshot } from "@/features/notes/desktop-floating";

export function DesktopNoteCard({ note, children }: { note: Note; children: ReactNode }) {
  const desktop = isDesktop();
  const root = useRef<HTMLElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; active: boolean } | null>(null);
  const blockClick = useRef(0);
  const [dragging, setDragging] = useState(false);
  const failed = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : "تعذر فتح البطاقة العائمة");
  useEffect(() => {
    if (!dragging) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const current = drag.current;
      drag.current = null;
      setDragging(false);
      blockClick.current = Date.now() + 250;
      if (current && root.current?.hasPointerCapture(current.id))
        root.current.releasePointerCapture(current.id);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [dragging]);
  return (
    <article
      ref={root}
      data-note-card={note.id}
      className={`relative h-full ${desktop ? "cursor-grab select-none" : ""} ${dragging ? "cursor-grabbing opacity-60 ring-2 ring-primary rounded-2xl" : ""}`}
      onDragStart={(event) => {
        if (desktop) event.preventDefault();
      }}
      onPointerDown={(event) => {
        if (
          !desktop ||
          event.pointerType !== "mouse" ||
          event.button !== 0 ||
          (event.target as Element).closest("button")
        )
          return;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false };
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId || event.buttons !== 1) return;
        if (
          !current.active &&
          Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8
        ) {
          current.active = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }
        if (current.active) event.preventDefault();
      }}
      onPointerUp={(event) => {
        const current = drag.current;
        drag.current = null;
        setDragging(false);
        if (!current?.active || current.id !== event.pointerId) return;
        blockClick.current = Date.now() + 250;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        void desktopBridge()
          ?.dropFloatingNote({
            note: desktopNoteSnapshot(note),
            point: { x: event.screenX, y: event.screenY },
          })
          .catch(failed);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      onLostPointerCapture={() => {
        drag.current = null;
        setDragging(false);
      }}
      onClickCapture={(event) => {
        if (Date.now() < blockClick.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {children}
      {desktop && (
        <button
          type="button"
          aria-label={`عرض ${note.title || "المذكرة"} فوق النوافذ`}
          title="بطاقة عائمة — اسحب المذكرة خارج النافذة أو اضغط هنا"
          onClick={() =>
            void desktopBridge()?.openFloatingNote(desktopNoteSnapshot(note)).catch(failed)
          }
          className="absolute end-3 top-3 grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PictureInPicture2 className="size-5" />
        </button>
      )}
    </article>
  );
}
