import { supabase } from "@/integrations/supabase/client";
import { callUntypedRpc, type UntypedRpcResult } from "@/features/backup/rpc";

export type TaskChecklistBackendStatus = "ready" | "missing" | "unreachable";

const MISSING_FUNCTION = /PGRST202|42883|could not find the function|does not exist/i;

export function taskChecklistBackendStatus(result: UntypedRpcResult): TaskChecklistBackendStatus {
  if (!result.error) return result.data === false ? "missing" : "ready";
  const error = result.error as UntypedRpcResult["error"] & { code?: string; details?: string };
  const text = [error?.code, error?.message, error?.details].filter(Boolean).join(" ");
  return MISSING_FUNCTION.test(text) ? "missing" : "unreachable";
}

/**
 * A read-only capability probe for the complete task-checklist backend. The
 * function verifies that the parent-completion guard trigger is installed.
 */
export async function checkTaskChecklistBackend(): Promise<TaskChecklistBackendStatus> {
  try {
    const result = await callUntypedRpc(supabase, "memoflow_task_completion_guard_v1");
    return taskChecklistBackendStatus(result);
  } catch {
    return "unreachable";
  }
}
