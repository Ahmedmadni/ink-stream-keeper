import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { BackupPort } from "./service";
import { MAX_ATTACHMENT_BYTES } from "./format";
import { callUntypedRpc } from "./rpc";

export function backupError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "";
  if (/MF_VAULT_KEY_CONFLICT/.test(message))
    return "إعداد تشفير الخزنة الحالية مختلف عن النسخة. توقفت الاستعادة لحماية كلمات المرور.";
  if (/MF_ACCOUNT_CHANGED|MF_AUTH_REQUIRED/.test(message))
    return "تغير الحساب أو انتهت الجلسة. سجّل الدخول مجددًا.";
  if (/MF_TOO_LARGE/.test(message)) return "حجم البيانات يتجاوز الحد المدعوم لهذه النسخة.";
  if (/MF_|constraint|permission|row-level|duplicate key/i.test(message))
    return "تعذر استعادة البيانات بسبب تعارض أو علاقة غير صالحة. لم تتغير سجلاتك الحالية.";
  if (/PGRST202|Could not find the function|does not exist/i.test(message))
    return "ميزة النسخ الاحتياطي تحتاج تفعيل تحديث قاعدة البيانات أولًا.";
  if (/^[\u0600-\u06ff]/.test(message)) return message;
  return "تعذرت العملية. تحقق من الاتصال وصلاحية الملف ثم حاول مجددًا. إعادة الاستعادة لا تكرر العناصر.";
}
export function createBackupPort(accountId: string, stillActive: () => boolean): BackupPort {
  const assertAccount = async () => {
    if (!stillActive()) throw new Error("تغير الحساب أو أُغلقت الشاشة.");
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== accountId || !stillActive())
      throw new Error("تغير الحساب أو انتهت الجلسة.");
  };
  return {
    assertAccount,
    async snapshot() {
      const { data, error } = await callUntypedRpc(supabase, "memoflow_export_v1");
      if (error) throw error;
      return data as unknown as Awaited<ReturnType<BackupPort["snapshot"]>>;
    },
    async download(path) {
      const { data, error } = await supabase.storage.from("note-attachments").download(path);
      if (error) {
        // Network/auth errors must never be mistaken for an absent object.
        const status = "statusCode" in error ? String(error.statusCode) : "";
        if (status === "404" || (status === "400" && error.message === "Object not found"))
          return null;
        throw error;
      }
      if (data.size > MAX_ATTACHMENT_BYTES)
        throw new Error("حجم أحد المرفقات يتجاوز الحد المدعوم.");
      return new Uint8Array(await data.arrayBuffer());
    },
    async upload(path, bytes, mime) {
      const { error } = await supabase.storage
        .from("note-attachments")
        .upload(path, bytes, { contentType: mime, upsert: false });
      if (error) throw error;
    },
    async restore(backup) {
      const { data, error } = await callUntypedRpc(supabase, "memoflow_restore_v1", {
        expected_account: accountId,
        payload: { version: 1, accountId, tables: backup.tables } as unknown as Json,
      });
      if (error) throw error;
      return data;
    },
  };
}
