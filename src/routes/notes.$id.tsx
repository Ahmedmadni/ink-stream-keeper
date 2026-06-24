import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, Pin, Star, Share2, Trash2, Image as ImageIcon, Paperclip, Type, Pencil, Shapes } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { actions, formatRelative, useStore } from "@/lib/store";

export const Route = createFileRoute("/notes/$id")({
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

  return (
    <AppShell>
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-2 px-4 pb-2 pt-5">
        <button onClick={() => router.history.back()} className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-card" aria-label="رجوع">
          <ArrowRight className="size-5" />
        </button>
        <div className="min-w-0" />
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
        <h1 className="text-2xl font-extrabold leading-tight">
          <span className="me-2">{note.emoji}</span>
          {note.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {cat && (
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
              {cat.name}
            </span>
          )}
          <span className="text-xs text-muted-foreground">آخر تعديل {formatRelative(note.updatedAt)}</span>
        </div>

        <div className="mt-6 rounded-2xl bg-card p-5 shadow-card">
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">{note.content}</p>
        </div>

        <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Star className="size-4 fill-warning text-warning" /> أشياء يجب تجربتها
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><Check /> زيارة رجال ألمع</li>
            <li className="flex items-center gap-2"><Check /> تجربة العسل الجبلي</li>
            <li className="flex items-center gap-2"><Check /> التخييم في الجبال</li>
          </ul>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          محرر النص الغني، الأشكال، والصور قادمة قريباً ضمن خارطة الطريق.
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-20 z-30 mx-auto max-w-md px-5">
        <div className="flex items-center justify-around rounded-2xl bg-card px-3 py-2.5 shadow-elevated">
          <ToolBtn icon={Shapes} label="أشكال" />
          <ToolBtn icon={Pencil} label="رسم" />
          <ToolBtn icon={ImageIcon} label="صورة" />
          <ToolBtn icon={Paperclip} label="ملحق" />
          <ToolBtn icon={Type} label="نص" />
          <ToolBtn icon={Share2} label="مشاركة" />
        </div>
      </div>
    </AppShell>
  );
}

function ToolBtn({ icon: Icon, label }: { icon: typeof Pin; label: string }) {
  return (
    <button className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-primary">
      <Icon className="size-5" />
      <span>{label}</span>
    </button>
  );
}

function Check() {
  return (
    <span className="grid size-4 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
      <svg viewBox="0 0 16 16" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M3 8l3 3 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}