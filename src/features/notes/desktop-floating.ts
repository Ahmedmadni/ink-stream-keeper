import type { Note } from "@/lib/data";
import type { DesktopFloatingNote } from "@/services/desktop";

export function floatingNoteText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed").forEach((el) => el.remove());
  doc.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
  doc.querySelectorAll("li").forEach((el) => {
    el.prepend(el.dataset.checked === "true" ? "☑ " : el.dataset.checked === "false" ? "☐ " : "• ");
  });
  doc
    .querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li,pre,blockquote,tr")
    .forEach((el) => el.append("\n"));
  doc.querySelectorAll("td,th").forEach((el) => el.append("\t"));
  return (doc.body.textContent ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function desktopNoteSnapshot(note: Note): DesktopFloatingNote {
  return {
    kind: "note",
    id: note.id,
    userId: note.user_id,
    title: note.title || "مذكرة",
    text: floatingNoteText(note.content),
    updatedAt: note.updated_at,
    dark: document.documentElement.classList.contains("dark"),
  };
}
