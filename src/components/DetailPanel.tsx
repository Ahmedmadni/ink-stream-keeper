import { Link } from "@tanstack/react-router";
import { ExternalLink, X, FileText, CheckSquare, ShoppingBag, Target, LayoutGrid } from "lucide-react";
import { usePanel, type PanelKind } from "@/hooks/use-panel";
import { useNote, useTask, useChecklist, useSubtasks } from "@/lib/data";
import { usePurchaseList, usePurchaseStats } from "@/lib/purchases";
import { usePlan, usePlanStat } from "@/lib/plans";
import { useWorkspace, useWorkspaceStats } from "@/lib/workspaces";
import { LoadingState, EmptyState, SectionCard } from "@/components/feedback";
import { PageFade } from "@/components/motion";
import { BlockRenderer } from "@/components/blocks";
import { buildTaskBlocks, buildPurchaseBlocks, buildPlanBlocks } from "@/lib/engine/compositions";

const kindMeta: Record<PanelKind, { label: string; icon: typeof FileText; to: string }> = {
  notes: { label: "ملاحظة", icon: FileText, to: "/notes/$id" },
  tasks: { label: "مهمة", icon: CheckSquare, to: "/tasks/$id" },
  purchases: { label: "قائمة مشتريات", icon: ShoppingBag, to: "/purchases/$id" },
  plans: { label: "خطة", icon: Target, to: "/plans/$id" },
  workspaces: { label: "مساحة عمل", icon: LayoutGrid, to: "/workspaces/$id" },
};

export function DetailPanel() {
  const { selection, clear } = usePanel();

  if (!selection) {
    return (
      <EmptyState
        title="اختر عنصراً لعرض تفاصيله"
        description="اضغط على أي بطاقة من القائمة الوسطى لتظهر تفاصيلها هنا دون إعادة تحميل."
      />
    );
  }

  const meta = kindMeta[selection.kind];
  const Icon = meta.icon;

  return (
    <PageFade key={`${selection.kind}:${selection.id}`} className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate text-xs font-bold text-muted-foreground">{meta.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            to={meta.to}
            params={{ id: selection.id }}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="فتح الصفحة كاملة"
          >
            <ExternalLink className="size-4" />
          </Link>
          <button
            type="button"
            onClick={clear}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="إغلاق"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-5">
        {selection.kind === "notes" && <NotePreview id={selection.id} />}
        {selection.kind === "tasks" && <TaskPreview id={selection.id} />}
        {selection.kind === "purchases" && <PurchasePreview id={selection.id} />}
        {selection.kind === "plans" && <PlanPreview id={selection.id} />}
        {selection.kind === "workspaces" && <WorkspacePreview id={selection.id} />}
      </div>
    </PageFade>
  );
}

function NotFound({ label }: { label: string }) {
  return <p className="text-center text-sm text-muted-foreground">لم يتم العثور على {label}.</p>;
}

function NotePreview({ id }: { id: string }) {
  const { data, isLoading } = useNote(id);
  if (isLoading) return <LoadingState />;
  if (!data) return <NotFound label="الملاحظة" />;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-extrabold leading-snug">
        {data.emoji && <span className="me-2">{data.emoji}</span>}
        {data.title || "بدون عنوان"}
      </h2>
      <div
        className="prose-mf rounded-2xl bg-card p-4 text-sm shadow-card"
        dir="rtl"
        dangerouslySetInnerHTML={{ __html: renderPreview(data.content) }}
      />
    </div>
  );
}

function TaskPreview({ id }: { id: string }) {
  const { data, isLoading } = useTask(id);
  const { data: checklist = [] } = useChecklist(id);
  const { data: subs = [] } = useSubtasks(id);
  if (isLoading) return <LoadingState />;
  if (!data) return <NotFound label="المهمة" />;
  const ctx = { task: data, checklist: checklist as any, subtasks: subs as any };
  return <BlockRenderer blocks={buildTaskBlocks(ctx)} context={ctx} />;
}

function PurchasePreview({ id }: { id: string }) {
  const { data, isLoading } = usePurchaseList(id);
  const { data: stats } = usePurchaseStats(id);
  if (isLoading) return <LoadingState />;
  if (!data) return <NotFound label="القائمة" />;
  const ctx = { list: data, stats: stats ?? null };
  return <BlockRenderer blocks={buildPurchaseBlocks(ctx)} context={ctx} />;
}

function PlanPreview({ id }: { id: string }) {
  const { data, isLoading } = usePlan(id);
  const { data: stat } = usePlanStat(id);
  if (isLoading) return <LoadingState />;
  if (!data) return <NotFound label="الخطة" />;
  const ctx = { plan: data, stat: stat ?? null };
  return <BlockRenderer blocks={buildPlanBlocks(ctx)} context={ctx} />;
}

function WorkspacePreview({ id }: { id: string }) {
  const { data, isLoading } = useWorkspace(id);
  const { data: stats } = useWorkspaceStats(id);
  if (isLoading) return <LoadingState />;
  if (!data) return <NotFound label="مساحة العمل" />;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-extrabold leading-snug">
        {data.icon && <span className="me-2">{data.icon}</span>}
        {data.name}
      </h2>
      {data.description && <p className="text-sm text-muted-foreground">{data.description}</p>}
      {stats && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <Stat label="عناصر" value={String(stats.items_count ?? 0)} />
          <Stat label="مهام" value={String(stats.tasks_count ?? 0)} />
          <Stat label="ملاحظات" value={String(stats.notes_count ?? 0)} />
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-primary-soft px-2.5 py-1 font-semibold text-primary">{children}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-2 shadow-card">
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold">{value}</p>
    </div>
  );
}

function renderPreview(value: string): string {
  if (!value) return "<p class='text-muted-foreground'>لا يوجد محتوى بعد.</p>";
  const trimmed = value.trim();
  if (trimmed.startsWith("<")) return value;
  return trimmed.split(/\n+/).map((l) => `<p>${escape(l)}</p>`).join("");
}
function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}