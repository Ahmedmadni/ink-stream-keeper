import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FolderKanban, Plus, Star, Archive, Loader2, X } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  useWorkspaces, useAllWorkspaceStats, useCreateWorkspace, useUpdateWorkspace,
  type Workspace,
} from "@/lib/workspaces";

export const Route = createFileRoute("/_authenticated/workspaces")({
  head: () => ({
    meta: [
      { title: "MemoFlow — مساحات العمل" },
      { name: "description", content: "نظّم مهامك وملاحظاتك ومشترياتك داخل مساحات عمل موحّدة." },
    ],
  }),
  component: WorkspacesPage,
});

const COLOR_PRESETS = [
  { key: "primary", label: "أزرق", bg: "bg-primary-soft text-primary" },
  { key: "success", label: "أخضر", bg: "bg-success/15 text-success" },
  { key: "warning", label: "أصفر", bg: "bg-warning/15 text-warning" },
  { key: "destructive", label: "أحمر", bg: "bg-destructive/15 text-destructive" },
  { key: "accent", label: "بنفسجي", bg: "bg-accent text-accent-foreground" },
];

function toneClass(c: string): string {
  return COLOR_PRESETS.find((x) => x.key === c)?.bg ?? "bg-primary-soft text-primary";
}

function WorkspacesPage() {
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const { data: stats = [] } = useAllWorkspaceStats();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);

  const list = workspaces.filter((w) => (showArchived ? w.archived : !w.archived));
  const favorites = list.filter((w) => w.favorite);
  const others = list.filter((w) => !w.favorite);

  return (
    <AppShell>
      <PageHeader
        title="مساحات العمل"
        subtitle="جمّع كل ما يخصّ مشروعاً واحداً في مكان واحد"
        action={
          <button onClick={() => setCreating(true)} className="grid size-10 place-items-center rounded-full gradient-primary text-primary-foreground shadow-fab" aria-label="مساحة جديدة">
            <Plus className="size-5" />
          </button>
        }
      />

      <div className="flex items-center gap-2 px-5 pt-2">
        <button onClick={() => setShowArchived(false)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${!showArchived ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground shadow-card"}`}>
          النشطة
        </button>
        <button onClick={() => setShowArchived(true)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${showArchived ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground shadow-card"}`}>
          <Archive className="me-1 inline size-3.5" /> الأرشيف
        </button>
      </div>

      <div className="px-5 pt-4">
        {isLoading ? (
          <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : list.length === 0 ? (
          <EmptyState onCreate={() => setCreating(true)} />
        ) : (
          <div className="space-y-6">
            {favorites.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Star className="size-3.5 fill-warning text-warning" /> المفضلة
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {favorites.map((w) => <WorkspaceCard key={w.id} w={w} stats={stats.find((s) => s.workspace_id === w.id)} />)}
                </div>
              </section>
            )}
            {others.length > 0 && (
              <section>
                {favorites.length > 0 && <h2 className="mb-2 text-xs font-bold text-muted-foreground">الكل</h2>}
                <div className="grid grid-cols-1 gap-3">
                  {others.map((w) => <WorkspaceCard key={w.id} w={w} stats={stats.find((s) => s.workspace_id === w.id)} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {creating && <CreateDialog onClose={() => setCreating(false)} />}
    </AppShell>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl bg-card p-8 text-center shadow-card">
      <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
        <FolderKanban className="size-7" />
      </div>
      <p className="text-sm font-bold">لا توجد مساحات عمل بعد</p>
      <p className="mt-1 text-xs text-muted-foreground">ابدأ بإنشاء مساحة لتجميع المهام والملاحظات والمشتريات في مكان واحد.</p>
      <button onClick={onCreate} className="mx-auto mt-4 rounded-2xl gradient-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-fab">
        إنشاء مساحة
      </button>
    </div>
  );
}

function WorkspaceCard({ w, stats }: { w: Workspace; stats?: { items_count: number; progress: number; tasks_count: number; notes_count: number; purchases_count: number } }) {
  const update = useUpdateWorkspace();
  return (
    <Link
      to="/workspaces/$id"
      params={{ id: w.id }}
      className="block overflow-hidden rounded-2xl bg-card shadow-card transition-transform active:scale-[0.99]"
    >
      <div className={`h-20 w-full ${toneClass(w.color)} relative`}>
        {w.cover_url ? (
          <img src={w.cover_url} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center opacity-60"><FolderKanban className="size-9" /></div>
        )}
        <button
          onClick={(e) => { e.preventDefault(); update.mutate({ id: w.id, patch: { favorite: !w.favorite } }); }}
          className="absolute end-2 top-2 grid size-8 place-items-center rounded-full bg-card/90 backdrop-blur shadow-card"
          aria-label="تثبيت في المفضلة"
        >
          <Star className={`size-4 ${w.favorite ? "fill-warning text-warning" : "text-muted-foreground"}`} />
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold">{w.name}</h3>
            {w.description && <p className="line-clamp-1 text-[11px] text-muted-foreground">{w.description}</p>}
          </div>
          <span className="shrink-0 rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">{stats?.progress ?? 0}%</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${stats?.progress ?? 0}%` }} />
        </div>
        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>📦 {stats?.items_count ?? 0} عنصر</span>
          <span>✅ {stats?.tasks_count ?? 0}</span>
          <span>📝 {stats?.notes_count ?? 0}</span>
          <span>🛒 {stats?.purchases_count ?? 0}</span>
        </div>
      </div>
    </Link>
  );
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateWorkspace();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("primary");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-fab" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">مساحة عمل جديدة</h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-full bg-secondary" aria-label="إغلاق">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم..." className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف قصير (اختياري)" rows={3} className="w-full resize-none rounded-2xl bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
          <div>
            <p className="mb-2 text-[11px] font-bold text-muted-foreground">اللون</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button key={c.key} onClick={() => setColor(c.key)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${c.bg} ${color === c.key ? "ring-2 ring-foreground" : ""}`}>{c.label}</button>
              ))}
            </div>
          </div>
          <button
            disabled={!name.trim() || create.isPending}
            onClick={async () => {
              const w = await create.mutateAsync({ name: name.trim(), description: description.trim() || null, color });
              onClose();
              window.location.assign(`/workspaces/${w.id}`);
            }}
            className="grid w-full place-items-center rounded-2xl gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-fab disabled:opacity-60"
          >
            {create.isPending ? <Loader2 className="size-5 animate-spin" /> : "إنشاء"}
          </button>
        </div>
      </div>
    </div>
  );
}