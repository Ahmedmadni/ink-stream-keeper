import { useEffect, useRef, useState } from "react";
import { KeyRound, LockKeyhole, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  getDraftRescueStatus,
  protectLegacyDrafts,
  restoreLegacyDrafts,
  scanLegacyDrafts,
} from "./draft-rescue";

export function DraftRescuePanel() {
  const { user } = useAuth();
  return user ? <AccountDraftRescue key={user.id} accountId={user.id} /> : null;
}

function AccountDraftRescue({ accountId }: { accountId: string }) {
  const [count, setCount] = useState(0);
  const [saved, setSaved] = useState<{ count: number; createdAt: string } | null>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [mode, setMode] = useState<"protect" | "restore">("protect");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const epoch = useRef(0);

  const reload = async (token: number) => {
    const next = scanLegacyDrafts(localStorage, accountId).length;
    const archive = await getDraftRescueStatus(accountId);
    if (epoch.current !== token) return;
    setCount(next);
    setSaved(archive.exists ? { count: archive.count, createdAt: archive.createdAt } : null);
    setMode(archive.exists ? "restore" : "protect");
  };
  useEffect(() => {
    const token = ++epoch.current;
    void reload(token).catch(() => {
      if (epoch.current === token) setError("تعذر فحص المسودات القديمة. لم تُحذف أي بيانات.");
    });
    const onHide = () => {
      if (!document.hidden) return;
      epoch.current++;
      setPassword("");
      setRepeat("");
      setBusy(false);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      epoch.current++;
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [accountId]);

  const run = async () => {
    if (busy) return;
    const token = ++epoch.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (password.length < 12 || password.trim().length < 12)
        throw new Error("اختر كلمة مرور قوية لا تقل عن 12 حرفًا.");
      if (mode === "protect") {
        if (password !== repeat) throw new Error("كلمتا المرور غير متطابقتين.");
        const result = await protectLegacyDrafts(accountId, password, localStorage);
        if (epoch.current !== token) return;
        setMessage(
          result.changedDuringEncryption
            ? "حُفظت نسخة مشفّرة، لكن تغيّرت مسودات أثناء العملية. لم نزل جميع النصوص القديمة. استعد النسخة قبل إعادة الحماية."
            : "تم تأمين " + result.removed + " مسودة قديمة في نسخة مشفّرة قابلة للاستعادة.",
        );
      } else {
        const result = await restoreLegacyDrafts(accountId, password, localStorage);
        if (epoch.current !== token) return;
        setMessage(
          "استُعيدت " + result.restored + " مسودة إلى المحرر المحلي. افتح المذكرات واتصل بالإنترنت لحفظها؛ النسخة المشفّرة أُزيلت بعد التحقق.",
        );
      }
      await reload(token);
    } catch (reason) {
      if (epoch.current === token)
        setError(reason instanceof Error ? reason.message : "تعذر حماية المسودات أو استعادتها.");
    } finally {
      if (epoch.current === token) {
        setBusy(false);
        setPassword("");
        setRepeat("");
      }
    }
  };

  return (
    <section className="px-4 pb-6 sm:px-5" aria-labelledby="draft-rescue-heading">
      <h2 id="draft-rescue-heading" className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
        إنقاذ المسودات القديمة
      </h2>
      <div className="space-y-3 rounded-3xl border border-border/60 bg-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          <LockKeyhole className="size-6 shrink-0 text-primary" />
          <div>
            <h3 className="font-semibold">حماية المسودات غير المرفوعة</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              احفظ مسودات المذكرات الحالية في حزمة مشفّرة. نتحقق من الحزمة ثم نزيل
              السجلات القديمة التي لم تتغير فقط.
            </p>
          </div>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          المسودات القديمة على الجهاز: {count} · {saved
            ? "توجد حزمة إنقاذ مشفّرة تضم " + saved.count + " مسودة."
            : "لا توجد حزمة إنقاذ مشفّرة حاليًا."}
        </p>
        <p className="text-xs leading-6 text-muted-foreground">
          هذه حماية اختيارية للمسودات الموجودة الآن، وليست تشفيرًا دائمًا أثناء الكتابة.
          ستُعاد المسودات إلى التخزين المعتاد غير المشفّر عند استعادتها ليقرأها المحرر.
          إزالة السجلات من التخزين لا تضمن محو آثارها من وسائط الجهاز نهائيًا.
        </p>
        {(saved || count > 0) && (
          <>
            <div className="flex items-center gap-2 rounded-xl bg-secondary p-1 text-xs">
              <button
                type="button"
                disabled={busy || !saved}
                aria-pressed={mode === "restore"}
                onClick={() => { setMode("restore"); setError(""); setMessage(""); }}
                className="min-h-10 flex-1 rounded-lg px-2 disabled:opacity-50"
              >
                استعادة المسودات
              </button>
              <button
                type="button"
                disabled={busy || !!saved || count === 0}
                aria-pressed={mode === "protect"}
                onClick={() => { setMode("protect"); setError(""); setMessage(""); }}
                className="min-h-10 flex-1 rounded-lg px-2 disabled:opacity-50"
              >
                تشفير المسودات
              </button>
            </div>
            <label className="block text-sm">
              <span className="inline-flex items-center gap-2">
                <KeyRound className="size-4" /> كلمة مرور إنقاذ المسودات
              </span>
              <input
                type="password"
                aria-label="كلمة مرور إنقاذ المسودات"
                autoComplete="off"
                maxLength={256}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-3"
              />
            </label>
            {mode === "protect" && (
              <label className="block text-sm">
                <span>تأكيد كلمة مرور المسودات</span>
                <input
                  type="password"
                  autoComplete="off"
                  maxLength={256}
                  value={repeat}
                  onChange={(event) => setRepeat(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-3"
                />
              </label>
            )}
            <button
              type="button"
              disabled={busy || !password || (mode === "protect" && !repeat)}
              onClick={() => { void run(); }}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "جارٍ التحقق من المسودات…" : mode === "restore"
                ? "استعادة المسودات المشفّرة" : "تشفير المسودات القديمة"}
            </button>
          </>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {message && <p role="status" className="text-sm text-primary">{message}</p>}
        <p className="text-xs leading-6 text-muted-foreground">
          لا يمكن استعادة الحزمة دون كلمة مرورها. لا يحذف هذا الإجراء المذكرات المحفوظة على الخادم.
        </p>
      </div>
    </section>
  );
}
