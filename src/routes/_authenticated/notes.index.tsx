import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Pin, Star, Plus, NotebookText } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useCategories, useNotes, tsOf } from "@/lib/data";
import { LoadingState, ErrorState } from "@/components/feedback";
import { formatRelative, plainTextFromHtml } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/notes/")({
  validateSearch: (search: Record<string, unknown>): { cat?: string } => ({
    cat: typeof search.cat === "string" ? search.cat : undefined,
  }),
  head: () => ({
    meta: [
      { title: "MemoFlow — المذكرات" },
      { name: "description", content: "تصفح جميع ملاحظاتك، صنفها، ابحث وفلتر حسب التصنيف." },
      { property: "og:title", content: "MemoFlow — المذكرات" },
      { property: "og:description", content: "مذكراتك في بطاقات مرتبة مع البحث والتصنيفات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const notesQuery = useNotes();
  const { data: notes = [] } = notesQuery;
  const { data: categories = [] } = useCategories();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const cat = search.cat ?? "all";
  const setCat = (v: string) =>
    navigate({ to: "/notes", search: v === "all" ? {} : { cat: v }, replace: true });

  const filtered = useMemo(() => {
    return notes
      .filter((n) => (cat === "all" ? true : n.category_id === cat))
      .filter((n) => {
        if (!q.trim()) return true;
        const s = q.trim().toLowerCase();
        return (
          n.title.toLowerCase().includes(s) ||
          plainTextFromHtml(n.content).toLowerCase().includes(s)
        );
      })
      .sort(
        (a, b) =>
          Number(!!b.pinned) - Number(!!a.pinned) || tsOf(b.updated_at) - tsOf(a.updated_at),
      );
  }, [notes, q, cat]);

  return (
    <AppShell>
      <PageHeader
        title="المذكرات"
        subtitle={`${filtered.length} مذكرة`}
        action={
          <Link
            to="/create"
            search={{ kind: "note" }}
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"
            aria-label="مذكرة جديدة"
          >
            <Plus className="size-6" />
          </Link>
        }
      />

      <div className="px-5">
        <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-card">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="بحث في المذكرات"
            type="search"
            placeholder="بحث..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto px-5">
        <div className="flex gap-2 pb-1">
          <Chip active={cat === "all"} onClick={() => setCat("all")}>
            الكل
          </Chip>
          {categories.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>
      </div>

      {notesQuery.isLoading && <LoadingState />}
      {notesQuery.isError && (
        <ErrorState
          title="تعذر تحميل المذكرات"
          onRetry={() => {
            void notesQuery.refetch();
          }}
        />
      )}
      <div className="mt-4 grid grid-cols-1 gap-4 px-5 sm:grid-cols-2" aria-label="بطاقات المذكرات">
        {!notesQuery.isLoading && !notesQuery.isError && filtered.length === 0 && (
            <div className="col-span-full rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
            لا توجد ملاحظات مطابقة.
          </div>
        )}
        {filtered.map((n) => {
          const c = categories.find((x) => x.id === n.category_id);
          return (
            <Link
              key={n.id}
              to="/notes/$id"
              params={{ id: n.id }}
              className="group relative flex min-h-52 flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
            >
              <div className="flex items-center justify-between gap-2">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-xl text-primary">
                {n.emoji || <NotebookText className="size-5" />}
              </div>
              {n.pinned && <Pin aria-label="مثبتة" className="size-4 shrink-0 rotate-45 text-primary" />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="line-clamp-2 break-words text-base font-semibold">{n.title || "بدون عنوان"}</h3>
                  {n.favorite && <Star className="size-3.5 shrink-0 fill-warning text-warning" />}
                </div>
                <p className="mt-2 line-clamp-3 break-words text-sm leading-relaxed text-muted-foreground">
                  {plainTextFromHtml(n.content) || "ملاحظة فارغة"}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                  {c && (
                    <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {c.name}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelative(tsOf(n.updated_at))}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${active ? "bg-primary text-primary-foreground shadow-card" : "bg-card text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}
