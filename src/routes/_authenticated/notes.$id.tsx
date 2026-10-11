import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "@/components/feedback";
import { useNoteAutosave } from "@/features/notes/use-note-autosave";
import type { NoteSaveSnapshot } from "@/features/notes/autosave";
import {
  ArrowRight,
  Pin,
  Star,
  Trash2,
  Paperclip,
  FileText,
  Download,
  X,
  Loader2,
  Cloud,
  CloudOff,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  useCategories,
  useNote,
  useNoteAttachments,
  useDeleteAttachment,
  useDeleteNote,
  useUpdateNote,
  useUploadAttachment,
  tsOf,
  type Note,
} from "@/lib/data";
import { formatRelative, plainTextFromHtml } from "@/lib/format";
import { RichEditor } from "@/components/RichEditor";
import { AudioRecorder } from "@/components/AudioRecorder";
import { LectureRecorder } from "@/components/speech/LectureRecorder";
import { SubItemsTree } from "@/components/subitems/SubItemsTree";

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
  const { user } = Route.useRouteContext();
  const { data: note, isLoading, isError, refetch } = useNote(id);
  if (isLoading)
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  if (isError)
    return (
      <AppShell>
        <ErrorState
          title="تعذر تحميل المذكرة"
          onRetry={() => {
            void refetch();
          }}
        />
      </AppShell>
    );
  if (!note || note.user_id !== user.id)
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-muted-foreground">
          لم يتم العثور على المذكرة.
          <div className="mt-4">
            <Link to="/notes" className="text-primary font-semibold">
              العودة للمذكرات
            </Link>
          </div>
        </div>
      </AppShell>
    );
  return <NoteEditor key={`${user.id}:${id}`} note={note} />;
}

function NoteEditor({ note }: { note: Note }) {
  const router = useRouter();
  const id = note.id;
  const { data: categories = [] } = useCategories();
  const { data: attachments = [] } = useNoteAttachments(id);
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const upload = useUploadAttachment();
  const removeAtt = useDeleteAttachment();
  const { controller, snapshot } = useNoteAutosave(note);
  const { title, content: draft } = snapshot.draft;
  const cat = categories.find((c) => c.id === note.category_id);

  return (
    <AppShell>
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-2 px-4 pb-2 pt-5">
        <Link
          to="/notes"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-card"
          aria-label="العودة للمذكرات"
        >
          <ArrowRight className="size-5" />
        </Link>
        <div className="min-w-0">
          <SaveStatus snapshot={snapshot} />
        </div>
        <AudioRecorder
          onRecorded={(file) => {
            upload.mutate({ noteId: note.id, file });
          }}
        />
        <button
          onClick={() => updateNote.mutate({ id: note.id, patch: { pinned: !note.pinned } })}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-card"
          aria-label="تثبيت"
        >
          <Pin
            className={`size-4 ${note.pinned ? "rotate-45 text-primary" : "text-muted-foreground"}`}
          />
        </button>
        <button
          onClick={() => updateNote.mutate({ id: note.id, patch: { favorite: !note.favorite } })}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-card"
          aria-label="مفضلة"
        >
          <Star
            className={`size-4 ${note.favorite ? "fill-warning text-warning" : "text-muted-foreground"}`}
          />
        </button>
        <button
          disabled={deleteNote.isPending}
          onClick={async () => {
            if (!confirm("حذف المذكرة ومسودتها المحلية؟")) return;
            controller.stop();
            try {
              await deleteNote.mutateAsync(note.id);
            } catch {
              controller.start();
              toast.error("تعذر إتمام الحذف. راجع المذكرة وحاول مجددًا.");
              return;
            }
            try {
              controller.discardLocal();
            } catch {
              toast.info("حُذفت المذكرة من الخادم، لكن تعذر إزالة مسودتها المحلية من هذا الجهاز.");
            }
            await router.navigate({ to: "/notes" });
          }}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-card"
          aria-label="حذف"
        >
          <Trash2 className="size-4 text-destructive" />
        </button>
      </header>

      <div className="px-5 pt-4">
        {snapshot.localError && !["clean", "saved"].includes(snapshot.state) && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
          >
            تعذر حفظ المسودة على هذا الجهاز. أبقِ الصفحة مفتوحة حتى ينجح الحفظ في الخادم، أو انسخ
            النص قبل المغادرة.
          </p>
        )}
        {snapshot.recovered && snapshot.state !== "conflict" && (
          <p role="status" className="mb-4 text-sm text-primary">
            استُعيدت مسودتك المحفوظة على هذا الجهاز.
          </p>
        )}
        {snapshot.state === "error" && (
          <div role="alert" className="mb-4 rounded-xl bg-warning/10 p-3 text-sm">
            <p>
              {snapshot.localError
                ? "تعذر الحفظ في الخادم وعلى الجهاز."
                : "المسودة محفوظة على هذا الجهاز. تعذر الحفظ في الخادم؛ أعد المحاولة عند توفر الاتصال."}
            </p>
            <button
              onClick={() => {
                void controller.flush();
              }}
              className="mt-2 rounded-lg bg-card px-3 py-2 font-semibold text-primary"
            >
              إعادة محاولة الحفظ
            </button>
          </div>
        )}
        {snapshot.state === "conflict" && (
          <section
            role="alert"
            className="mb-4 space-y-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm"
          >
            <h2 className="font-semibold">تغيّرت نسخة المذكرة على الخادم</h2>
            <p>احتفظنا بمسودتك ولم نكتب فوق النسخة الأخرى. اختر النسخة التي تريد الاحتفاظ بها.</p>
            {snapshot.remote ? (
              <>
                <details>
                  <summary className="cursor-pointer">عرض نسخة الخادم</summary>
                  <h3 className="mt-2 font-semibold">{snapshot.remote.title || "بدون عنوان"}</h3>
                  <p className="max-h-48 overflow-auto whitespace-pre-wrap">
                    {plainTextFromHtml(snapshot.remote.content)}
                  </p>
                </details>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => controller.keepDraft()}
                    className="rounded-lg bg-primary px-3 py-2 text-primary-foreground"
                  >
                    استبدال نسخة الخادم بمسودتي
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("تجاهل المسودة المحلية واستخدام نسخة الخادم؟"))
                        controller.useRemote();
                    }}
                    className="rounded-lg bg-card px-3 py-2"
                  >
                    استخدام نسخة الخادم
                  </button>
                </div>
              </>
            ) : (
              <p>
                قد تكون المذكرة حُذفت أو تغيّرت صلاحية الوصول. انسخ نص مسودتك قبل مغادرة الصفحة.
              </p>
            )}
          </section>
        )}

        <div className="flex items-start gap-2">
          {note.emoji && <span className="text-2xl leading-tight">{note.emoji}</span>}
          <input
            value={title}
            onChange={(e) => controller.edit({ title: e.target.value })}
            placeholder="بدون عنوان"
            aria-label="عنوان الملاحظة"
            className="w-full bg-transparent text-2xl font-extrabold leading-tight outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {cat && (
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
              {cat.name}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            آخر تعديل {formatRelative(tsOf(note.updated_at))}
          </span>
        </div>

        <div className="mt-5">
          <RichEditor
            value={draft}
            onChange={(html) => controller.edit({ content: html })}
            onAddAttachment={(file) => upload.mutate({ noteId: note.id, file })}
            placeholder="اكتب محتوى الملاحظة..."
            showCount
          />
        </div>

        <div className="mt-6">
          <LectureRecorder
            onInsert={(t) => {
              const html = t
                .split(/\n{2,}/)
                .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br/>")}</p>`)
                .join("");
              controller.edit({ content: controller.getSnapshot().draft.content + html });
            }}
            onAudioFile={(file) => upload.mutate({ noteId: note.id, file })}
          />
        </div>

        <div className="mt-6">
          <SubItemsTree
            parentType="note"
            parentId={note.id}
            title="بنود الملاحظة"
            addPlaceholder="أضف بنداً للملاحظة…"
            allowConvertToTask
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
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mb-3 block overflow-hidden rounded-xl"
                      >
                        <img
                          src={a.url}
                          alt={a.name}
                          className="max-h-[400px] w-full object-contain"
                        />
                      </a>
                    )}
                    {isAudio && a.url && <audio src={a.url} controls className="mb-3 w-full" />}
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary">
                        <FileText className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{a.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatSize(a.size_bytes)}
                        </p>
                      </div>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        download={a.name}
                        className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:text-primary"
                        aria-label="تنزيل"
                      >
                        <Download className="size-4" />
                      </a>
                      <button
                        onClick={() =>
                          removeAtt.mutate({ id: a.id, noteId: note.id, path: a.storage_path })
                        }
                        className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:text-destructive"
                        aria-label="حذف"
                      >
                        <X className="size-4" />
                      </button>
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function SaveStatus({ snapshot }: { snapshot: NoteSaveSnapshot }) {
  const { state, localError } = snapshot;
  const map = {
    clean: {
      icon: <Cloud className="size-3.5" />,
      text: "محفوظة في الخادم",
      cls: "text-muted-foreground",
    },
    dirty: {
      icon: <CloudOff className="size-3.5" />,
      text: localError ? "تغييرات غير محفوظة" : "مسودة على الجهاز",
      cls: "text-warning",
    },
    saving: {
      icon: <Loader2 className="size-3.5 animate-spin" />,
      text: "جارٍ الحفظ…",
      cls: "text-muted-foreground",
    },
    saved: {
      icon: <Cloud className="size-3.5" />,
      text: "تم الحفظ في الخادم",
      cls: "text-success",
    },
    error: {
      icon: <CloudOff className="size-3.5" />,
      text: localError ? "فشل الحفظ" : "مسودة على الجهاز",
      cls: "text-warning",
    },
    conflict: {
      icon: <CloudOff className="size-3.5" />,
      text: "نسختان مختلفتان",
      cls: "text-warning",
    },
  }[state];
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${map.cls}`}
    >
      {map.icon}
      <span>{map.text}</span>
    </span>
  );
}

function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
