import { useEffect, useRef, useState } from "react";
import {
  Cloud,
  DatabaseBackup,
  Download,
  HardDrive,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { lockVault } from "@/lib/vault";
import { files } from "@/services/files";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { callUntypedRpc } from "./rpc";
import { backupError, createBackupPort } from "./supabase-port";
import { exportBackup, previewBackup, restoreBackup } from "./service";
import { MAX_FILE_BYTES, type Backup } from "./format";
import { nativeBackup, type NativeBackupStatus } from "@/services/native-backup";
import { assertNoUnsavedDrafts } from "./automatic";

const button =
  "flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-40";
const input =
  "mt-2 min-h-12 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-base";
type Mode = "choose" | "export" | "restore" | null;
type Destination = "local" | "drive";

export function BackupPanel() {
  const { user } = useAuth();
  return user ? <AccountBackup key={user.id} accountId={user.id} /> : null;
}

function AccountBackup({ accountId }: { accountId: string }) {
  const [ready, setReady] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [destination, setDestination] = useState<Destination>("local");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [download, setDownload] = useState<File | null>(null);
  const [preview, setPreview] = useState<Backup | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [nativeStatus, setNativeStatus] = useState<NativeBackupStatus | null>(null);
  const epoch = useRef(0);
  const mounted = useRef(true);
  const qc = useQueryClient();

  useEffect(() => {
    mounted.current = true;
    void callUntypedRpc(supabase, "memoflow_backup_tables_v1")
      .then(({ data, error }) => {
        if (mounted.current)
          setReady(!error && Array.isArray(data) && data.includes("vault_settings"));
      })
      .catch(() => {
        if (mounted.current) setReady(false);
      });
    if (nativeBackup.supported())
      void nativeBackup
        .status(accountId)
        .then((status) => {
          if (mounted.current) setNativeStatus(status);
        })
        .catch(() => undefined);
    const clear = () => {
      if (!document.hidden) return;
      epoch.current++;
      setPassword("");
      setRepeat("");
      setPreview(null);
      setDownload(null);
      setConfirmed(false);
      setBusy(false);
      setError("");
    };
    document.addEventListener("visibilitychange", clear);
    return () => {
      mounted.current = false;
      // Invalidates an operation generation; this ref does not point to a DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      epoch.current++;
      document.removeEventListener("visibilitychange", clear);
    };
  }, [accountId]);

  const reset = (next: Mode) => {
    epoch.current++;
    setMode(next);
    setPassword("");
    setRepeat("");
    setFile(null);
    setPreview(null);
    setDownload(null);
    setConfirmed(false);
    setError("");
    setMessage("");
    setBusy(false);
  };
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
    } catch (reason) {
      if (active()) setError(backupError(reason));
    } finally {
      if (active()) setBusy(false);
    }
  };
  const deliver = async (backup: File, target: Destination, active: () => boolean) => {
    if (target === "local") {
      const result = await files.save(backup, backup.name);
      if (active())
        setMessage(
          result.mode === "cancelled"
            ? "أُلغي الحفظ؛ يمكنك المحاولة مجددًا."
            : result.mode === "native"
              ? "حُفظت النسخة في المكان الذي اخترته على الهاتف."
              : "تم تنزيل النسخة؛ ستجدها في مجلد التنزيلات.",
        );
    } else {
      const result = await files.share(backup, backup.name, "حفظ نسخة MemoFlow في Google Drive");
      if (!active()) return;
      if (result === "unavailable")
        throw new Error(
          "المشاركة غير متاحة هنا. احفظ النسخة على الهاتف ثم ارفعها إلى Google Drive.",
        );
      setMessage(
        result === "cancelled"
          ? "أُلغيت المشاركة؛ يمكنك المحاولة مجددًا."
          : "تمت مشاركة النسخة. أكمل الحفظ في Google Drive من النافذة التي فتحتها.",
      );
    }
  };
  const create = () =>
    run(async (port, active) => {
      assertNoUnsavedDrafts(accountId);
      setPreview(null);
      setDownload(null);
      const contents = await exportBackup(port, accountId, password);
      assertNoUnsavedDrafts(accountId);
      if (!active()) return;
      const stamp = new Date()
        .toISOString()
        .replace(/\.\d{3}Z$/, "")
        .replace("T", "-")
        .replaceAll(":", "");
      const backup = new File([contents], `MemoFlow-${stamp}.memoflow`, {
        type: "application/octet-stream",
      });
      setDownload(backup);
      setPassword("");
      setRepeat("");
      // Native sharing does not require browser transient activation. On the web,
      // keep a fresh user gesture for the share sheet after encryption finishes.
      if (destination === "local" || nativeBackup.supported())
        await deliver(backup, destination, active);
      else setMessage("النسخة جاهزة. اضغط مشاركة إلى Google Drive ثم اختر Drive.");
    });

  return (
    <section className="px-4 pb-6 sm:px-5" aria-labelledby="backup-title">
      <h2 id="backup-title" className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
        بياناتك ونسخها الاحتياطية
      </h2>
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft">
              <DatabaseBackup className="size-6 text-primary" />
            </span>
            <div>
              <h3 className="text-base font-semibold">النسخ الاحتياطي</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                مذكراتك ومهامك وخزنتك في ملف مشفّر.
              </p>
            </div>
          </div>
          {ready === null && (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              جارٍ التحقق من توفر النسخ الاحتياطي…
            </p>
          )}
          {ready === false && (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              النسخ الاحتياطي غير متاح حاليًا. تحقق من الاتصال ثم أعد فتح الإعدادات.
            </p>
          )}
          {ready === true && (
            <div className="mt-4 grid gap-2">
              <button
                onClick={() => reset("choose")}
                className={`${button} bg-primary text-primary-foreground`}
              >
                <Download className="size-5" />
                نسخ احتياطي
              </button>
              <button onClick={() => reset("restore")} className={`${button} bg-secondary`}>
                <Upload className="size-5" />
                استعادة نسخة
              </button>
            </div>
          )}
        </div>
        {ready && nativeBackup.supported() && (
          <details className="border-t border-border p-4">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
              نسخ تلقائي محلي · اختياري
            </summary>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              نسخة يومية عند فتح التطبيق، مع الاحتفاظ بآخر 7 نسخ على الهاتف.
            </p>
            {nativeStatus?.configured ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-muted-foreground">
                  {nativeStatus.lastBackupAt
                    ? `آخر نسخة: ${new Date(nativeStatus.lastBackupAt).toLocaleString("ar-EG-u-ca-gregory-nu-latn", { day: "numeric", month: "long", year: "numeric" })}`
                    : "لم تُنشأ نسخة تلقائية بعد."}
                </p>
                <button
                  disabled={busy}
                  className={`${button} w-full bg-secondary`}
                  onClick={() =>
                    run(async (_, active) => {
                      await nativeBackup.setEnabled(accountId, !nativeStatus.enabled);
                      const status = await nativeBackup.status(accountId);
                      if (active()) setNativeStatus(status);
                    })
                  }
                >
                  {nativeStatus.enabled ? "إيقاف النسخ التلقائي" : "تشغيل النسخ التلقائي"}
                </button>
              </div>
            ) : (
              <form
                className="mt-3 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async (_, active) => {
                    await nativeBackup.configure(accountId, password);
                    const status = await nativeBackup.status(accountId);
                    if (active()) {
                      setNativeStatus(status);
                      setPassword("");
                      setRepeat("");
                      setMessage("تم تفعيل النسخ التلقائي المحلي.");
                    }
                  });
                }}
              >
                <PasswordFields
                  password={password}
                  repeat={repeat}
                  setPassword={setPassword}
                  setRepeat={setRepeat}
                  busy={busy}
                />
                <button
                  type="submit"
                  className={`${button} w-full bg-secondary`}
                  disabled={busy || password.length < 12 || password !== repeat}
                >
                  <RefreshCw className="size-5" />
                  تفعيل النسخ التلقائي
                </button>
              </form>
            )}
          </details>
        )}
        {mode === null && <Feedback busy={busy} error={error} message={message} />}
      </div>

      <Dialog
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open) reset(null);
        }}
      >
        <DialogContent
          dir="rtl"
          className="max-h-[85dvh] w-[92vw] overflow-y-auto rounded-3xl bg-card p-5 sm:p-6 [&>button]:left-3 [&>button]:right-auto [&>button]:grid [&>button]:size-11 [&>button]:place-items-center"
        >
          <DialogHeader className="pe-10 text-start sm:text-start">
            <DialogTitle className="text-xl">
              {mode === "restore" ? "استعادة نسخة" : "نسخ احتياطي"}
            </DialogTitle>
            <DialogDescription className="pt-2 leading-6">
              {mode === "choose"
                ? "أين تريد الاحتفاظ بالنسخة؟"
                : mode === "restore"
                  ? "اختر الملف من الهاتف أو Google Drive وأدخل كلمة مروره."
                  : destination === "local"
                    ? "حفظ نسخة مشفّرة على الهاتف."
                    : "مشاركة النسخة إلى Google Drive للاحتفاظ بها."}
            </DialogDescription>
          </DialogHeader>
          {mode === "choose" && (
            <div className="grid gap-3">
              <button
                className={`${button} justify-start border border-border bg-secondary`}
                onClick={() => {
                  setDestination("local");
                  setMode("export");
                }}
              >
                <HardDrive className="size-6" />
                <span>حفظ على الهاتف</span>
              </button>
              <button
                className={`${button} justify-start border border-border bg-secondary`}
                onClick={() => {
                  setDestination("drive");
                  setMode("export");
                }}
              >
                <Cloud className="size-6" />
                <span>Google Drive</span>
              </button>
              <p className="text-sm leading-6 text-muted-foreground">
                عند اختيار Google Drive تفتح نافذة المشاركة؛ اختر Drive وأكمل الحفظ.
              </p>
            </div>
          )}
          {mode === "export" && !download && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void create();
              }}
            >
              <PasswordFields
                password={password}
                repeat={repeat}
                setPassword={setPassword}
                setRepeat={setRepeat}
                busy={busy}
              />
              <p className="text-sm leading-6 text-muted-foreground">
                احتفظ بكلمة المرور؛ ستحتاجها عند استعادة النسخة.
              </p>
              <button
                type="submit"
                disabled={busy || password.length < 12 || password !== repeat}
                className={`${button} w-full bg-primary text-primary-foreground`}
              >
                {busy ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : destination === "local" ? (
                  <HardDrive className="size-5" />
                ) : (
                  <Cloud className="size-5" />
                )}
                إنشاء وحفظ النسخة
              </button>
            </form>
          )}
          {mode === "export" && download && (
            <div className="space-y-3">
              <p className="text-sm font-medium">النسخة المشفّرة جاهزة.</p>
              <button
                disabled={busy}
                className={`${button} w-full bg-primary text-primary-foreground`}
                onClick={() => run(async (_, active) => deliver(download, destination, active))}
              >
                {destination === "local" ? "حفظ على الهاتف" : "مشاركة إلى Google Drive"}
              </button>
              <button
                disabled={busy}
                className={`${button} w-full bg-secondary`}
                onClick={() => reset("choose")}
              >
                إنشاء نسخة أخرى
              </button>
            </div>
          )}
          {mode === "restore" && !preview && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async (port, active) => {
                  setConfirmed(false);
                  setPreview(null);
                  if (!file || file.size > MAX_FILE_BYTES)
                    throw new Error("اختر ملفًا لا يزيد عن 70 ميجابايت.");
                  await port.assertAccount();
                  const data = await previewBackup(await file.text(), password, accountId);
                  await port.assertAccount();
                  if (active()) {
                    setPreview(data);
                    setPassword("");
                  }
                });
              }}
            >
              <label className="block text-sm font-medium">
                ملف النسخة الاحتياطية
                <input
                  aria-label="ملف النسخة الاحتياطية"
                  type="file"
                  accept=".memoflow,application/octet-stream,application/json"
                  disabled={busy}
                  className="mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-border p-2 text-sm file:me-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setError("");
                  }}
                />
              </label>
              <label className="block text-sm font-medium">
                كلمة مرور النسخة
                <input
                  aria-label="كلمة مرور النسخة"
                  type="password"
                  autoComplete="off"
                  maxLength={256}
                  value={password}
                  disabled={busy}
                  onChange={(event) => setPassword(event.target.value)}
                  className={input}
                />
              </label>
              <button
                type="submit"
                disabled={busy || !file || password.length < 12}
                className={`${button} w-full bg-primary text-primary-foreground`}
              >
                <Upload className="size-5" />
                فحص الملف ومعاينته
              </button>
            </form>
          )}
          {mode === "restore" && preview && (
            <div aria-label="معاينة النسخة" className="space-y-4">
              <p className="text-base font-semibold">
                نسخة{" "}
                {new Date(preview.createdAt).toLocaleDateString("ar-EG-u-ca-gregory-nu-latn", {
                  dateStyle: "medium",
                })}
              </p>
              <dl className="grid grid-cols-2 gap-2">
                {[
                  ["المذكرات", preview.tables.notes.length],
                  ["المهام", preview.tables.tasks.length],
                  ["حسابات الخزنة", preview.tables.vault_entries.length],
                  ["المرفقات", preview.files.length],
                ].map(([label, count]) => (
                  <div key={label} className="rounded-2xl bg-secondary p-3">
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-xl font-semibold">{count}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm leading-6 text-muted-foreground">
                تُضاف العناصر المفقودة، وتبقى بياناتك الحالية وتعديلاتها محفوظة. الاستعادة تحتاج
                اتصالًا بالإنترنت ورمز الخزنة الأصلي لفتحها.
              </p>
              <label className="flex min-h-12 items-start gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-primary"
                  checked={confirmed}
                  disabled={busy}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                أوافق على إضافة العناصر المفقودة إلى حسابي الحالي
              </label>
              <button
                disabled={busy || !confirmed}
                className={`${button} w-full bg-primary text-primary-foreground`}
                onClick={() =>
                  run(async (port, active) => {
                    lockVault();
                    const result = await restoreBackup(port, preview);
                    if (!active()) return;
                    await qc.invalidateQueries();
                    setPreview(null);
                    setConfirmed(false);
                    setFile(null);
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
          <Feedback busy={busy} error={error} message={message} />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PasswordFields({
  password,
  repeat,
  setPassword,
  setRepeat,
  busy,
}: {
  password: string;
  repeat: string;
  setPassword: (value: string) => void;
  setRepeat: (value: string) => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">
        كلمة مرور النسخة
        <input
          aria-label="كلمة مرور النسخة"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={256}
          value={password}
          disabled={busy}
          onChange={(event) => setPassword(event.target.value)}
          className={input}
          placeholder="12 حرفًا على الأقل"
        />
      </label>
      <label className="block text-sm font-medium">
        تأكيد كلمة مرور النسخة
        <input
          aria-label="تأكيد كلمة مرور النسخة"
          type="password"
          autoComplete="new-password"
          maxLength={256}
          value={repeat}
          disabled={busy}
          onChange={(event) => setRepeat(event.target.value)}
          className={input}
        />
      </label>
    </div>
  );
}

function Feedback({ busy, error, message }: { busy: boolean; error: string; message: string }) {
  return (
    <div className="empty:hidden">
      {busy && (
        <p role="status" className="p-3 text-sm leading-6 text-muted-foreground">
          جارٍ تجهيز النسخة… أبقِ التطبيق مفتوحًا.
        </p>
      )}
      {error && (
        <p role="alert" className="p-3 text-sm leading-6 text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="p-3 text-sm leading-6 text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
