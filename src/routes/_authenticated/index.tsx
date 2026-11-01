import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckSquare, NotebookText, Plus, Settings, ShieldCheck, ShoppingBag, Target, icons, Folder, ArrowLeft, Pin, CalendarDays } from "lucide-react";
import { useCategories, useNotes, useProfile, useTasks, tsOf } from "@/lib/data";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { formatRelative, plainTextFromHtml } from "@/lib/format";
import { LoadingState, ErrorState } from "@/components/feedback";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [
    { title: "MemoFlow — الرئيسية" },
    { name: "description", content: "أقسام MemoFlow وآخر مذكراتك ومهامك القريبة في مكان واحد." },
    { property: "og:title", content: "MemoFlow — الرئيسية" },
    { property: "og:description", content: "أقسامك الأساسية، آخر المذكرات، والمهام القريبة." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: HomePage,
});

const sections = [
  { to: "/notes", icon: NotebookText, label: "المذكرات" },
  { to: "/tasks", icon: CheckSquare, label: "المهام" },
  { to: "/vault", icon: ShieldCheck, label: "الخزنة" },
  { to: "/plans", icon: Target, label: "الخطط" },
  { to: "/purchases", icon: ShoppingBag, label: "المشتريات" },
  { to: "/settings", icon: Settings, label: "الإعدادات" },
] as const;

function HomePage() {
  const { data: profile } = useProfile();
  const notesQuery = useNotes();
  const tasksQuery = useTasks();
  const categoriesQuery = useCategories();
  const notes = notesQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const openTasks = tasks.filter((task) => !task.done);
  const recentNotes = [...notes].sort((a, b) => tsOf(b.updated_at) - tsOf(a.updated_at)).slice(0, 3);
  const upcomingTasks = [...openTasks].sort((a, b) => (a.due_at ? Date.parse(a.due_at) : Infinity) - (b.due_at ? Date.parse(b.due_at) : Infinity) || tsOf(b.updated_at) - tsOf(a.updated_at)).slice(0, 3);
  const name = profile?.display_name?.split(" ")[0] ?? "";
  return (
    <AppShell>
      <div className="px-4 sm:px-5">
        <header className="flex items-start justify-between gap-3 pb-6 pt-5">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold sm:text-3xl">أهلاً{name ? ` ${name}` : ""}</h1>
            <p className="mt-2 text-sm text-muted-foreground">مساحة لأفكارك، وخطوة لمهامك.</p>
          </div>
          <Button asChild size="icon" className="size-11 shrink-0 rounded-lg">
            <Link to="/create" aria-label="إضافة عنصر جديد" title="إضافة عنصر جديد"><Plus /></Link>
          </Button>
        </header>
        <section aria-label="الأقسام الرئيسية" className="grid grid-cols-3 gap-3">
          {sections.map(({ to, icon: Icon, label }) => (
            <Button key={to} asChild variant="ghost" className="h-24 min-w-0 flex-col gap-3 whitespace-normal rounded-lg border border-border bg-card px-2 text-sm hover:bg-secondary">
              <Link to={to}><Icon className="size-6" aria-hidden="true" /><span>{label}</span></Link>
            </Button>
          ))}
        </section>
        {!notesQuery.isLoading && !tasksQuery.isLoading && !notesQuery.isError && !tasksQuery.isError && (
          <div aria-label="ملخص اليوم" className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border pb-5 text-sm text-muted-foreground">
            <span>{notes.length} مذكرة</span><span>{openTasks.length} مهمة مفتوحة</span><span>{tasks.filter((t) => t.done).length} مكتملة</span>
          </div>
        )}
        <section aria-label="آخر المذكرات" className="mt-7">
          <SectionHeading title="آخر المذكرات" to="/notes" />
          {notesQuery.isLoading ? <LoadingState /> : notesQuery.isError ? <ErrorState title="تعذر تحميل المذكرات" onRetry={() => void notesQuery.refetch()} /> : recentNotes.length ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {recentNotes.map((note) => (
                <Link key={note.id} to="/notes/$id" params={{ id: note.id }} className="flex min-h-44 min-w-0 flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:bg-secondary/50">
                  <div className="mb-3 flex items-center justify-between text-muted-foreground"><NotebookText className="size-5" />{note.pinned && <Pin className="size-4" aria-label="مثبتة" />}</div>
                  <h3 className="line-clamp-2 break-words text-sm font-semibold">{note.title || "بدون عنوان"}</h3>
                  <p className="mt-2 line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">{plainTextFromHtml(note.content) || "مذكرة فارغة"}</p>
                  <span className="mt-auto pt-4 text-xs text-muted-foreground">{formatRelative(tsOf(note.updated_at))}</span>
                </Link>
              ))}
            </div>
          ) : <p className="py-5 text-sm text-muted-foreground">لا توجد مذكرات بعد.</p>}
        </section>
        <section aria-label="المهام القريبة" className="mt-7">
          <SectionHeading title="المهام القريبة" to="/tasks" />
          {tasksQuery.isLoading ? <LoadingState /> : tasksQuery.isError ? <ErrorState title="تعذر تحميل المهام" onRetry={() => void tasksQuery.refetch()} /> : upcomingTasks.length ? (
            <div className="divide-y divide-border border-y border-border">
              {upcomingTasks.map((task) => (
                <Link key={task.id} to="/tasks/$id" params={{ id: task.id }} className="flex min-h-16 items-center gap-3 py-4 transition-colors hover:bg-secondary/50">
                  <CheckSquare className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 line-clamp-2 break-words text-sm font-medium">{task.title}</span>
                  {task.due_at && <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />{new Date(task.due_at).toLocaleDateString("ar-SA", { calendar: "gregory", day: "numeric", month: "short" })}</span>}
                  <ArrowLeft className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          ) : <p className="py-5 text-sm text-muted-foreground">لا توجد مهام مفتوحة.</p>}
        </section>
        <section aria-label="التصنيفات" className="mt-7 pb-5">
          <h2 className="mb-3 text-base font-semibold">التصنيفات</h2>
          {categoriesQuery.isLoading ? <LoadingState /> : categoriesQuery.isError ? <ErrorState title="تعذر تحميل التصنيفات" onRetry={() => void categoriesQuery.refetch()} /> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {categories.map((category) => {
                const Icon = (icons as Record<string, typeof Folder>)[category.icon] ?? Folder;
                return <Button key={category.id} asChild variant="ghost" className="h-auto min-h-16 min-w-0 justify-start gap-3 whitespace-normal rounded-lg border border-border px-3 py-3">
                  <Link to="/notes" search={{ cat: category.id }}><Icon className="size-5 shrink-0" /><span className="min-w-0 flex-1 break-words text-start">{category.name}<span className="mt-1 block text-xs font-normal text-muted-foreground">{notes.filter((n) => n.category_id === category.id).length} مذكرة</span></span></Link>
                </Button>;
              })}
              {!categories.length && <p className="col-span-full py-3 text-sm text-muted-foreground">لا توجد تصنيفات بعد.</p>}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function SectionHeading({ title, to }: { title: string; to: "/notes" | "/tasks" }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-semibold">{title}</h2><Button asChild variant="ghost" size="sm" className="min-h-11 gap-2 text-xs text-muted-foreground"><Link to={to}>عرض الكل<ArrowLeft /></Link></Button></div>;
}
