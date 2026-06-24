import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Pin, Star, Trash2, Paperclip, FileText, Download, X, Check as CheckIcon, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  useCategories, useNote, useNoteAttachments, useDeleteAttachment, useDeleteNote,
  useUpdateNote, useUploadAttachment, tsOf,
} from "@/lib/data";
import { formatRelative } from "@/lib/format";
import { RichEditor } from "@/components/RichEditor";

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

  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (note) {
      setDraft(note.content);
      setTitle(note.title);
      setEditing(false);
      setDirty(false);
    }
  }, [note?.id, note?.updated_at]);

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

  const save = async () => {
    await updateNote.mutateAsync({ id: note.id, patch: { title: title.trim() || note.title, content: draft } });
    setDirty(false);
    setEditing(false);
  };

  return (
    <AppShell>
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-2 px-4 pb-2 pt-5">
        <button onClick={() => router.history.back()} className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-card" aria-label="رجوع">
          <ArrowRight className="size-5" />
        </button>
        <div className="min-w-0" />
        {editing ? (
          <button onClick={save} disabled={updateNote.isPending} className="grid h-10 shrink-0 place-items-center rounded-full gradient-primary px-4 text-xs font-bold text-primary-foreground shadow-fab disabled:opacity-70">
            {updateNote.isPending ? <Loader2 className="size-4 animate-spin" /> : <span className="flex items-center gap-1"><CheckIcon className="size-4" /> حفظ</span>}
          </button>
        ) : (
          <button onClick={() => setEditing(true)} className="grid h-10 shrink-0 place-items-center rounded-full bg-primary-soft px-4 text-xs font-bold text-primary shadow-card">تحرير</button>
        )}
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
        {editing ? (
          <input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} placeholder="عنوان الملاحظة" className="w-full bg-transparent text-2xl font-extrabold leading-tight outline-none placeholder:text-muted-foreground/50" />
        ) : (
          <h1 className="text-2xl font-extrabold leading-tight">
            <span className="me-2">{note.emoji}</span>{note.title || "بدون عنوان"}
          </h1>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {cat && (<span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">{cat.name}</span>)}
          <span className="text-xs text-muted-foreground">آخر تعديل {formatRelative(tsOf(note.updated_at))}</span>
          {dirty && <span className="text-[10px] font-bold text-warning">• تغييرات غير محفوظة</span>}
        </div>

        <div className="mt-5">
          {editing ? (
            <RichEditor
              value={draft}
              onChange={(html) => { setDraft(html); setDirty(true); }}
              onAddAttachment={(file) => upload.mutate({ noteId: note.id, file })}
              placeholder="اكتب محتوى الملاحظة..."
            />
          ) : (
            <article className="prose-mf rounded-2xl bg-card p-5 shadow-card" dir="rtl" dangerouslySetInnerHTML={{ __html: renderHtml(note.content) }} />
          )}
        </div>

        {attachments.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Paperclip className="size-4 text-primary" /> المرفقات ({attachments.length})
            </h2>
            <ul className="space-y-2">
              {attachments.map((a) => (
                <li key={a.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
                  {a.mime_type.startsWith("image/") && a.url ? (
                    <img src={a.url} alt={a.name} className="size-12 rounded-lg object-cover" />
                  ) : (
                    <div className="grid size-12 place-items-center rounded-lg bg-primary-soft text-primary"><FileText className="size-5" /></div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground">{formatSize(a.size_bytes)}</p>
                  </div>
                  <a href={a.url} target="_blank" rel="noreferrer" download={a.name} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:text-primary" aria-label="تنزيل"><Download className="size-4" /></a>
                  <button onClick={() => removeAtt.mutate({ id: a.id, noteId: note.id, path: a.storage_path })} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:text-destructive" aria-label="حذف"><X className="size-4" /></button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function renderHtml(value: string): string {
  if (!value) return "<p class='text-muted-foreground'>لا يوجد محتوى بعد. اضغط «تحرير» للبدء.</p>";
  const trimmed = value.trim();
  if (trimmed.startsWith("<")) return value;
  return trimmed.split(/\n+/).map((l) => `<p>${escapeHtml(l)}</p>`).join("");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}