import { GraduationCap, Layers, TrendingUp } from "lucide-react";
import { defineBlock, type BlockComposition } from "@/lib/engine/blocks";
import type { StatEntry } from "@/components/items/StatisticsCard";

export type PlanCtx = {
  plan: { id: string; title: string; description?: string | null };
  stat?: {
    stage_count?: number | null;
    stage_done?: number | null;
    step_count?: number | null;
    step_done?: number | null;
    computed_progress?: number | null;
  } | null;
};

export function buildPlanBlocks(ctx: PlanCtx): BlockComposition<PlanCtx> {
  const { plan, stat } = ctx;
  const s = stat ?? {};
  const entries: StatEntry[] = [
    { key: "stages", label: "مراحل", value: `${s.stage_done ?? 0}/${s.stage_count ?? 0}`, icon: Layers, tone: "primary" },
    { key: "steps", label: "خطوات", value: `${s.step_done ?? 0}/${s.step_count ?? 0}`, icon: GraduationCap, tone: "accent" },
    { key: "prog", label: "التقدم", value: `${Math.round(Number(s.computed_progress ?? 0))}%`, icon: TrendingUp, tone: "success" },
  ];
  return [
    defineBlock({ id: "header", type: "header", priority: 0, layout: { bare: true }, props: { title: plan.title, subtitle: plan.description ?? undefined } as any }),
    defineBlock({ id: "stats", type: "statistics", priority: 10, props: { entries, columns: 3 } }),
    defineBlock({ id: "progress", type: "progress", priority: 20, props: { value: Number(s.computed_progress ?? 0) } }),
    defineBlock({
      id: "rich_text", type: "rich_text", priority: 30,
      visibleWhen: (c) => !!c.plan.description,
      props: { text: plan.description ?? "" },
    }),
  ];
}