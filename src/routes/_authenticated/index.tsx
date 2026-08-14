import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell, Search, Pin, Notebook, Lightbulb, CheckSquare, ShoppingCart, Lock,
  Briefcase, GraduationCap, Star, Plus, Sliders, FolderKanban,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useCategories, useNotes, useProfile, useTasks, tsOf, type Category, type Note } from "@/lib/data";
import { usePurchaseLists, useAllPurchaseStats } from "@/lib/purchases";
import { useWorkspaces, useAllWorkspaceStats } from "@/lib/workspaces";
import { formatCurrency } from "@/lib/item-types";
import { formatRelative, greeting, plainTextFromHtml } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "MemoFlow — الرئيسية" },
      { name: "description", content: "لوحة الرئيسية: ملاحظاتك، مهامك، تصنيفاتك في مكان واحد." },
    ],
  }),
  component: Index,
});

const iconMap: Record<string, typeof Notebook> = {
  Notebook, Lightbulb, CheckSquare, ShoppingCart, Lock, Briefcase, GraduationCap,
};

function toneBg(tone: string) {
  switch (tone) {
    case "warning": return "bg-warning/15 text-warning";
    case "success": return "bg-success/15 text-success";
    case "destructive": return "bg-destructive/15 text-destructive";
    case "accent": return "bg-accent text-accent-foreground";
    default: return "bg-primary-soft text-primary";
  }
}

function Index() {
  const { data: profile } = useProfile();
  const { data: notes = [] } = useNotes();
  const { data: tasks = [] } = useTasks();
  const { data: categories = [] } = useCategories();
  const { data: purchaseLists = [] } = usePurchaseLists();
  const { data: purchaseStats = [] } = useAllPurchaseStats();
  const { data: workspaces = [] } = useWorkspaces();
  const { data: wsStats = [] } = useAllWorkspaceStats();

  const ideasCat = categories.find((c) => c.name === "أفكار");
  const stats = {
    notes: notes.length,
    todayTasks: tasks.filter((t) => !t.done).length,
    ideas: ideasCat ? notes.filter((n) => n.category_id === ideasCat.id).length : 0,
    favorites: notes.filter((n) => n.favorite).length,
  };
  const pinned = notes.filter((n) => n.pinned);
  const now = Date.now();
  const endOfToday = (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); })();
  const endOfWeek = endOfToday + 6 * 86_400_000;
  const open = tasks.filter((t) => !t.done);
  const kpi = {
    overdue: open.filter((t) => t.due_at && tsOf(t.due_at) < now).length,
    today: open.filter((t) => t.due_at && tsOf(t.due_at) >= now && tsOf(t.due_at) <= endOfToday).length,
    week: open.filter((t) => t.due_at && tsOf(t.due_at) > endOfToday && tsOf(t.due_at) <= endOfWeek).length,
    rate: tasks.length ? Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100) : 0,
  };
  const recent = [...notes].sort((a, b) => tsOf(b.updated_at) - tsOf(a.updated_at)).slice(0, 4);
  const userName = profile?.display_name?.trim() || "أهلاً";

  return (
    <AppShell>
      <div className="gradient-soft px-5 pb-6 pt-7">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-lg font-bold text-primary-foreground shadow-card">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="size-full object-cover" />
            ) : (
              userName.slice(0, 1)
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">{greeting()}،</p>
            <p className="truncate text-base font-bold text-foreground">{userName} 👋</p>
          </div>
          <button className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-foreground shadow-card" aria-label="إشعارات">
            <Bell className="size-5" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-card">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input type="search" placeholder="ابحث في ملاحظاتك، مهامك، تصنيفاتك..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <button className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary" aria-label="فلترة">
            <Sliders className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2.5">
          <StatCard value={stats.notes} label="ملاحظة" tone="primary" />
          <StatCard value={stats.todayTasks} label="مهام اليوم" tone="warning" />
          <StatCard value={stats.ideas} label="أفكار" tone="success" />
          <StatCard value={stats.favorites} label="مفضلة" tone="accent" />
        </div>
      </div>

      <section className="px-5 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">مؤشرات الأداء</h2>
          <Link to="/tasks" className="text-xs font-semibold text-primary">كل المهام</Link>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <KpiCard value={kpi.overdue} label="متأخرة" tone="destructive" />
          <KpiCard value={kpi.today} label="تستحق اليوم" tone="warning" />
          <KpiCard value={kpi.week} label="هذا الأسبوع" tone="primary" />
          <KpiCard value={`${kpi.rate}%`} label="معدل الإنجاز" tone="success" progress={kpi.rate} />
        </div>
      </section>

      <section className="px-5 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">التصنيفات</h2>
          <Link to="/notes" className="text-xs font-semibold text-primary">عرض الكل</Link>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {categories.slice(0, 7).map((c: Category) => {
            const Icon = iconMap[c.icon] ?? Notebook;
            const count = notes.filter((n) => n.category_id === c.id).length;
            return (
              <div key={c.id} className="flex flex-col items-center gap-1.5 rounded-2xl bg-card p-3 shadow-card">
                <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${toneBg(c.color)}`}>
                  <Icon className="size-5" />
                </div>
                <p className="line-clamp-1 text-center text-[11px] font-semibold">{c.name}</p>
                <p className="text-[10px] text-muted-foreground">{count}</p>
              </div>
            );
          })}
          <Link to="/create" className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border bg-card/50 p-3 text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <Plus className="size-5" />
            <span className="text-[11px] font-semibold">إضافة</span>
          </Link>
        </div>
      </section>

      <section className="px-5 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <FolderKanban className="size-4 text-primary" /> مساحات العمل
          </h2>
          <Link to="/workspaces" className="text-xs font-semibold text-primary">عرض الكل</Link>
        </div>
        {workspaces.length === 0 ? (
          <Link to="/workspaces" className="grid place-items-center rounded-2xl border-2 border-dashed border-border bg-card/50 p-6 text-center text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <FolderKanban className="mb-1 size-6" />
            ابدأ بإنشاء أول مساحة عمل
          </Link>
        ) : (
          <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {workspaces.filter((w) => !w.archived).slice(0, 6).map((w) => {
              const s = wsStats.find((x) => x.workspace_id === w.id);
              return (
                <Link key={w.id} to="/workspaces/$id" params={{ id: w.id }} className="w-40 shrink-0 overflow-hidden rounded-2xl bg-card shadow-card">
                  <div className="grid h-16 w-full place-items-center bg-primary-soft text-primary">
                    {w.cover_url ? <img src={w.cover_url} alt="" className="size-full object-cover" /> : <FolderKanban className="size-7" />}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-xs font-bold">{w.name}</p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary" style={{ width: `${s?.progress ?? 0}%` }} />
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">{s?.items_count ?? 0} عنصر · {s?.progress ?? 0}%</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {purchaseLists.length > 0 && (
        <section className="px-5 pt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <ShoppingCart className="size-4 text-success" /> قوائم المشتريات
            </h2>
            <Link to="/purchases" className="text-xs font-semibold text-primary">عرض الكل</Link>
          </div>
          <div className="space-y-2.5">
            {purchaseLists.slice(0, 3).map((l) => {
              const s = purchaseStats.find((x) => x.purchase_list_id === l.id);
              return (
                <Link key={l.id} to="/purchases/$id" params={{ id: l.id }}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-3.5 shadow-card transition-transform active:scale-[0.98]">
                  <span className="grid size-10 place-items-center rounded-xl bg-success/15 text-success">
                    <ShoppingCart className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{l.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {(s?.purchased_count ?? 0)}/{(s?.items_count ?? 0)} · {formatCurrency(s?.actual_total ?? 0, l.currency)} / {formatCurrency(l.budget, l.currency)}
                    </p>
                  </div>
                  <span className="rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">{s?.progress ?? 0}%</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {pinned.length > 0 && (
        <section className="px-5 pt-6">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
            <Pin className="size-4 text-primary" /> المثبتة
          </h2>
          <div className="space-y-2.5">
            {pinned.map((n) => (<NoteRow key={n.id} note={n} categories={categories} pinned />))}
          </div>
        </section>
      )}

      <section className="px-5 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">آخر الملاحظات</h2>
          <Link to="/notes" className="text-xs font-semibold text-primary">عرض الكل</Link>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
            لا توجد ملاحظات بعد. ابدأ بإنشاء أول ملاحظة ✨
          </div>
        ) : (
          <div className="space-y-2.5">
            {recent.map((n) => (<NoteRow key={n.id} note={n} categories={categories} />))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function StatCard({ value, label, tone }: { value: number; label: string; tone: string }) {
  const toneClass: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    warning: "bg-warning/15 text-warning",
    success: "bg-success/15 text-success",
    accent: "bg-accent text-accent-foreground",
  };
  return (
    <div className={`rounded-2xl p-3 text-center shadow-card ${toneClass[tone] ?? ""}`}>
      <p className="text-xl font-extrabold">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium opacity-80">{label}</p>
    </div>
  );
}

function NoteRow({ note, categories, pinned }: { note: Note; categories: Category[]; pinned?: boolean }) {
  const cat = categories.find((c) => c.id === note.category_id);
  const preview = plainTextFromHtml(note.content);
  return (
    <Link
      to="/notes/$id"
      params={{ id: note.id }}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-2xl bg-card p-3.5 shadow-card transition-transform active:scale-[0.98]"
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-lg">{note.emoji ?? "📝"}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-bold">{note.title || "بدون عنوان"}</h3>
          {note.favorite && <Star className="size-3.5 shrink-0 fill-warning text-warning" />}
        </div>
        <p className="line-clamp-1 text-xs text-muted-foreground">{preview || "ملاحظة فارغة"}</p>
        <div className="mt-1.5 flex items-center gap-2">
          {cat && (
            <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">{cat.name}</span>
          )}
          <span className="text-[10px] text-muted-foreground">{formatRelative(tsOf(note.updated_at))}</span>
        </div>
      </div>
      {pinned && <Pin className="size-4 shrink-0 rotate-45 text-primary" />}
    </Link>
  );
}