import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Category = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  locked: boolean;
  sort_order: number;
  created_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  content: string;
  emoji: string | null;
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  done: boolean;
  due_at: string | null;
  priority: "low" | "med" | "high";
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  language: string;
  theme: string;
  created_at: string;
  updated_at: string;
};

export type Attachment = {
  id: string;
  user_id: string;
  note_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
};

export const keys = {
  profile: ["profile"] as const,
  categories: ["categories"] as const,
  notes: ["notes"] as const,
  note: (id: string) => ["notes", id] as const,
  attachments: (noteId: string) => ["attachments", noteId] as const,
  tasks: ["tasks"] as const,
};

export const categoriesQuery = queryOptions({
  queryKey: keys.categories,
  queryFn: async (): Promise<Category[]> => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Category[];
  },
});

export const notesQuery = queryOptions({
  queryKey: keys.notes,
  queryFn: async (): Promise<Note[]> => {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("archived", false)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Note[];
  },
});

export const tasksQuery = queryOptions({
  queryKey: keys.tasks,
  queryFn: async (): Promise<Task[]> => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("due_at", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data ?? []) as Task[];
  },
});

export const profileQuery = queryOptions({
  queryKey: keys.profile,
  queryFn: async (): Promise<Profile | null> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  },
});

export function useCategories() { return useQuery(categoriesQuery); }
export function useNotes() { return useQuery(notesQuery); }
export function useTasks() { return useQuery(tasksQuery); }
export function useProfile() { return useQuery(profileQuery); }

export function useNote(id: string) {
  return useQuery({
    queryKey: keys.note(id),
    queryFn: async (): Promise<Note | null> => {
      const { data, error } = await supabase.from("notes").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Note | null;
    },
  });
}

export function useNoteAttachments(noteId: string) {
  return useQuery({
    queryKey: keys.attachments(noteId),
    queryFn: async (): Promise<(Attachment & { url: string })[]> => {
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("note_id", noteId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const list = (data ?? []) as Attachment[];
      const withUrls = await Promise.all(
        list.map(async (a) => {
          const { data: signed } = await supabase.storage
            .from("note-attachments")
            .createSignedUrl(a.storage_path, 3600);
          return { ...a, url: signed?.signedUrl ?? "" };
        }),
      );
      return withUrls;
    },
    enabled: !!noteId,
  });
}

// ----------------- mutations -----------------

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("غير مسجل الدخول");
  return data.user.id;
}

export function useAddNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; content: string; categoryId: string | null; emoji?: string | null }): Promise<Note> => {
      const uid = await currentUserId();
      const { data, error } = await supabase
        .from("notes")
        .insert({
          user_id: uid,
          title: input.title,
          content: input.content,
          category_id: input.categoryId,
          emoji: input.emoji ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notes }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Note> }) => {
      const { error } = await supabase.from("notes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: keys.notes });
      qc.invalidateQueries({ queryKey: keys.note(vars.id) });
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notes }),
  });
}

export function useAddTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; due_at?: string | null; priority?: "low" | "med" | "high"; category_id?: string | null }) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("tasks").insert({
        user_id: uid,
        title: input.title,
        due_at: input.due_at ?? null,
        priority: input.priority ?? "med",
        category_id: input.category_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tasks }),
  });
}

export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("tasks").update({ done }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tasks }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tasks }),
  });
}

export function useAddCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; icon?: string; color?: string }) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("categories").insert({
        user_id: uid,
        name: input.name,
        icon: input.icon ?? "Notebook",
        color: input.color ?? "primary",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Profile, "display_name" | "avatar_url" | "language" | "theme">>) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.profile }),
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, file }: { noteId: string; file: File }) => {
      const uid = await currentUserId();
      const path = `${uid}/${noteId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("note-attachments").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });
      if (upErr) throw upErr;
      const { error } = await supabase.from("attachments").insert({
        user_id: uid,
        note_id: noteId,
        name: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        storage_path: path,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: keys.attachments(vars.noteId) }),
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, noteId, path }: { id: string; noteId: string; path: string }) => {
      await supabase.storage.from("note-attachments").remove([path]);
      const { error } = await supabase.from("attachments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: keys.attachments(vars.noteId) }),
  });
}

export function tsOf(s: string): number { return new Date(s).getTime(); }