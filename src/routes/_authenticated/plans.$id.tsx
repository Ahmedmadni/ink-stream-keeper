import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight, Loader2, Plus, Trash2, Calendar, Target, Layers, ListChecks,
  LinkIcon, Sparkles, MoreVertical, ChevronDown,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  usePlan, usePlanStat, usePlanStages, usePlanSteps, usePlanLinks,
  useUpdatePlan, useDeletePlan,
  useAddStage, useUpdateStage, useDeleteStage,
  useAddStep, useToggleStep, useDeleteStep,
  useAddPlanLink, useDeletePlanLink,
  PLAN_TYPES, type PlanStage,
} from "@/lib/plans";
import { useTasks, useNotes } from "@/lib/data";
import { usePurchaseLists } from "@/lib/purchases";
import { DynamicChecklist } from "@/components/dynamic";
import { formatCurrency } from "@/lib/item-types";

export const Route = createFileRoute("/_authenticated/plans/$id")({
  head: () => ({ meta: [{ title: "MemoFlow — تفاصيل الخطة" }] }),
  component: PlanDetailPage,
});

const TONE: Record<string, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  accent: "bg-accent text-accent-foreground",
};

function PlanDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { data: plan, isLoading } = usePlan(id);
  const { data: stat } = usePlanStat(id);
  const { data: stages = [] } = usePlanStages(id);
  const { data: steps = [] } = usePlanSteps(id);
  const { data: links = [] } = usePlanLinks(id);
  const update = useUpdatePlan();
  const remove = useDeletePlan();
  const addStage = useAddStage();
  const addLink = useAddPlanLink();
  const removeLink = useDeletePlanLink();

  const [menuOpen, setMenuOpen] = useState(false);
  const [picker, setPicker] = useState<null | "task" | "note" | "purchase_list">(null);

  if (isLoading) {
    return <AppShell><div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div></AppShell>;
  }
  if (!plan) {
    return (
      <AppShell>
        <header className="px-5 pt-6">
          <h1 className="text-xl font-extrabold">خطة غير موجودة</h1>
          <Link to="/plans" className="mt-2 inline-block rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">العودة للقائمة</Link>
        </header>
      </AppShell>
    );
  }

  const def = PLAN_TYPES.find((t) => t.key === plan.type) ?? PLAN_TYPES[0];
  const progress = stat?.computed_progress ?? plan.progress;
  const stepsByStage = useMemo(() => {
    const m: Record<string, typeof steps> = {};
    for (const s of steps) (m[s.stage_id] ??= []).push(s);
    return m;
  }, [steps]);

  return (
    <AppShell>
      {/* Header */}
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 pb-2 pt-6">
        <button onClick={() => router.history.back()} className="grid size-10 place-items-center rounded-full bg-card shadow-card" aria-label="رجوع">
          <ArrowRight className="size-5" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${TONE[def.color] ?? TONE.primary}`}>{def.label}</span>
            <span className="truncate text-[11px] text-muted-foreground">{plan.status}</span>
          </div>
          <h1 className="truncate text-xl font-extrabold">{plan.title}</h1>
        </div>
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="grid size-10 place-items-center rounded-full bg-card shadow-card" aria-label="قائمة"><MoreVertical className="size-5" /></button>
          {menuOpen && (
            <div className="absolute end-0 z-30 mt-1 w-40 overflow-hidden rounded-2xl bg-card shadow-fab">
              <button onClick={() => { update.mutate({ id: plan.id, patch: { is_favorite: !plan.is_favorite } }); setMenuOpen(false); }}
                className="block w-full px-3 py-2 text-right text-xs font-bold hover:bg-secondary">
                {plan.is_favorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
              </button>
              <button onClick={async () => { if (confirm("حذف الخطة؟")) { await remove.mutateAsync(plan.id); router.navigate({ to: "/plans" }); } }}
                className="block w-full px-3 py-2 text-right text-xs font-bold text-destructive hover:bg-destructive/10">
                حذف الخطة
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-4 px-5 pt-3">
        {/* Hero / KPIs */}
        <section className="rounded-2xl bg-card p-4 shadow-card">
          {plan.objective && <p className="text-sm font-semibold leading-relaxed">{plan.objective}</p>}
          {plan.description && <p className="mt-2 text-xs text-muted-foreground">{plan.description}</p>}

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
              {plan.start_date && <span>{new Date(plan.start_date).toLocaleDateString("ar-EG")}</span>}
              {plan.end_date && <><span>—</span><span>{new Date(plan.end_date).toLocaleDateString("ar-EG")}</span></>}
            </div>
            <span className="text-xs font-extrabold text-primary">{progress}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <Kpi icon={Layers} label="مراحل" value={`${stat?.stage_done ?? 0}/${stat?.stage_count ?? 0}`} tone="primary" />
            <Kpi icon={ListChecks} label="خطوات" value={`${stat?.step_done ?? 0}/${stat?.step_count ?? 0}`} tone="success" />
            <Kpi icon={LinkIcon} label="ارتباطات" value={stat?.link_count ?? 0} tone="accent" />
            <Kpi icon={Target} label="الأولوية" value={priorityLabel(plan.priority)} tone="warning" />
          </div>

          {(plan.budget || Object.keys(plan.type_data || {}).length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {plan.budget != null && (
                <span className="rounded-md bg-success/15 px-2 py-1 font-bold text-success">
                  💰 {formatCurrency(Number(plan.budget), plan.currency ?? "SAR")}
                </span>
              )}
              {Object.entries(plan.type_data || {}).slice(0, 6).map(([k, v]) => (
                <span key={k} className="rounded-md bg-secondary px-2 py-1 font-bold text-muted-foreground">
                  {k}: {String(v)}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Stages + steps */}
        <Section title="المراحل" icon={Layers}
          action={<AddStageButton planId={plan.id} nextPos={stages.length} addStage={addStage} />}>
          {stages.length === 0 ? (
            <p className="text-xs text-muted-foreground">ابدأ بإضافة المرحلة الأولى من خطتك.</p>
          ) : (
            <div className="space-y-2">
              {stages.map((s) => (
                <StageCard key={s.id} stage={s} steps={stepsByStage[s.id] ?? []} />
              ))}
            </div>
          )}
        </Section>

        {/* Linked items */}
        <Section title="عناصر مرتبطة" icon={LinkIcon}
          action={
            <div className="flex gap-1">
              <SmallBtn onClick={() => setPicker("task")}>مهمة</SmallBtn>
              <SmallBtn onClick={() => setPicker("note")}>ملاحظة</SmallBtn>
              <SmallBtn onClick={() => setPicker("purchase_list")}>مشتريات</SmallBtn>
            </div>
          }>
          {links.length === 0 ? (
            <p className="text-xs text-muted-foreground">اربط مهام أو ملاحظات أو قوائم مشتريات قائمة بالفعل دون نسخها.</p>
          ) : (
            <ul className="space-y-1.5">
              {links.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 rounded-xl bg-card p-3 shadow-card">
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
        </Section>

        {/* AI placeholder */}
        <Section title="مساعد الذكاء الاصطناعي" icon={Sparkles}>
          <p className="text-xs text-muted-foreground">سيتم لاحقًا تفعيل: تلخيص الخطة، اقتراح المراحل والخطوات، تقدير المدة وبناء جدول زمني — البيانات جاهزة في الخطة (objective, type_data, ai_meta).</p>
        </Section>
      </div>

      {picker && <LinkPicker planId={plan.id} type={picker} onClose={() => setPicker(null)} onPick={(label, itemId) => {
        addLink.mutate({ planId: plan.id, itemType: picker, itemId, label });
        setPicker(null);
      }} />}
    </AppShell>
  );
}

function priorityLabel(p: string) {
  return { low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة" }[p] ?? p;
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Layers; label: string; value: React.ReactNode; tone: keyof typeof TONE }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-2 text-center">
      <div className={`mx-auto grid size-7 place-items-center rounded-lg ${TONE[tone]}`}><Icon className="size-3.5" /></div>
      <p className="mt-1 text-[10px] font-bold text-muted-foreground">{label}</p>
      <p className="text-xs font-extrabold">{value}</p>
    </div>
  );
}

function Section({ title, icon: Icon, action, children }: { title: string; icon: typeof Layers; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-card">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="size-4" /></div>
          <h3 className="text-sm font-bold">{title}</h3>
        </div>
        {action}
      </header>
      {children}
    </section>
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

function LinkPicker({ planId, type, onClose, onPick }: {
  planId: string; type: "task" | "note" | "purchase_list";
  onClose: () => void; onPick: (label: string, itemId: string) => void;
}) {
  const tasks = useTasks();
  const notes = useNotes();
  const pls = usePurchaseLists();
  const source = type === "task" ? (tasks.data ?? []).map((t) => ({ id: t.id, label: t.title }))
    : type === "note" ? (notes.data ?? []).map((n) => ({ id: n.id, label: n.title || "ملاحظة" }))
    : (pls.data ?? []).map((p) => ({ id: p.id, label: p.title }));
  void planId;
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

/* unused import shim */
export const _unused = Calendar;