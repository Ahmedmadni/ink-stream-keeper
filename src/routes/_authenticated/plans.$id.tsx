import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  usePlan, usePlanStat, usePlanStages, usePlanSteps, usePlanLinks,
  useUpdatePlan,
  useAddStage, useUpdateStage, useDeleteStage,
  useAddStep, useToggleStep, useDeleteStep,
  useAddPlanLink, useDeletePlanLink,
  type PlanStage,
} from "@/lib/plans";
import { useTasks, useNotes } from "@/lib/data";
import { usePurchaseLists } from "@/lib/purchases";
import { DynamicChecklist } from "@/components/dynamic";
import { BlockProvider, BlockRenderer, Toolbar } from "@/components/blocks";
import { useItemActions } from "@/lib/engine/actions";
import { buildPlanBlocks } from "@/lib/engine/compositions";

export const Route = createFileRoute("/_authenticated/plans/$id")({
  head: () => ({ meta: [{ title: "MemoFlow — تفاصيل الخطة" }] }),
  component: PlanDetailPage,
});

function PlanDetailPage() {
  const { id } = Route.useParams();
  const { data: plan, isLoading } = usePlan(id);
  const { data: stat } = usePlanStat(id);
  const { data: stages = [] } = usePlanStages(id);
  const { data: steps = [] } = usePlanSteps(id);
  const { data: links = [] } = usePlanLinks(id);
  const update = useUpdatePlan();
  const addStage = useAddStage();
  const addLink = useAddPlanLink();
  const removeLink = useDeletePlanLink();
  const actions = useItemActions("plan", id);

  const [picker, setPicker] = useState<null | "task" | "note" | "purchase_list">(null);

  const stepsByStage = useMemo(() => {
    const m: Record<string, typeof steps> = {};
    for (const s of steps) (m[s.stage_id] ??= []).push(s);
    return m;
  }, [steps]);

  if (isLoading) {
    return <AppShell><div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div></AppShell>;
  }
  if (!plan) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-muted-foreground">
          خطة غير موجودة.
          <div className="mt-4"><Link to="/plans" className="text-primary font-semibold">العودة للقائمة</Link></div>
        </div>
      </AppShell>
    );
  }

  const ctx = { plan, stat: (stat as any) ?? null } as any;
  const mutations = {
    updatePlan: (patch: Record<string, unknown>) => update.mutate({ id: plan.id, patch: patch as any }),
  };
  const blocks = buildPlanBlocks(ctx, {
    mutations,
    stagesSlot: () => (
      <div className="space-y-3">
        <div className="flex justify-end">
          <AddStageButton planId={plan.id} nextPos={stages.length} addStage={addStage} />
        </div>
        {stages.length === 0 ? (
          <p className="text-xs text-muted-foreground">ابدأ بإضافة المرحلة الأولى من خطتك.</p>
        ) : (
          <div className="space-y-2">
            {stages.map((s) => (
              <StageCard key={s.id} stage={s} steps={stepsByStage[s.id] ?? []} />
            ))}
          </div>
        )}
      </div>
    ),
    linksSlot: () => (
      <div className="space-y-3">
        <div className="flex justify-end gap-1">
          <SmallBtn onClick={() => setPicker("task")}>مهمة</SmallBtn>
          <SmallBtn onClick={() => setPicker("note")}>ملاحظة</SmallBtn>
          <SmallBtn onClick={() => setPicker("purchase_list")}>مشتريات</SmallBtn>
        </div>
        {links.length === 0 ? (
          <p className="text-xs text-muted-foreground">اربط مهام أو ملاحظات أو قوائم مشتريات قائمة بالفعل دون نسخها.</p>
        ) : (
          <ul className="space-y-1.5">
            {links.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{l.label || `${l.item_type} #${l.item_id.slice(0, 6)}`}</p>
                  <p className="text-[11px] text-muted-foreground">{l.item_type}</p>
                </div>
                <button onClick={() => removeLink.mutate({ id: l.id, planId: plan.id })} className="grid size-7 place-items-center rounded-full hover:bg-secondary" aria-label="إزالة">
                  <Trash2 className="size-3.5 text-destructive" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {picker && <LinkPicker type={picker} onClose={() => setPicker(null)} onPick={(label, itemId) => {
          addLink.mutate({ planId: plan.id, itemType: picker, itemId, label });
          setPicker(null);
        }} />}
      </div>
    ),
    aiSlot: () => (
      <p className="text-xs text-muted-foreground">سيتم لاحقًا تفعيل: تلخيص الخطة، اقتراح المراحل والخطوات، تقدير المدة وبناء جدول زمني.</p>
    ),
  });

  return (
    <AppShell>
      <BlockProvider value={{ kind: "plan", id, item: plan, permissions: ["edit"], readonly: false, deviceType: "desktop" }}>
        <Toolbar
          actions={actions}
          title={plan.title}
          isFavorite={!!plan.is_favorite}
          isArchived={!!plan.archived_at}
        />
        <div className="space-y-4 px-4 py-5">
          <BlockRenderer blocks={blocks} context={ctx} />
        </div>
      </BlockProvider>
    </AppShell>
  );
}

function SmallBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:bg-primary-soft hover:text-primary">+ {children}</button>
  );
}

function AddStageButton({ planId, nextPos, addStage }: { planId: string; nextPos: number; addStage: ReturnType<typeof useAddStage> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  if (!open) {
    return <button onClick={() => setOpen(true)} className="grid size-8 place-items-center rounded-full gradient-primary text-primary-foreground shadow-fab"><Plus className="size-4" /></button>;
  }
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; await addStage.mutateAsync({ planId, name: name.trim(), position: nextPos }); setName(""); setOpen(false); }}
      className="flex items-center gap-1">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المرحلة..." className="w-32 rounded-full bg-secondary px-3 py-1.5 text-xs outline-none" />
      <button type="submit" className="grid size-7 place-items-center rounded-full gradient-primary text-primary-foreground"><Plus className="size-3.5" /></button>
    </form>
  );
}

function StageCard({ stage, steps }: { stage: PlanStage; steps: { id: string; name: string; done: boolean }[] }) {
  const upd = useUpdateStage();
  const del = useDeleteStage();
  const addStep = useAddStep();
  const toggleStep = useToggleStep();
  const delStep = useDeleteStep();
  const [open, setOpen] = useState(true);

  const done = steps.filter((s) => s.done).length;
  const pct = steps.length === 0 ? stage.progress : Math.round((done / steps.length) * 100);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-xl border border-border/60">
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between gap-2 bg-secondary/40 px-3 py-2 text-right">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{stage.name}</p>
            <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
              <span>{done}/{steps.length} خطوة</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-background">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-primary">{pct}%</span>
            </div>
          </div>
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 p-3">
        <div className="grid grid-cols-3 gap-1">
          {(["pending", "in_progress", "done"] as const).map((st) => (
            <button key={st} onClick={() => upd.mutate({ id: stage.id, planId: stage.plan_id, patch: { status: st } })}
              className={`rounded-md px-1 py-1 text-[10px] font-bold ${stage.status === st ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              {st === "pending" ? "قيد الانتظار" : st === "in_progress" ? "جارية" : "منتهية"}
            </button>
          ))}
        </div>

        <DynamicChecklist
          title="الخطوات"
          items={steps.map((s) => ({ id: s.id, text: s.name, done: s.done }))}
          onAdd={(text) => addStep.mutateAsync({ planId: stage.plan_id, stageId: stage.id, name: text, position: steps.length })}
          onToggle={(id, next) => toggleStep.mutateAsync({ id, planId: stage.plan_id, done: next })}
          onDelete={(id) => delStep.mutateAsync({ id, planId: stage.plan_id })}
        />

        <div className="flex justify-end">
          <button onClick={() => { if (confirm("حذف هذه المرحلة وكل خطواتها؟")) del.mutate({ id: stage.id, planId: stage.plan_id }); }}
            className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-bold text-destructive">
            <Trash2 className="size-3" /> حذف المرحلة
          </button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function LinkPicker({ type, onClose, onPick }: {
  type: "task" | "note" | "purchase_list";
  onClose: () => void; onPick: (label: string, itemId: string) => void;
}) {
  const tasks = useTasks();
  const notes = useNotes();
  const pls = usePurchaseLists();
  const source = type === "task" ? (tasks.data ?? []).map((t) => ({ id: t.id, label: t.title }))
    : type === "note" ? (notes.data ?? []).map((n) => ({ id: n.id, label: n.title || "ملاحظة" }))
    : (pls.data ?? []).map((p) => ({ id: p.id, label: p.title }));
  const [q, setQ] = useState("");
  const filtered = source.filter((x) => x.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 sm:place-items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-background p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-extrabold">اختر عنصراً للربط</h3>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث..." className="mt-3 w-full rounded-2xl bg-card px-4 py-3 text-sm outline-none shadow-card" />
        <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {filtered.length === 0 && <li className="px-2 py-6 text-center text-xs text-muted-foreground">لا توجد عناصر</li>}
          {filtered.map((x) => (
            <li key={x.id}>
              <button onClick={() => onPick(x.label, x.id)} className="block w-full truncate rounded-xl bg-card px-3 py-2 text-right text-sm font-bold shadow-card hover:bg-primary-soft">
                {x.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// keep router import used in future navigation
void useRouter;
