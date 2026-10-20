import type { ReactNode } from "react";
import type { Note } from "@/lib/data";
import { DesktopFloatingCard } from "./DesktopFloatingCard";
import { desktopNoteSnapshot } from "@/features/notes/desktop-floating";
import { isDesktop } from "@/services/desktop";

export function DesktopNoteCard({ note, children }: { note: Note; children: ReactNode }) {
  if (!isDesktop()) return <article className="relative h-full">{children}</article>;
  return <DesktopFloatingCard card={desktopNoteSnapshot(note)}>{children}</DesktopFloatingCard>;
}
