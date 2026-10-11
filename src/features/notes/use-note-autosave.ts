import { useEffect, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import type { Note } from "@/lib/data";
import { NoteAutosave } from "./autosave";
import { browserNoteDraftStore } from "./draft-store";
import { saveNoteVersion } from "./save-note";

/** Mount this hook in an editor keyed by user ID + note ID. */
export function useNoteAutosave(note: Note) {
  const qc = useQueryClient();
  const [controller] = useState(
    () =>
      new NoteAutosave(
        note,
        browserNoteDraftStore(note.user_id, note.id),
        async (draft, expected) => {
          const saved = await saveNoteVersion(note.user_id, note.id, draft, expected);
          void qc.invalidateQueries({ queryKey: ["notes"] });
          return saved;
        },
      ),
  );
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const needsProtection = () => {
    const current = controller.getSnapshot();
    return current.localError && !["clean", "saved"].includes(current.state);
  };
  useBlocker({
    shouldBlockFn: () =>
      needsProtection() &&
      !window.confirm("لم تُحفظ التغييرات على الجهاز أو الخادم. مغادرة الصفحة وفقدانها؟"),
    enableBeforeUnload: needsProtection,
  });
  useEffect(() => {
    controller.start();
    const retry = () => {
      void controller.flush();
    };
    window.addEventListener("online", retry);
    return () => {
      controller.stop();
      window.removeEventListener("online", retry);
    };
  }, [controller]);
  useEffect(() => controller.receiveRemote(note), [controller, note]);
  return { controller, snapshot };
}
