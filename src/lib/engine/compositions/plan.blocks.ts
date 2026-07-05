import { createElement, type ReactNode } from "react";
import { GraduationCap, Layers, LinkIcon, Sparkles, TrendingUp } from "lucide-react";
import { defineBlock, type BlockComposition } from "@/lib/engine/blocks";
import type { StatEntry } from "@/components/items/StatisticsCard";

export type PlanCtx = {
  plan: {
    id: string;
    title: string;
    description?: string | null;
    objective?: string | null;
    priority?: string | null;
    status?: string | null;
    is_favorite?: boolean | null;
    archived_at?: string | null;
  };
  stat?: {
    stage_count?: number | null;
    stage_done?: number | null;
    step_count?: number | null;
    step_done?: number | null;
    link_count?: number | null;
    computed_progress?: number | null;
  } | null;
};

export type PlanMutations = {
  updatePlan: (patch: Record<string, unknown>) => void;
};

export type PlanBuildOpts = {
  mutations?: PlanMutations;
  readonly?: boolean;
  stagesSlot?: () => ReactNode;
  linksSlot?: () => ReactNode;
  aiSlot?: () => ReactNode;
};

export function buildPlanBlocks(ctx: PlanCtx, opts: PlanBuildOpts = {}): BlockComposition<PlanCtx> {
  const { plan, stat } = ctx;
  const s = stat ?? {};
  const readonly = opts.readonly ?? !opts.mutations;
  const entries: StatEntry[] = [
    { key: "stages", label: "مراحل", value: `${s.stage_done ?? 0}/${s.stage_count ?? 0}`, icon: Layers, tone: "primary" },
    { key: "steps", label: "خطوات", value: `${s.step_done ?? 0}/${s.step_count ?? 0}`, icon: GraduationCap, tone: "accent" },
    { key: "prog", label: "التقدم", value: `${Math.round(Number(s.computed_progress ?? 0))}%`, icon: TrendingUp, tone: "success" },
  ];

  const blocks: BlockComposition<PlanCtx> = [
    defineBlock({ id: "header", type: "header", priority: 0, layout: { bare: true }, props: { title: plan.title, subtitle: plan.objective ?? plan.description ?? undefined } as any }),
    defineBlock({ id: "stats", type: "statistics", priority: 10, props: { entries, columns: 3 } }),
    defineBlock({ id: "progress", type: "progress", priority: 20, props: { value: Number(s.computed_progress ?? 0) } }),
    defineBlock({
      id: "objective", type: "rich_text", priority: 30, title: "الهدف",
      props: {
        text: plan.objective ?? "",
        placeholder: "ما الهدف من هذه الخطة؟",
        onSave: readonly ? undefined : (v: string) => opts.mutations?.updatePlan({ objective: v }),
      },
    }),
    defineBlock({
      id: "description", type: "rich_text", priority: 35, title: "الوصف",
      props: {
        text: plan.description ?? "",
        placeholder: "أضف تفاصيل...",
        onSave: readonly ? undefined : (v: string) => opts.mutations?.updatePlan({ description: v }),
      },
    }),
  ];

  if (opts.stagesSlot) {
    blocks.push(defineBlock({
      id: "stages", type: "custom", priority: 40, title: "المراحل", layout: { span: 4 },
      props: { render: () => createElement("div", null, opts.stagesSlot!()) } as any,
    }));
  }
  if (opts.linksSlot) {
    blocks.push(defineBlock({
      id: "plan_links", type: "custom", priority: 50, title: "عناصر مرتبطة", layout: { span: 4 },
      props: { render: () => createElement("div", null, opts.linksSlot!()) } as any,
    }));
  }
  if (opts.aiSlot) {
    blocks.push(defineBlock({
      id: "plan_ai", type: "custom", priority: 60, title: "مساعد الذكاء الاصطناعي", layout: { span: 4 },
      props: { render: () => createElement("div", null, opts.aiSlot!()) } as any,
    }));
  }

  // Reference icons to keep tree-shaker quiet
  void LinkIcon; void Sparkles;
  return blocks;
}
