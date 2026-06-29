import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DynamicForm } from "@/components/dynamic";
import { getPlanSchema, splitPlanValues } from "@/lib/engine/schemas/plan.schema";
import { useCreatePlan, PLAN_TYPES, type PlanType } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/plans/new/$type")({
  head: () => ({ meta: [{ title: "MemoFlow — خطة جديدة" }] }),
  component: NewPlanPage,
});

function NewPlanPage() {
  const { type } = Route.useParams();
  const router = useRouter();
  const planType = type as PlanType;
  const def = PLAN_TYPES.find((t) => t.key === planType);
  const create = useCreatePlan();

  if (!def) {
    return (
      <AppShell>
        <header className="px-5 pt-6">
          <h1 className="text-xl font-extrabold">نوع غير معروف</h1>
          <p className="mt-1 text-xs text-muted-foreground">اختر نوع خطة صحيح من القائمة.</p>
        </header>
      </AppShell>
    );
  }

  const schema = getPlanSchema(planType) as never;

  return (
    <AppShell>
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-5 pb-2 pt-6">
        <button onClick={() => router.history.back()} className="grid size-10 place-items-center rounded-full bg-card shadow-card" aria-label="رجوع">
          <ArrowRight className="size-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold">{def.label} جديدة</h1>
          <p className="truncate text-xs text-muted-foreground">{def.description}</p>
        </div>
      </header>

      <div className="px-5 pb-24 pt-2">
        <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1">
          {PLAN_TYPES.map((t) => (
            <button key={t.key}
              onClick={() => router.navigate({ to: "/plans/new/$type", params: { type: t.key } })}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${planType === t.key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground shadow-card"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <DynamicForm
          schema={schema}
          submitLabel="إنشاء الخطة"
          onSubmit={async (values) => {
            const { base, type_data } = splitPlanValues(planType, values);
            const plan = await create.mutateAsync({
              type: planType,
              title: String(base.title || "").trim(),
              description: (base.description as string) ?? null,
              objective: (base.objective as string) ?? null,
              priority: (base.priority as never) ?? "medium",
              status: (base.status as never) ?? "planning",
              start_date: (base.start_date as string) ?? null,
              end_date: (base.end_date as string) ?? null,
              estimated_duration: (base.estimated_duration as number) ?? null,
              budget: (base.budget as number) ?? null,
              currency: (base.currency as string) ?? "SAR",
              tags: (base.tags as string[]) ?? [],
              notes: (base.notes as string) ?? null,
              type_data,
            });
            router.navigate({ to: "/plans/$id", params: { id: plan.id } });
          }}
        />
      </div>
    </AppShell>
  );
}