import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Pin, Star, Trash2, Paperclip, FileText, Download, X, Check as CheckIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { actions, formatRelative, useStore, type Attachment } from "@/lib/store";
import { RichEditor } from "@/components/RichEditor";

export const Route = createFileRoute("/_authenticated/notes/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `MemoFlow — ملاحظة ${params.id}` },
      { name: "description", content: "عرض وتحرير الملاحظة." },
    ],
  }),
  component: NoteDetail,
  notFoundComponent: () => (
    <AppShell>
      <div className="p-8 text-center text-sm text-muted-foreground">لم يتم العثور على الملاحظة.</div>
    </AppShell>
  ),
});

function NoteDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const note = useStore((s) => s.notes.find((n) => n.id === id));
  const cat = useStore((s) => s.categories.find((c) => c.id === note?.categoryId));
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState(note?.content ?? "");
  const [title, setTitle] = useState(note?.title ?? "");
  useEffect(() => {
    setDraft(note?.content ?? "");
    setTitle(note?.title ?? "");
    setEditing(false);
    setDirty(false);
  }, [id]);

  if (!note) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-muted-foreground">
          لم يتم العثور على الملاحظة.
          <div className="mt-4">
            <Link to="/notes" className="text-primary font-semibold">العودة للملاحظات</Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const save = () => {
    actions.updateNote(note.id, { title: title.trim() || note.title, content: draft });
    setDirty(false);
    setEditing(false);
  };

  const onAttach = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const att: Attachment = {
        id: `a_${Date.now()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: reader.result as string,
      };
      actions.updateNote(note.id, {
        attachments: [...(note.attachments ?? []), att],
        hasAttachment: true,
      });
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = (aid: string) => {
    const next = (note.attachments ?? []).filter((a) => a.id !== aid);
    actions.updateNote(note.id, { attachments: next, hasAttachment: next.length > 0 });
  };

  return (
    <AppShell>
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-2 px-4 pb-2 pt-5">
        <button onClick={() => router.history.back()} className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-card" aria-label="رجوع">
          <ArrowRight className="size-5" />
        </button>
        <div className="min-w-0" />
        {editing ? (
          <button onClick={save} className="grid h-10 shrink-0 place-items-center rounded-full gradient-primary px-4 text-xs font-bold text-primary-foreground shadow-fab" aria-label="حفظ">
            <span className="flex items-center gap-1"><CheckIcon className="size-4" /> حفظ</span>
          </button>
        ) : (
          <button onClick={() => setEditing(true)} className="grid h-10 shrink-0 place-items-center rounded-full bg-primary-soft px-4 text-xs font-bold text-primary shadow-card" aria-label="تحرير">
            تحرير
          </button>
        )}
        <button onClick={() => actions.togglePin(note.id)} className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-card" aria-label="تثبيت">
          <Pin className={`size-4 ${note.pinned ? "rotate-45 text-primary" : "text-muted-foreground"}`} />
        </button>
        <button onClick={() => actions.toggleFavorite(note.id)} className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-card" aria-label="مفضلة">
          <Star className={`size-4 ${note.favorite ? "fill-warning text-warning" : "text-muted-foreground"}`} />
        </button>
        <button onClick={() => { actions.deleteNote(note.id); router.navigate({ to: "/notes" }); }} className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-card" aria-label="حذف">
          <Trash2 className="size-4 text-destructive" />
        </button>
      </header>

      <div className="px-5 pt-4">
        {editing ? (
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            placeholder="عنوان الملاحظة"
            className="w-full bg-transparent text-2xl font-extrabold leading-tight outline-none placeholder:text-muted-foreground/50"
          />
        ) : (
          <h1 className="text-2xl font-extrabold leading-tight">
            <span className="me-2">{note.emoji}</span>
            {note.title}
          </h1>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {cat && (
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
              {cat.name}
            </span>
          )}
          <span className="text-xs text-muted-foreground">آخر تعديل {formatRelative(note.updatedAt)}</span>
          {dirty && <span className="text-[10px] font-bold text-warning">• تغييرات غير محفوظة</span>}
        </div>

        <div className="mt-5">
          {editing ? (
            <RichEditor
              value={draft}
              onChange={(html) => { setDraft(html); setDirty(true); }}
              onAddAttachment={onAttach}
              placeholder="اكتب محتوى الملاحظة..."
            />
          ) : (
            <article
              className="prose-mf rounded-2xl bg-card p-5 shadow-card"
              dir="rtl"
              dangerouslySetInnerHTML={{ __html: renderHtml(note.content) }}
            />
          )}
        </div>

        {note.attachments && note.attachments.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Paperclip className="size-4 text-primary" /> المرفقات ({note.attachments.length})
            </h2>
            <ul className="space-y-2">
              {note.attachments.map((a) => (
                <li key={a.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
                  {a.type.startsWith("image/") ? (
                    <img src={a.dataUrl} alt={a.name} className="size-12 rounded-lg object-cover" />
                  ) : (
                    <div className="grid size-12 place-items-center rounded-lg bg-primary-soft text-primary"><FileText className="size-5" /></div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground">{formatSize(a.size)}</p>
                  </div>
                  <a href={a.dataUrl} download={a.name} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:text-primary" aria-label="تنزيل"><Download className="size-4" /></a>
                  <button onClick={() => removeAttachment(a.id)} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:text-destructive" aria-label="حذف"><X className="size-4" /></button>
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