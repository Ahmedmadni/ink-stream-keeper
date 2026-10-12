import { useEffect, useRef, useState } from "react";
import { Download, FileLock2, Share2, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { lockVault } from "@/lib/vault";
import { files } from "@/services/files";
import { backupError, createBackupPort } from "./supabase-port";
import { exportBackup, previewBackup, restoreBackup } from "./service";
import { MAX_FILE_BYTES, type Backup } from "./format";

const button = "min-h-11 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40";
const input =
  "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm";
export function BackupPanel() {
  const { user } = useAuth();
  return user ? <AccountBackup key={user.id} accountId={user.id} /> : null;
}
function AccountBackup({ accountId }: { accountId: string }) {
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [download, setDownload] = useState<File | null>(null);
  const [preview, setPreview] = useState<Backup | null>(null);
  const [busy, setBusy] = useState(false);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const epoch = useRef(0),
    mounted = useRef(true);
  const qc = useQueryClient();
  useEffect(() => {
    mounted.current = true;
    (supabase.rpc as unknown as (fn: string) => Promise<{ data: unknown; error: unknown }>)("memoflow_backup_tables_v1").then(({ data, error }) => {
      if (mounted.current)
        setReady(!error && Array.isArray(data) && data.includes("vault_settings"));
    });
    const clear = () => {
      if (document.visibilityState !== "hidden") return;
      epoch.current++;
      setPassword("");
      setRepeat("");
      setPreview(null);
      setDownload(null);
      setConfirmed(false);
      setBusy(false);
      setDeliveryBusy(false);
      setError("");
      setMessage(
        "أُغلقت المعاينة عند إخفاء التطبيق. يمكنك إعادة العملية؛ الاستعادة لا تكرر العناصر.",
      );
    };
    document.addEventListener("visibilitychange", clear);
    return () => {
      mounted.current = false;
      // This is an operation generation counter, not a DOM ref. Invalidate the latest value.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      epoch.current++;
      document.removeEventListener("visibilitychange", clear);
    };
  }, []);
  const run = async (
    action: (port: ReturnType<typeof createBackupPort>, active: () => boolean) => Promise<void>,
  ) => {
    const token = ++epoch.current;
    const active = () => mounted.current && token === epoch.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action(createBackupPort(accountId, active), active);
    } catch (e) {
      if (active()) setError(backupError(e));
    } finally {
      if (active()) setBusy(false);
    }
  };
  const checkDrafts = () => {
    const prefix = `memoflow.note-draft.v1:${encodeURIComponent(accountId)}:`;
    for (let i = 0; i < localStorage.length; i++)
      if (localStorage.key(i)?.startsWith(prefix))
        throw new Error("توجد مسودات مذكرات على هذا الجهاز. افتحها وأكمل حفظها قبل تصدير النسخة.");
  };
  return (
    <section className="px-5 pb-6" aria-labelledby="backup-title">
      <h2 id="backup-title" className="mb-2 px-1 text-xs font-medium text-muted-foreground">
        النسخ الاحتياطية
      </h2>
      <div className="rounded-2xl bg-card p-4">
        <div className="flex items-center gap-3">
          <FileLock2 className="size-5 shrink-0 text-primary" />
          <h3 className="text-sm font-semibold">نسخة مشفّرة من بياناتك</h3>
        </div>
        <p className="mt-3 text-xs leading-6 text-muted-foreground">
          تشمل البيانات المحفوظة في حسابك: المذكرات والمهام والخزنة والأقسام السابقة ومرفقاتها
          المرفوعة. لا تشمل الملفات المرتبطة بمواقع خارجية أو المسودات غير المحفوظة على الأجهزة
          الأخرى.
        </p>
        {ready === null && (
          <p role="status" className="mt-3 text-sm">
            جارٍ التحقق من توفر النسخ الاحتياطي…
          </p>
        )}
        {ready === false && (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            النسخ الاحتياطي غير متاح حاليًا. يلزم تفعيل تحديث قاعدة البيانات أو إعادة المحاولة بعد
            عودة الاتصال.
          </p>
        )}
        {ready === true && (
          <div className="mt-4 space-y-5">
            <p className="text-xs leading-6 text-muted-foreground">
              احتفظ بكلمة مرور النسخة في مكان آمن؛ لا يمكن استعادتها. وتحتاج الخزنة أيضًا إلى رمزها
              الأصلي بعد الاستعادة. الحد: 10 آلاف عنصر و32 ميجابايت للمرفقات مجتمعة.
            </p>
            <label className="block text-sm">
              كلمة مرور النسخة
              <input
                aria-label="كلمة مرور النسخة"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                value={password}
                disabled={busy}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPreview(null);
                  setConfirmed(false);
                }}
                className={input}
                placeholder="12 حرفًا على الأقل"
              />
            </label>
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">إنشاء نسخة جديدة</summary>
              <label className="mt-3 block text-sm">
                تأكيد كلمة مرور النسخة
                <input
                  aria-label="تأكيد كلمة مرور النسخة"
                  type="password"
                  autoComplete="new-password"
                  maxLength={256}
                  value={repeat}
                  disabled={busy}
                  onChange={(e) => setRepeat(e.target.value)}
                  className={input}
                />
              </label>
              <button
                className={`${button} mt-3 w-full bg-primary text-primary-foreground`}
                disabled={busy || password.length < 12 || password !== repeat}
                onClick={() =>
                  run(async (port, active) => {
                    checkDrafts();
                    setDownload(null);
                    setPreview(null);
                    const text = await exportBackup(port, accountId, password);
                    checkDrafts();
                    if (!active()) return;
                    const stamp = new Date()
                      .toISOString()
                      .replace(/\.\d{3}Z$/, "")
                      .replace("T", "-")
                      .replaceAll(":", "");
                    setDownload(
                      new File([text], `MemoFlow-${stamp}.memoflow`, {
                        type: "application/octet-stream",
                      }),
                    );
                    setPassword("");
                    setRepeat("");
                    setMessage("الملف المشفّر جاهز. نزّله واحتفظ به في المكان الذي تختاره.");
                  })
                }
              >
                تجهيز النسخة المشفّرة
              </button>
            </details>
            {download && (
              <div className="space-y-2 rounded-xl bg-secondary/50 p-3">
                <button
                  className={`${button} bg-secondary flex w-full items-center justify-center gap-2`}
                  disabled={deliveryBusy}
                  onClick={async () => {
                    setDeliveryBusy(true);
                    setError("");
                    try {
                      const result = await files.save(download, download.name);
                      setMessage(
                        result.mode === "native"
                          ? `حُفظ الملف على الجهاز داخل ${result.path}.`
                          : "تم طلب تنزيل الملف. تحقق من مجلد التنزيلات.",
                      );
                    } catch {
                      setError(
                        "تعذر حفظ الملف على الجهاز. استخدم المشاركة أو أعد المحاولة بعد تحديث التطبيق.",
                      );
                    } finally {
                      setDeliveryBusy(false);
                    }
                  }}
                >
                  <Download className="size-4" />
                  حفظ على الجهاز
                </button>
                {files.canShare(download, download.name) && (
                  <button
                    className={`${button} bg-secondary flex w-full items-center justify-center gap-2`}
                    disabled={deliveryBusy}
                    onClick={async () => {
                      setDeliveryBusy(true);
                      setError("");
                      try {
                        const result = await files.share(download, download.name);
                        if (result === "shared")
                          setMessage("تم تسليم الملف إلى التطبيق الذي اخترته.");
                        if (result === "unavailable")
                          setError("المشاركة غير متاحة على هذا الجهاز. استخدم الحفظ على الجهاز.");
                      } catch {
                        setError("تعذرت مشاركة الملف. احفظه على الجهاز ثم ارفعه إلى Drive يدويًا.");
                      } finally {
                        setDeliveryBusy(false);
                      }
                    }}
                  >
                    <Share2 className="size-4" />
                    مشاركة أو حفظ في Google Drive
                  </button>
                )}
                <p className="text-xs leading-6 text-muted-foreground">
                  على أندرويد يمكنك حفظ نسخة داخل مجلد Documents، أو اختيار Google Drive من نافذة
                  المشاركة. وللاستعادة اختر الملف من الجهاز أو من Drive في منتقي الملفات أدناه.
                </p>
              </div>
            )}
            <div className="border-t border-border pt-4">
              <label className="block text-sm font-medium">
                استعادة من ملف
                <input
                  aria-label="ملف النسخة الاحتياطية"
                  type="file"
                  accept=".memoflow,application/octet-stream,application/json"
                  disabled={busy}
                  className="peer sr-only"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setPreview(null);
                    setConfirmed(false);
                    setError("");
                  }}
                />
                <span className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-secondary px-3 py-2 text-xs peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                  <span className="shrink-0">اختيار ملف</span>
                  <span className="min-w-0 truncate text-muted-foreground">
                    {file?.name || "لم يُختر ملف بعد"}
                  </span>
                </span>
              </label>
              <button
                className={`${button} bg-secondary mt-3 flex w-full items-center justify-center gap-2`}
                disabled={busy || !file || password.length < 12}
                onClick={() =>
                  run(async (port, active) => {
                    setPreview(null);
                    setConfirmed(false);
                    setDownload(null);
                    if (!file || file.size > MAX_FILE_BYTES)
                      throw new Error("اختر ملفًا لا يزيد عن 70 ميجابايت.");
                    await port.assertAccount();
                    const data = await previewBackup(await file.text(), password, accountId);
                    await port.assertAccount();
                    if (active()) {
                      setPreview(data);
                      setPassword("");
                      setRepeat("");
                    }
                  })
                }
              >
                <Upload className="size-4" />
                فحص الملف ومعاينته
              </button>
            </div>
            {preview && (
              <div
                className="rounded-xl border border-primary/25 bg-primary/5 p-4"
                aria-label="معاينة النسخة"
              >
                <p className="text-sm font-semibold">
                  نسخة{" "}
                  {new Date(preview.createdAt).toLocaleDateString("ar-SA", { dateStyle: "medium" })}
                </p>
                <dl className="my-3 grid grid-cols-2 gap-2 text-xs">
                  {[
                    ["المذكرات", preview.tables.notes.length],
                    ["المهام", preview.tables.tasks.length],
                    ["حسابات الخزنة", preview.tables.vault_entries.length],
                    ["المرفقات", preview.files.length],
                    [
                      "جميع السجلات",
                      Object.values(preview.tables).reduce((n, rows) => n + rows.length, 0),
                    ],
                  ].map(([label, count]) => (
                    <div className="rounded-lg bg-card p-3" key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="mt-1 text-lg font-semibold">{count}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs leading-6">
                  تُضاف العناصر المفقودة فقط. العناصر الموجودة وتعديلاتها تبقى كما هي؛ لن تُستبدل
                  بنسخة أقدم. الاستعادة تحتاج اتصالًا بالإنترنت.
                </p>
                <label className="mt-3 flex items-start gap-2 text-xs leading-6">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0"
                    checked={confirmed}
                    disabled={busy}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  أوافق على إضافة العناصر المفقودة إلى حسابي الحالي
                </label>
                <button
                  className={`${button} mt-3 w-full bg-primary text-primary-foreground`}
                  disabled={busy || !confirmed}
                  onClick={() =>
                    run(async (port, active) => {
                      lockVault();
                      const result = await restoreBackup(port, preview);
                      if (!active()) return;
                      await qc.invalidateQueries();
                      setPreview(null);
                      setConfirmed(false);
                      setMessage(
                        `اكتملت الاستعادة: أُضيف ${result.inserted} عنصرًا، واحتُفظ بـ ${result.skipped} عنصرًا موجودًا.`,
                      );
                    })
                  }
                >
                  استعادة العناصر المفقودة
                </button>
              </div>
            )}
          </div>
        )}
        {busy && (
          <p role="status" className="mt-4 text-sm">
            جارٍ التحقق والمعالجة… أبقِ التطبيق مفتوحًا.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm leading-6 text-destructive">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mt-4 text-sm leading-6 text-muted-foreground">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
