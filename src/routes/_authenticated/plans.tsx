import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Plus, Star, Target, Calendar, ChevronLeft } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { usePlans, usePlanStats, PLAN_TYPES, type PlanType, useUpdatePlan } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({
    meta: [
      { title: "MemoFlow — الخطط" },
      { name: "description", content: "خطط الأهداف، التعلم، المشاريع، السفر والصيانة في مكان واحد." },
    ],
  }),
  component: PlansListPage,
});

const TONE: Record<string, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  accent: "bg-accent text-accent-foreground",
};

function PlansListPage() {
  const [filter, setFilter] = useState<PlanType | "all">("all");
  const { data: plans = [], isLoading } = usePlans(filter === "all" ? null : filter);
  const { data: stats = [] } = usePlanStats();
  const update = useUpdatePlan();
  const navigate = useNavigate();
  const statByPlan = useMemo(() => Object.fromEntries(stats.map((s) => [s.plan_id, s])), [stats]);

  return (
    <AppShell>
      <PageHeader
        title="الخطط"
        subtitle="نظام تخطيط موحّد لكل أهدافك ومشاريعك"
        action={
          <button
            onClick={() => navigate({ to: "/plans/new/$type", params: { type: "goal" } })}
            className="grid size-10 place-items-center rounded-full gradient-primary text-primary-foreground shadow-fab"
            aria-label="خطة جديدة"
          >
            <Plus className="size-5" />
          </button>
        }
      />

      <div className="px-5 pt-2">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>الكل</Chip>
          {PLAN_TYPES.map((t) => (
            <Chip key={t.key} active={filter === t.key} onClick={() => setFilter(t.key)}>{t.label}</Chip>
          ))}
        </div>
      </div>

      <div className="px-5 pt-2">
        {isLoading ? (
          <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : plans.length === 0 ? (
          <EmptyState onCreate={() => navigate({ to: "/plans/new/$type", params: { type: "goal" } })} />
        ) : (
          <div className="space-y-3">
            {plans.map((p) => {
              const def = PLAN_TYPES.find((t) => t.key === p.type) ?? PLAN_TYPES[0];
              const s = statByPlan[p.id];
              const progress = s?.computed_progress ?? p.progress;
              return (
                <Link
                  key={p.id} to="/plans/$id" params={{ id: p.id }}
                  className="block overflow-hidden rounded-2xl bg-card shadow-card transition-transform active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3 p-4">
                    <div className={`grid size-11 shrink-0 place-items-center rounded-xl ${TONE[def.color] ?? TONE.primary}`}>
                      <Target className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="truncate text-sm font-bold">{p.title}</h3>
                        <button
                          onClick={(e) => { e.preventDefault(); update.mutate({ id: p.id, patch: { is_favorite: !p.is_favorite } }); }}
                          className="grid size-7 place-items-center rounded-full bg-secondary/60"
                          aria-label="مفضلة"
                        >
                          <Star className={`size-4 ${p.is_favorite ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                        </button>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded-md bg-secondary px-1.5 py-0.5 font-bold">{def.label}</span>
                        {p.end_date && (
                          <span className="inline-flex items-center gap-1"><Calendar className="size-3" />
                            {new Date(p.end_date).toLocaleDateString("ar-EG")}
                          </span>
                        )}
                      </div>
                      {p.objective && <p className="mt-2 line-clamp-2 text-[12px] text-muted-foreground">{p.objective}</p>}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                          <span>{s?.stage_done ?? 0}/{s?.stage_count ?? 0} مرحلة · {s?.step_done ?? 0}/{s?.step_count ?? 0} خطوة</span>
                          <span className="text-primary">{progress}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </div>
                    <ChevronLeft className="mt-2 size-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground shadow-card"}`}>
      {children}
    </button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl bg-card p-8 text-center shadow-card">
      <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
        <Target className="size-7" />
      </div>
      <p className="text-sm font-bold">لا توجد خطط بعد</p>
      <p className="mt-1 text-xs text-muted-foreground">ابدأ بإنشاء خطة لتنظيم رحلتك نحو الهدف.</p>
      <button onClick={onCreate} className="mx-auto mt-4 rounded-2xl gradient-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-fab">
        إنشاء خطة
      </button>
    </div>
  );
}