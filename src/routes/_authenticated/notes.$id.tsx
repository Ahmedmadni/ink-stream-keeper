import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pin, Star, Trash2, Paperclip, FileText, Download, X, Loader2, Cloud, CloudOff } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  useCategories, useNote, useNoteAttachments, useDeleteAttachment, useDeleteNote,
  useUpdateNote, useUploadAttachment, tsOf,
} from "@/lib/data";
import { formatRelative } from "@/lib/format";
import { RichEditor } from "@/components/RichEditor";
import { AudioRecorder } from "@/components/AudioRecorder";

export const Route = createFileRoute("/_authenticated/notes/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `MemoFlow — ملاحظة ${params.id}` },
      { name: "description", content: "عرض وتحرير الملاحظة." },
    ],
  }),
  component: NoteDetail,
});

function NoteDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { data: note, isLoading } = useNote(id);
  const { data: categories = [] } = useCategories();
  const { data: attachments = [] } = useNoteAttachments(id);
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const upload = useUploadAttachment();
  const removeAtt = useDeleteAttachment();

  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<number | null>(null);
  const lastSaved = useRef<{ title: string; content: string } | null>(null);

  useEffect(() => {
    if (note) {
      setDraft(note.content);
      setTitle(note.title);
      lastSaved.current = { title: note.title, content: note.content };
      setStatus("idle");
    }
  }, [note?.id, note?.updated_at]);

  // Auto-save (debounced) — no explicit edit mode.
  useEffect(() => {
    if (!note) return;
    if (status !== "dirty") return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        setStatus("saving");
        const nextTitle = title.trim() || note.title;
        await updateNote.mutateAsync({ id: note.id, patch: { title: nextTitle, content: draft } });
        lastSaved.current = { title: nextTitle, content: draft };
        setStatus("saved");
        window.setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
      } catch {
        setStatus("error");
      }
    }, 700);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [draft, title, status, note, updateNote]);

  // Flush on unload
  useEffect(() => {
    const flush = () => {
      if (!note || status !== "dirty") return;
      const nextTitle = title.trim() || note.title;
      updateNote.mutate({ id: note.id, patch: { title: nextTitle, content: draft } });
    };
    window.addEventListener("beforeunload", flush);
    return () => { window.removeEventListener("beforeunload", flush); flush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, draft, title, status]);

  const markDirty = () => setStatus("dirty");

  if (isLoading) {
    return <AppShell><div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto size-6 animate-spin" /></div></AppShell>;
  }

  if (!note) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-muted-foreground">
          لم يتم العثور على الملاحظة.
          <div className="mt-4"><Link to="/notes" className="text-primary font-semibold">العودة للملاحظات</Link></div>
        </div>
      </AppShell>
    );
  }

  const cat = categories.find((c) => c.id === note.category_id);

  return (
    <AppShell>
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-2 px-4 pb-2 pt-5">
        <button onClick={() => router.history.back()} className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-card" aria-label="رجوع">
          <ArrowRight className="size-5" />
        </button>
        <div className="min-w-0"><SaveStatus status={status} /></div>
        <AudioRecorder onRecorded={(file) => { upload.mutate({ noteId: note.id, file }); }} />
        <button onClick={() => updateNote.mutate({ id: note.id, patch: { pinned: !note.pinned } })} className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-card" aria-label="تثبيت">
          <Pin className={`size-4 ${note.pinned ? "rotate-45 text-primary" : "text-muted-foreground"}`} />
        </button>
        <button onClick={() => updateNote.mutate({ id: note.id, patch: { favorite: !note.favorite } })} className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-card" aria-label="مفضلة">
          <Star className={`size-4 ${note.favorite ? "fill-warning text-warning" : "text-muted-foreground"}`} />
        </button>
        <button onClick={async () => { await deleteNote.mutateAsync(note.id); router.navigate({ to: "/notes" }); }} className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-card" aria-label="حذف">
          <Trash2 className="size-4 text-destructive" />
        </button>
      </header>

      <div className="px-5 pt-4">
        <div className="flex items-start gap-2">
          {note.emoji && <span className="text-2xl leading-tight">{note.emoji}</span>}
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); markDirty(); }}
            placeholder="بدون عنوان"
            aria-label="عنوان الملاحظة"
            className="w-full bg-transparent text-2xl font-extrabold leading-tight outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {cat && (<span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">{cat.name}</span>)}
          <span className="text-xs text-muted-foreground">آخر تعديل {formatRelative(tsOf(note.updated_at))}</span>
        </div>

        <div className="mt-5">
          <RichEditor
            value={draft}
            onChange={(html) => { setDraft(html); markDirty(); }}
            onAddAttachment={(file) => upload.mutate({ noteId: note.id, file })}
            placeholder="اكتب محتوى الملاحظة..."
            showCount
          />
        </div>

        {attachments.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Paperclip className="size-4 text-primary" /> المرفقات ({attachments.length})
            </h2>
            <ul className="space-y-2">
              {attachments.map((a) => {
                const isImage = a.mime_type.startsWith("image/");
                const isAudio = a.mime_type.startsWith("audio/");
                return (
                  <li key={a.id} className="rounded-2xl bg-card p-3 shadow-card">
                    {isImage && a.url && (
                      <a href={a.url} target="_blank" rel="noreferrer" className="mb-3 block overflow-hidden rounded-xl">
                        <img src={a.url} alt={a.name} className="max-h-[400px] w-full object-contain" />
                      </a>
                    )}
                    {isAudio && a.url && (
                      <audio src={a.url} controls className="mb-3 w-full" />
                    )}
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary">
                        <FileText className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{a.name}</p>
                        <p className="text-[11px] text-muted-foreground">{formatSize(a.size_bytes)}</p>
                      </div>
                      <a href={a.url} target="_blank" rel="noreferrer" download={a.name} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:text-primary" aria-label="تنزيل"><Download className="size-4" /></a>
                      <button onClick={() => removeAtt.mutate({ id: a.id, noteId: note.id, path: a.storage_path })} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:text-destructive" aria-label="حذف"><X className="size-4" /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function SaveStatus({ status }: { status: "idle" | "dirty" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;
  const map = {
    dirty:   { icon: <CloudOff className="size-3.5" />, text: "تغييرات غير محفوظة", cls: "text-warning" },
    saving:  { icon: <Loader2 className="size-3.5 animate-spin" />, text: "جارٍ الحفظ…", cls: "text-muted-foreground" },
    saved:   { icon: <Cloud className="size-3.5" />, text: "تم الحفظ", cls: "text-success" },
    error:   { icon: <CloudOff className="size-3.5" />, text: "فشل الحفظ", cls: "text-destructive" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${map.cls}`}>
      {map.icon} {map.text}
    </span>
  );
}

function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}