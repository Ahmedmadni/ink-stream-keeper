import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckSquare, LayoutGrid, NotebookText, Plus, ShoppingBag, Target,
} from "lucide-react";
import { icons, Folder } from "lucide-react";
import { useCategories, useNotes, useProfile, useTasks } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "MemoFlow — الرئيسية" },
      { name: "description", content: "نظرة سريعة على مذكراتك ومهامك وتصنيفاتك في MemoFlow." },
      { property: "og:title", content: "MemoFlow — الرئيسية" },
      { property: "og:description", content: "نظرة سريعة على مذكراتك ومهامك وتصنيفاتك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: profile } = useProfile();
  const { data: notes = [] } = useNotes();
  const { data: tasks = [] } = useTasks();
  const { data: categories = [] } = useCategories();

  const openTasks = tasks.filter((t) => !t.done);
  const donePct = tasks.length ? Math.round(((tasks.length - openTasks.length) / tasks.length) * 100) : 0;
  const name = profile?.display_name?.split(" ")[0] ?? "";

  return (
    <div className="px-4 sm:px-5">
      <header className="pb-5 pt-3">
        <h1 className="text-[clamp(1.5rem,6vw,2rem)] font-semibold leading-tight">
          أهلاً{name ? ` ${name}` : ""} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">إليك نظرة سريعة على يومك.</p>
      </header>

      <section aria-label="إحصائيات سريعة" className="grid grid-cols-3 gap-3">
        <StatCard to="/notes" icon={NotebookText} value={notes.length} label="مذكرة" />
        <StatCard to="/tasks" icon={CheckSquare} value={openTasks.length} label="مهمة مفتوحة" />
        <StatCard to="/tasks" icon={Target} value={`${donePct}%`} label="نسبة الإنجاز" />
      </section>

      <section aria-label="التصنيفات" className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">التصنيفات</h2>
          <Link
            to="/create"
            aria-label="إضافة عنصر جديد"
            className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground"
          >
            <Plus className="size-5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Link
            to="/notes"
            search={{}}
            className="glass flex flex-col gap-2 rounded-2xl border p-4 transition-transform active:scale-[0.98]"
          >
            <LayoutGrid className="size-6 text-primary" />
            <span className="text-sm font-medium">كل المذكرات</span>
            <span className="text-xs text-muted-foreground">{notes.length} عنصر</span>
          </Link>
          {categories.map((c) => {
            const count = notes.filter((n) => n.category_id === c.id).length;
            return (
              <Link
                key={c.id}
                to="/notes"
                search={{ cat: c.id }}
                className="glass flex flex-col gap-2 rounded-2xl border p-4 transition-transform active:scale-[0.98]"
              >
                {(() => {
                  const I = (c.icon && (icons as Record<string, typeof Folder>)[c.icon]) || null;
                  return I ? <I className="h-6 w-6" aria-hidden /> : <span className="text-2xl" aria-hidden>{c.icon || "🗂️"}</span>;
                })()}
                <span className="truncate text-sm font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{count} مذكرة</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-label="أقسام أخرى" className="mt-8 grid grid-cols-2 gap-3 pb-4">
        <QuickLink to="/plans" icon={Target} label="الخطط" />
        <QuickLink to="/purchases" icon={ShoppingBag} label="المشتريات" />
      </section>
    </div>
  );
}

function StatCard({
  to, icon: Icon, value, label,
}: {
  to: string;
  icon: typeof NotebookText;
  value: number | string;
  label: string;
}) {
  return (
    <Link
      to={to as never}
      className="glass flex flex-col items-center gap-1 rounded-2xl border p-4 text-center"
    >
      <Icon className="size-5 text-primary" />
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </Link>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: typeof Target; label: string }) {
  return (
    <Link
      to={to as never}
      className="glass flex items-center gap-3 rounded-2xl border p-4 text-sm font-medium"
    >
      <Icon className="size-5 text-primary" />
      {label}
    </Link>
  );
}
