import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Pin, Star, Filter } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useCategories, useNotes, tsOf } from "@/lib/data";
import { formatRelative, plainTextFromHtml } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/notes")({
  validateSearch: (search: Record<string, unknown>): { cat?: string } => ({
    cat: typeof search.cat === "string" ? search.cat : undefined,
  }),
  head: () => ({
    meta: [
      { title: "MemoFlow — كل الملاحظات" },
      { name: "description", content: "تصفح جميع ملاحظاتك، صنفها، ابحث وفلتر حسب التصنيف." },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const { data: notes = [] } = useNotes();
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
        const s = q.toLowerCase();
        return n.title.toLowerCase().includes(s) || plainTextFromHtml(n.content).toLowerCase().includes(s);
      })
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || tsOf(b.updated_at) - tsOf(a.updated_at));
  }, [notes, q, cat]);

  return (
    <AppShell>
      <PageHeader title="كل الملاحظات" subtitle={`${filtered.length} ملاحظة`} action={
        <button className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-card" aria-label="فلترة">
          <Filter className="size-4" />
        </button>
      } />

      <div className="px-5">
        <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-card">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="بحث..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto px-5">
        <div className="flex gap-2 pb-1">
          <Chip active={cat === "all"} onClick={() => setCat("all")}>الكل</Chip>
          {categories.map((c) => (<Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</Chip>))}
        </div>
      </div>

      <div className="mt-4 space-y-2.5 px-5">
        {filtered.length === 0 && (
          <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-card">لا توجد ملاحظات مطابقة.</div>
        )}
        {filtered.map((n) => {
          const c = categories.find((x) => x.id === n.category_id);
          return (
            <Link key={n.id} to="/notes/$id" params={{ id: n.id }} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-2xl bg-card p-3.5 shadow-card transition-transform active:scale-[0.98]">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-xl">{n.emoji ?? "📝"}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-bold">{n.title || "بدون عنوان"}</h3>
                  {n.favorite && <Star className="size-3.5 shrink-0 fill-warning text-warning" />}
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{plainTextFromHtml(n.content) || "ملاحظة فارغة"}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {c && (<span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">{c.name}</span>)}
                  <span className="text-[10px] text-muted-foreground">{formatRelative(tsOf(n.updated_at))}</span>
                </div>
              </div>
              {n.pinned && <Pin className="size-4 shrink-0 rotate-45 text-primary" />}
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${active ? "bg-primary text-primary-foreground shadow-card" : "bg-card text-muted-foreground hover:text-foreground"}`}>{children}</button>
  );
}