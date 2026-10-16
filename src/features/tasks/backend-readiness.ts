import { supabase } from "@/integrations/supabase/client";
import { callUntypedRpc, type UntypedRpcResult } from "@/features/backup/rpc";

export type TaskChecklistBackendStatus = "ready" | "missing" | "unreachable";

const MISSING_FUNCTION = /PGRST202|42883|could not find the function|does not exist/i;

export function taskChecklistBackendStatus(result: UntypedRpcResult): TaskChecklistBackendStatus {
  if (!result.error) return "ready";
  const error = result.error as UntypedRpcResult["error"] & { code?: string; details?: string };
  const text = [error?.code, error?.message, error?.details].filter(Boolean).join(" ");
  return MISSING_FUNCTION.test(text) ? "missing" : "unreachable";
}

/**
 * A read-only capability probe for the task checklist migration. Calling the
 * immutable recurrence helper with `none` does not update any user data.
 */
export async function checkTaskChecklistBackend(): Promise<TaskChecklistBackendStatus> {
  try {
    const result = await callUntypedRpc(supabase, "memoflow_next_task_time", {
      value: "2026-01-01T00:00:00.000Z",
      recurrence: "none",
    });
    return taskChecklistBackendStatus(result);
  } catch {
    return "unreachable";
  }
}
