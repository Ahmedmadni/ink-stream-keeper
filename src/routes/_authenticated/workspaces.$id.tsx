import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight, Star, Archive, Trash2, Plus, X, ChevronDown, ChevronLeft,
  CheckSquare, NotebookPen, ShoppingCart, Sparkles, Activity, Link as LinkIcon,
  ExternalLink, Loader2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  useWorkspace, useWorkspaceItems, useWorkspaceStats, useUpdateWorkspace, useDeleteWorkspace,
  useLinkItem, useUnlinkItem, useWorkspaceActivity,
  useWorkspaceLinks, useAddLink, useDeleteLink,
  useSmartCollections, useCreateSmartCollection, useDeleteSmartCollection,
  type WorkspaceItem,
} from "@/lib/workspaces";
import { useTasks, useNotes, tsOf } from "@/lib/data";
import { usePurchaseLists } from "@/lib/purchases";
import { formatRelative } from "@/lib/format";
import { ITEM_TYPES, type ItemTypeKey } from "@/lib/item-types";

export const Route = createFileRoute("/_authenticated/workspaces/$id")({
  head: () => ({ meta: [{ title: "MemoFlow — مساحة عمل" }] }),
  component: WorkspaceDetail,
});

function WorkspaceDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { data: ws } = useWorkspace(id);
  const { data: stats } = useWorkspaceStats(id);
  const { data: items = [] } = useWorkspaceItems(id);
  const { data: activity = [] } = useWorkspaceActivity(id);
  const update = useUpdateWorkspace();
  const del = useDeleteWorkspace();

  const [picker, setPicker] = useState<null | ItemTypeKey>(null);
  const [smartOpen, setSmartOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const byType = useMemo(() => {
    const map: Record<string, WorkspaceItem[]> = {};
    for (const it of items) (map[it.item_type] ??= []).push(it);
    return map;
  }, [items]);

  if (!ws) {
    return (
      <AppShell>
        <div className="grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="relative">
        <div className={`h-40 w-full ${toneBg(ws.color)} relative`}>
          {ws.cover_url && <img src={ws.cover_url} alt="" className="size-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          <button onClick={() => router.history.back()} className="absolute end-4 top-4 grid size-10 place-items-center rounded-full bg-card shadow-card" aria-label="رجوع">
            <ArrowRight className="size-5" />
          </button>
          <button
            onClick={() => update.mutate({ id: ws.id, patch: { favorite: !ws.favorite } })}
            className="absolute start-4 top-4 grid size-10 place-items-center rounded-full bg-card shadow-card" aria-label="مفضلة"
          >
            <Star className={`size-5 ${ws.favorite ? "fill-warning text-warning" : ""}`} />
          </button>
        </div>
        <div className="-mt-8 px-5">
          <div className="rounded-2xl bg-card p-4 shadow-card">
            <h1 className="text-xl font-extrabold">{ws.name}</h1>
            {ws.description && <p className="mt-1 text-xs text-muted-foreground">{ws.description}</p>}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary" style={{ width: `${stats?.progress ?? 0}%` }} />
                </div>
              </div>
              <span className="text-xs font-bold text-primary">{stats?.progress ?? 0}%</span>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>{stats?.items_count ?? 0} عنصر</span>
              <span>•</span>
              <span>{stats?.done_tasks ?? 0}/{stats?.total_tasks ?? 0} مهمة منجزة</span>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard cards */}
      <section className="px-5 pt-4">
        <div className="grid grid-cols-3 gap-2">
          <StatTile icon={CheckSquare} value={stats?.tasks_count ?? 0} label="مهام" tone="primary" />
          <StatTile icon={NotebookPen} value={stats?.notes_count ?? 0} label="ملاحظات" tone="warning" />
          <StatTile icon={ShoppingCart} value={stats?.purchases_count ?? 0} label="مشتريات" tone="success" />
        </div>
      </section>

      {/* Sections per type */}
      <SectionBlock
        title="المهام" icon={CheckSquare} type="task" items={byType.task ?? []}
        onAdd={() => setPicker("task")} workspaceId={id}
      />
      <SectionBlock
        title="الملاحظات" icon={NotebookPen} type="note" items={byType.note ?? []}
        onAdd={() => setPicker("note")} workspaceId={id}
      />
      <SectionBlock
        title="قوائم المشتريات" icon={ShoppingCart} type="purchase_list" items={byType.purchase_list ?? []}
        onAdd={() => setPicker("purchase_list")} workspaceId={id}
      />

      {/* Links */}
      <LinksSection workspaceId={id} onOpen={() => setLinkOpen(true)} />

      {/* Smart Collections */}
      <SmartSection workspaceId={id} onOpen={() => setSmartOpen(true)} />

      {/* Timeline */}
      <section className="px-5 pt-6">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
          <Activity className="size-4 text-primary" /> آخر النشاط
        </h2>
        {activity.length === 0 ? (
          <p className="rounded-2xl bg-card p-4 text-center text-xs text-muted-foreground shadow-card">لا يوجد نشاط بعد.</p>
        ) : (
          <ul className="space-y-1.5">
            {activity.map((a) => (
              <li key={a.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-card p-3 text-xs shadow-card">
                <span className="grid size-7 place-items-center rounded-lg bg-primary-soft text-primary">
                  {a.action === "added" ? <Plus className="size-3.5" /> : a.action === "removed" ? <X className="size-3.5" /> : <Activity className="size-3.5" />}
                </span>
                <span className="truncate">
                  {actionLabel(a.action)} {a.item_type ? ITEM_TYPES[a.item_type as ItemTypeKey]?.label ?? a.item_type : ""}
                </span>
                <span className="text-[10px] text-muted-foreground">{formatRelative(tsOf(a.created_at))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Danger zone */}
      <section className="px-5 pb-12 pt-8">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => update.mutate({ id: ws.id, patch: { archived: !ws.archived } })} className="rounded-full bg-card px-3 py-2 text-xs font-bold shadow-card">
            <Archive className="me-1 inline size-3.5" /> {ws.archived ? "إلغاء الأرشفة" : "أرشفة"}
          </button>
          <button
            onClick={() => {
              if (confirm("حذف هذه المساحة؟ الرّوابط ستُحذف لكن العناصر تبقى.")) {
                del.mutate(ws.id, { onSuccess: () => router.navigate({ to: "/workspaces" }) });
              }
            }}
            className="rounded-full bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive"
          >
            <Trash2 className="me-1 inline size-3.5" /> حذف المساحة
          </button>
        </div>
      </section>

      {picker && <ItemPicker workspaceId={id} type={picker} existing={byType[picker]?.map((i) => i.item_id) ?? []} onClose={() => setPicker(null)} />}
      {linkOpen && <AddLinkDialog workspaceId={id} onClose={() => setLinkOpen(false)} />}
      {smartOpen && <SmartDialog workspaceId={id} onClose={() => setSmartOpen(false)} />}
    </AppShell>
  );
}

function actionLabel(a: string) {
  switch (a) {
    case "added": return "أُضيفت";
    case "removed": return "أُزيلت";
    case "completed": return "اكتملت";
    default: return "تحديث";
  }
}

function toneBg(c: string) {
  switch (c) {
    case "success": return "bg-success/30";
    case "warning": return "bg-warning/30";
    case "destructive": return "bg-destructive/30";
    case "accent": return "bg-accent";
    default: return "bg-primary-soft";
  }
}

function StatTile({ icon: Icon, value, label, tone }: { icon: typeof CheckSquare; value: number; label: string; tone: string }) {
  const cls: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
  };
  return (
    <div className={`flex flex-col items-center gap-1 rounded-2xl p-3 shadow-card ${cls[tone] ?? cls.primary}`}>
      <Icon className="size-5" />
      <p className="text-lg font-extrabold">{value}</p>
      <p className="text-[10px] font-medium opacity-80">{label}</p>
    </div>
  );
}

// ---------------- Section per type ----------------
function SectionBlock({
  title, icon: Icon, type, items, onAdd, workspaceId,
}: {
  title: string; icon: typeof CheckSquare; type: ItemTypeKey;
  items: WorkspaceItem[]; onAdd: () => void; workspaceId: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="px-5 pt-6">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-sm font-bold">
          {open ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronLeft className="size-4 text-muted-foreground" />}
          <Icon className="size-4 text-primary" /> {title}
          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{items.length}</span>
        </button>
        <button onClick={onAdd} className="grid size-8 place-items-center rounded-full bg-primary-soft text-primary" aria-label="إضافة">
          <Plus className="size-4" />
        </button>
      </div>
      {open && (
        items.length === 0 ? (
          <p className="rounded-2xl bg-card p-4 text-center text-xs text-muted-foreground shadow-card">لا توجد عناصر مرتبطة. اضغط + لإضافة.</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((it) => <LinkedItemRow key={it.id} item={it} workspaceId={workspaceId} />)}
          </ul>
        )
      )}
    </section>
  );
}

function LinkedItemRow({ item, workspaceId }: { item: WorkspaceItem; workspaceId: string }) {
  const { data: tasks = [] } = useTasks();
  const { data: notes = [] } = useNotes();
  const { data: lists = [] } = usePurchaseLists();
  const unlink = useUnlinkItem();

  const meta = (() => {
    if (item.item_type === "task") {
      const t = tasks.find((x) => x.id === item.item_id);
      return t ? { title: t.title, done: t.done, to: `/tasks/${t.id}` } : null;
    }
    if (item.item_type === "note") {
      const n = notes.find((x) => x.id === item.item_id);
      return n ? { title: n.title || "ملاحظة", done: false, to: `/notes/${n.id}` } : null;
    }
    if (item.item_type === "purchase_list") {
      const l = lists.find((x) => x.id === item.item_id);
      return l ? { title: l.title, done: false, to: `/purchases/${l.id}` } : null;
    }
    return null;
  })();

  if (!meta) {
    return (
      <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-card p-3 text-xs shadow-card opacity-60">
        <span className="truncate">عنصر محذوف</span>
        <button onClick={() => unlink.mutate({ workspaceId, itemType: item.item_type, itemId: item.item_id })} aria-label="إزالة">
          <X className="size-4 text-muted-foreground" />
        </button>
      </li>
    );
  }

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-card p-3 text-sm shadow-card">
      <a href={meta.to} className={`truncate ${meta.done ? "text-muted-foreground line-through" : ""}`}>{meta.title}</a>
      <button onClick={() => unlink.mutate({ workspaceId, itemType: item.item_type, itemId: item.item_id })} className="grid size-7 place-items-center rounded-full hover:bg-secondary" aria-label="إزالة">
        <X className="size-4 text-muted-foreground" />
      </button>
    </li>
  );
}

// ---------------- Item Picker ----------------
function ItemPicker({ workspaceId, type, existing, onClose }: {
  workspaceId: string; type: ItemTypeKey; existing: string[]; onClose: () => void;
}) {
  const link = useLinkItem();
  const { data: tasks = [] } = useTasks();
  const { data: notes = [] } = useNotes();
  const { data: lists = [] } = usePurchaseLists();
  const [q, setQ] = useState("");

  const source = type === "task"
    ? tasks.map((t) => ({ id: t.id, title: t.title }))
    : type === "note"
      ? notes.map((n) => ({ id: n.id, title: n.title || "ملاحظة" }))
      : type === "purchase_list"
        ? lists.map((l) => ({ id: l.id, title: l.title }))
        : [];

  const filtered = source.filter((x) => !existing.includes(x.id) && (q.trim() === "" || x.title.includes(q.trim())));
  const def = ITEM_TYPES[type];
  const newPath = `/items/new/${type}`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/50" onClick={onClose}>
      <div className="max-h-[80dvh] w-full overflow-hidden rounded-t-3xl bg-card p-5 shadow-fab" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">ربط {def?.label}</h3>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-full bg-secondary"><X className="size-4" /></button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث..." className="mt-3 w-full rounded-2xl bg-secondary px-4 py-2.5 text-sm outline-none" />
        {(type === "task" || type === "note" || type === "purchase_list") && (
          <Link to={newPath as "/items/new/$type"} params={{ type }} className="mt-3 grid place-items-center rounded-2xl border-2 border-dashed border-primary py-3 text-xs font-bold text-primary">
            + إنشاء {def?.label} جديد
          </Link>
        )}
        <ul className="mt-3 max-h-[40dvh] space-y-1 overflow-y-auto pb-2">
          {filtered.length === 0 ? (
            <li className="rounded-xl bg-secondary/50 p-3 text-center text-xs text-muted-foreground">لا توجد عناصر متاحة.</li>
          ) : filtered.map((x) => (
            <li key={x.id}>
              <button
                onClick={async () => { await link.mutateAsync({ workspaceId, itemType: type, itemId: x.id }); onClose(); }}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-secondary px-3 py-2.5 text-right text-sm font-semibold transition-colors hover:bg-primary-soft"
              >
                <span className="truncate">{x.title}</span>
                <Plus className="size-4 text-primary" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------- Links ----------------
function LinksSection({ workspaceId, onOpen }: { workspaceId: string; onOpen: () => void }) {
  const { data: links = [] } = useWorkspaceLinks(workspaceId);
  const del = useDeleteLink();
  return (
    <section className="px-5 pt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold"><LinkIcon className="size-4 text-primary" /> الروابط <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{links.length}</span></h2>
        <button onClick={onOpen} className="grid size-8 place-items-center rounded-full bg-primary-soft text-primary"><Plus className="size-4" /></button>
      </div>
      {links.length === 0 ? (
        <p className="rounded-2xl bg-card p-4 text-center text-xs text-muted-foreground shadow-card">لا توجد روابط بعد.</p>
      ) : (
        <ul className="space-y-1.5">
          {links.map((l) => (
            <li key={l.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-card p-3 text-sm shadow-card">
              {l.favicon ? <img src={l.favicon} alt="" className="size-5 rounded" /> : <ExternalLink className="size-4 text-muted-foreground" />}
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate font-semibold text-primary">{l.title}</a>
              <button onClick={() => del.mutate({ id: l.id, workspaceId })} className="grid size-7 place-items-center rounded-full hover:bg-secondary"><X className="size-4 text-muted-foreground" /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddLinkDialog({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const add = useAddLink();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-fab" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">إضافة رابط</h3>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-full bg-secondary"><X className="size-4" /></button>
        </div>
        <div className="mt-3 space-y-2">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="العنوان" className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm outline-none" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm outline-none" dir="ltr" />
          <button
            disabled={!title.trim() || !url.trim() || add.isPending}
            onClick={async () => { await add.mutateAsync({ workspaceId, title: title.trim(), url: url.trim() }); onClose(); }}
            className="grid w-full place-items-center rounded-2xl gradient-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {add.isPending ? <Loader2 className="size-5 animate-spin" /> : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Smart Collections ----------------
function SmartSection({ workspaceId, onOpen }: { workspaceId: string; onOpen: () => void }) {
  const { data: collections = [] } = useSmartCollections(workspaceId);
  const del = useDeleteSmartCollection();
  return (
    <section className="px-5 pt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4 text-accent-foreground" /> مجموعات ذكية</h2>
        <button onClick={onOpen} className="grid size-8 place-items-center rounded-full bg-accent text-accent-foreground"><Plus className="size-4" /></button>
      </div>
      {collections.length === 0 ? (
        <p className="rounded-2xl bg-card p-4 text-center text-xs text-muted-foreground shadow-card">أنشئ مجموعة ذكية بفلتر مخصّص.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {collections.map((c) => (
            <li key={c.id} className="relative rounded-2xl bg-card p-3 shadow-card">
              <p className="text-sm font-bold">{c.name}</p>
              <p className="text-[10px] text-muted-foreground">{ITEM_TYPES[c.item_type]?.label ?? c.item_type}</p>
              <button onClick={() => del.mutate({ id: c.id, workspaceId })} className="absolute end-2 top-2 grid size-6 place-items-center rounded-full hover:bg-secondary"><X className="size-3" /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SmartDialog({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const create = useCreateSmartCollection();
  const [name, setName] = useState("");
  const [itemType, setItemType] = useState<ItemTypeKey>("task");
  const [filter, setFilter] = useState<"open" | "done" | "high_priority" | "this_month">("open");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-fab" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">مجموعة ذكية جديدة</h3>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-full bg-secondary"><X className="size-4" /></button>
        </div>
        <div className="mt-3 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm outline-none" />
          <select value={itemType} onChange={(e) => setItemType(e.target.value as ItemTypeKey)} className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm outline-none">
            <option value="task">مهام</option>
            <option value="note">ملاحظات</option>
            <option value="purchase_list">قوائم مشتريات</option>
          </select>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm outline-none">
            <option value="open">غير المكتملة</option>
            <option value="done">المكتملة</option>
            <option value="high_priority">أولوية عالية</option>
            <option value="this_month">هذا الشهر</option>
          </select>
          <button
            disabled={!name.trim() || create.isPending}
            onClick={async () => {
              await create.mutateAsync({ name: name.trim(), workspace_id: workspaceId, item_type: itemType, filters: { kind: filter } });
              onClose();
            }}
            className="grid w-full place-items-center rounded-2xl gradient-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {create.isPending ? <Loader2 className="size-5 animate-spin" /> : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}