import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PlanType =
  | "goal" | "learning" | "project" | "travel" | "maintenance"
  | "roadmap" | "training" | "career" | "business";

export const PLAN_TYPES: { key: PlanType; label: string; description: string; color: string; icon: string }[] = [
  { key: "goal",         label: "هدف",          description: "هدف شخصي بنتيجة قابلة للقياس",  color: "primary",     icon: "Target" },
  { key: "learning",     label: "خطة تعلم",     description: "دورة أو منهج تعليمي",            color: "warning",     icon: "GraduationCap" },
  { key: "project",      label: "مشروع",        description: "مشروع متعدد المراحل",            color: "primary",     icon: "FolderKanban" },
  { key: "travel",       label: "رحلة",         description: "تخطيط لرحلة",                     color: "accent",      icon: "Plane" },
  { key: "maintenance",  label: "صيانة",        description: "خطة صيانة دورية لأصل",            color: "warning",     icon: "Wrench" },
  { key: "roadmap",      label: "خارطة طريق",   description: "Roadmap لمنتج أو مرحلة",          color: "primary",     icon: "Map" },
  { key: "training",     label: "خطة تدريب",    description: "تدريب رياضي/مهني",                color: "destructive", icon: "Dumbbell" },
  { key: "career",       label: "مسار مهني",    description: "تطوير مهني طويل الأمد",           color: "primary",     icon: "Briefcase" },
  { key: "business",     label: "خطة عمل",      description: "Business plan",                   color: "success",     icon: "TrendingUp" },
];

export const planTypeDef = (k: PlanType) => PLAN_TYPES.find((t) => t.key === k) ?? PLAN_TYPES[0];

export type PlanStatus = "planning" | "active" | "on_hold" | "done" | "cancelled";
export type PlanPriority = "low" | "medium" | "high" | "urgent";

export type Plan = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  type: PlanType;
  title: string;
  description: string | null;
  objective: string | null;
  color: string | null;
  icon: string | null;
  priority: PlanPriority;
  status: PlanStatus;
  start_date: string | null;
  end_date: string | null;
  estimated_duration: number | null;
  progress: number;
  budget: number | null;
  currency: string | null;
  notes: string | null;
  tags: string[];
  type_data: Record<string, unknown>;
  ai_meta: Record<string, unknown>;
  is_favorite: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanStage = {
  id: string; plan_id: string; user_id: string;
  name: string; description: string | null;
  position: number;
  start_date: string | null; end_date: string | null;
  status: "pending" | "in_progress" | "done" | "blocked";
  progress: number;
  created_at: string; updated_at: string;
};

export type PlanStep = {
  id: string; stage_id: string; plan_id: string; user_id: string;
  name: string; notes: string | null;
  duration: number | null;
  position: number; done: boolean; done_at: string | null;
  created_at: string; updated_at: string;
};

export type PlanLink = {
  id: string; plan_id: string; user_id: string;
  item_type: string; item_id: string;
  label: string | null; url: string | null;
  position: number; created_at: string;
};

export type PlanStat = {
  plan_id: string; user_id: string;
  stage_count: number; stage_done: number;
  step_count: number;  step_done: number;
  link_count: number;
  computed_progress: number;
};

export const planKeys = {
  all: ["plans"] as const,
  list: (type?: PlanType | null) => ["plans", "list", type ?? "all"] as const,
  one: (id: string) => ["plans", id] as const,
  stages: (planId: string) => ["plans", planId, "stages"] as const,
  steps: (planId: string) => ["plans", planId, "steps"] as const,
  links: (planId: string) => ["plans", planId, "links"] as const,
  stats: ["plan_stats"] as const,
  statsOne: (id: string) => ["plan_stats", id] as const,
};

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("غير مسجل الدخول");
  return data.user.id;
}

// -------------- Plans --------------
export const plansQuery = queryOptions({
  queryKey: planKeys.list(null),
  queryFn: async (): Promise<Plan[]> => {
    const { data, error } = await supabase
      .from("plans").select("*")
      .order("is_favorite", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as Plan[];
  },
});

export function usePlans(type?: PlanType | null) {
  return useQuery({
    queryKey: planKeys.list(type ?? null),
    queryFn: async (): Promise<Plan[]> => {
      let q = supabase.from("plans").select("*")
        .order("is_favorite", { ascending: false })
        .order("updated_at", { ascending: false });
      if (type) q = q.eq("type", type);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Plan[];
    },
  });
}

export function usePlan(id: string) {
  return useQuery({
    queryKey: planKeys.one(id),
    queryFn: async (): Promise<Plan | null> => {
      const { data, error } = await supabase.from("plans").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as unknown as Plan | null) ?? null;
    },
    enabled: !!id,
  });
}

export function usePlanStats() {
  return useQuery({
    queryKey: planKeys.stats,
    queryFn: async (): Promise<PlanStat[]> => {
      const { data, error } = await supabase.from("plan_stats").select("*");
      if (error) throw error;
      return (data ?? []) as unknown as PlanStat[];
    },
  });
}

export function usePlanStat(id: string) {
  return useQuery({
    queryKey: planKeys.statsOne(id),
    queryFn: async (): Promise<PlanStat | null> => {
      const { data, error } = await supabase.from("plan_stats")
        .select("*").eq("plan_id", id).maybeSingle();
      if (error) throw error;
      return (data as unknown as PlanStat | null) ?? null;
    },
    enabled: !!id,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Plan> & { type: PlanType; title: string }): Promise<Plan> => {
      const user_id = await uid();
      const def = planTypeDef(input.type);
      const payload = {
        user_id,
        workspace_id: input.workspace_id ?? null,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        objective: input.objective ?? null,
        color: input.color ?? def.color,
        icon: input.icon ?? def.icon,
        priority: input.priority ?? "medium",
        status: input.status ?? "planning",
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
        estimated_duration: input.estimated_duration ?? null,
        progress: input.progress ?? 0,
        budget: input.budget ?? null,
        currency: input.currency ?? "SAR",
        notes: input.notes ?? null,
        tags: input.tags ?? [],
        type_data: input.type_data ?? {},
      };
      const { data, error } = await supabase.from("plans").insert(payload).select("*").single();
      if (error) throw error;
      return data as unknown as Plan;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.all });
      qc.invalidateQueries({ queryKey: ["workspace_stats"] });
    },
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Plan> }) => {
      const { error } = await supabase.from("plans").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: planKeys.all });
      qc.invalidateQueries({ queryKey: planKeys.one(v.id) });
      qc.invalidateQueries({ queryKey: ["workspace_stats"] });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.all });
      qc.invalidateQueries({ queryKey: ["workspace_stats"] });
    },
  });
}

// -------------- Stages --------------
export function usePlanStages(planId: string) {
  return useQuery({
    queryKey: planKeys.stages(planId),
    queryFn: async (): Promise<PlanStage[]> => {
      const { data, error } = await supabase.from("plan_stages")
        .select("*").eq("plan_id", planId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PlanStage[];
    },
    enabled: !!planId,
  });
}

export function useAddStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, name, position }: { planId: string; name: string; position: number }) => {
      const user_id = await uid();
      const { error } = await supabase.from("plan_stages").insert({
        plan_id: planId, user_id, name, position,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: planKeys.stages(v.planId) });
      qc.invalidateQueries({ queryKey: planKeys.statsOne(v.planId) });
    },
  });
}

export function useUpdateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; planId: string; patch: Partial<PlanStage> }) => {
      const { error } = await supabase.from("plan_stages").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: planKeys.stages(v.planId) });
      qc.invalidateQueries({ queryKey: planKeys.statsOne(v.planId) });
    },
  });
}

export function useDeleteStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; planId: string }) => {
      const { error } = await supabase.from("plan_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: planKeys.stages(v.planId) });
      qc.invalidateQueries({ queryKey: planKeys.steps(v.planId) });
      qc.invalidateQueries({ queryKey: planKeys.statsOne(v.planId) });
    },
  });
}

// -------------- Steps --------------
export function usePlanSteps(planId: string) {
  return useQuery({
    queryKey: planKeys.steps(planId),
    queryFn: async (): Promise<PlanStep[]> => {
      const { data, error } = await supabase.from("plan_steps")
        .select("*").eq("plan_id", planId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PlanStep[];
    },
    enabled: !!planId,
  });
}

export function useAddStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, stageId, name, position }: {
      planId: string; stageId: string; name: string; position: number;
    }) => {
      const user_id = await uid();
      const { error } = await supabase.from("plan_steps").insert({
        plan_id: planId, stage_id: stageId, user_id, name, position,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: planKeys.steps(v.planId) });
      qc.invalidateQueries({ queryKey: planKeys.statsOne(v.planId) });
    },
  });
}

export function useToggleStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; planId: string; done: boolean }) => {
      const { error } = await supabase.from("plan_steps")
        .update({ done, done_at: done ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: planKeys.steps(v.planId) });
      qc.invalidateQueries({ queryKey: planKeys.statsOne(v.planId) });
    },
  });
}

export function useDeleteStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; planId: string }) => {
      const { error } = await supabase.from("plan_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: planKeys.steps(v.planId) });
      qc.invalidateQueries({ queryKey: planKeys.statsOne(v.planId) });
    },
  });
}

// -------------- Links --------------
export function usePlanLinks(planId: string) {
  return useQuery({
    queryKey: planKeys.links(planId),
    queryFn: async (): Promise<PlanLink[]> => {
      const { data, error } = await supabase.from("plan_links")
        .select("*").eq("plan_id", planId).order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PlanLink[];
    },
    enabled: !!planId,
  });
}

export function useAddPlanLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { planId: string; itemType: string; itemId: string; label?: string; url?: string }) => {
      const user_id = await uid();
      const { error } = await supabase.from("plan_links").insert({
        plan_id: input.planId, user_id,
        item_type: input.itemType, item_id: input.itemId,
        label: input.label ?? null, url: input.url ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: planKeys.links(v.planId) });
      qc.invalidateQueries({ queryKey: planKeys.statsOne(v.planId) });
    },
  });
}

export function useDeletePlanLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; planId: string }) => {
      const { error } = await supabase.from("plan_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: planKeys.links(v.planId) });
      qc.invalidateQueries({ queryKey: planKeys.statsOne(v.planId) });
    },
  });
}