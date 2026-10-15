import { supabase } from "@/integrations/supabase/client";
import {
  autoBackupDue,
  automaticBackupName,
  nativeBackup,
  type NativeBackupSaveResult,
} from "@/services/native-backup";
import { callUntypedRpc } from "./rpc";
import { createBackupPort } from "./supabase-port";
import { exportBackup } from "./service";

export type AutomaticBackupResult =
  | { state: "unsupported" | "not-configured" | "disabled" | "not-due" | "backend-unavailable" }
  | { state: "saved"; result: NativeBackupSaveResult };

export function assertNoUnsavedDrafts(accountId: string) {
  const prefix = `memoflow.note-draft.v1:${encodeURIComponent(accountId)}:`;
  for (let index = 0; index < localStorage.length; index++) {
    if (localStorage.key(index)?.startsWith(prefix)) {
      throw new Error("توجد مسودات مذكرات غير محفوظة؛ احفظها قبل إنشاء النسخة.");
    }
  }
}

export async function runAutomaticBackup(
  accountId: string,
  options: { force?: boolean } = {},
): Promise<AutomaticBackupResult> {
  if (!nativeBackup.supported()) return { state: "unsupported" };
  const status = await nativeBackup.status(accountId);
  if (!status.configured) return { state: "not-configured" };
  if (!status.enabled) return { state: "disabled" };
  if (!options.force && !autoBackupDue(status.lastBackupAt)) return { state: "not-due" };

  const readiness = await callUntypedRpc(supabase, "memoflow_backup_tables_v1");
  if (
    readiness.error ||
    !Array.isArray(readiness.data) ||
    !readiness.data.includes("vault_settings")
  ) {
    return { state: "backend-unavailable" };
  }

  assertNoUnsavedDrafts(accountId);
  let password = await nativeBackup.password(accountId);
  try {
    const port = createBackupPort(accountId, () => true);
    const contents = await exportBackup(port, accountId, password);
    assertNoUnsavedDrafts(accountId);
    const result = await nativeBackup.save(accountId, contents, automaticBackupName());
    return { state: "saved", result };
  } finally {
    password = "";
  }
}
