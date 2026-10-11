import { supabase } from "@/integrations/supabase/client";
import { NoteConflict, sameText, type NoteText, type NoteVersion } from "./autosave";

/** Optimistic concurrency: never overwrite a note changed since the last read. */
export async function saveNoteVersion(
  userId: string,
  noteId: string,
  draft: NoteText,
  expected: NoteVersion,
): Promise<NoteVersion> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || auth.user?.id !== userId) throw new Error("تغير الحساب أو تعذر التحقق منه");
  let base = expected;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("notes")
      .update({ title: draft.title, content: draft.content })
      .eq("id", noteId)
      .eq("user_id", userId)
      .eq("updated_at", base.updated_at)
      .select("title,content,updated_at")
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    const { data: latest, error: readError } = await supabase
      .from("notes")
      .select("title,content,updated_at")
      .eq("id", noteId)
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw readError;
    if (!latest) throw new NoteConflict(null);
    if (sameText(latest, draft)) return latest; // Previous write succeeded but its response was lost.
    if (!sameText(latest, base)) throw new NoteConflict(latest);
    base = latest; // Only metadata (e.g. pin/favorite) changed; retry safely.
  }
  throw new NoteConflict(base);
}
