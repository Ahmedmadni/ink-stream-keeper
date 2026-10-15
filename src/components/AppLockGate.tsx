import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { appLock, validAppPin } from "@/services/app-lock";
import { nativeBackup } from "@/services/native-backup";

type Phase = "checking" | "open" | "locked" | "setup";

export function AppLockGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(appLock.supported() ? "checking" : "open");
  const [blockedUntil, setBlockedUntil] = useState(0);

  useEffect(() => {
    if (!appLock.supported()) return;
    let active = true;
    const refresh = async () => {
      try {
        const status = await appLock.status();
        if (!active) return;
        setBlockedUntil(status.blockedUntil);
        if (status.configured) {
          setPhase(status.unlocked ? "open" : "locked");
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (active) setPhase(data.session ? "setup" : "open");
      } catch {
        if (active) setPhase("locked");
      }
    };
    void refresh();
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT") setPhase("open");
      if (event === "SIGNED_IN" && session) void refresh();
    });
    const visibility = () => {
      if (document.hidden) {
        void appLock.lock();
        return;
      }
      void refresh();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pageshow", refresh);
    return () => {
      active = false;
      auth.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);

  if (phase === "checking") return <LockSplash />;
  if (phase === "setup") return <SetupLock onDone={() => setPhase("open")} />;
  if (phase === "locked") {
    return (
      <UnlockApp
        blockedUntil={blockedUntil}
        onUnlocked={() => setPhase("open")}
        onBlocked={setBlockedUntil}
        onReset={() => setPhase("open")}
      />
    );
  }
  return <>{children}</>;
}

function LockScreen({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-8 safe-x safe-bottom">
      <section className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 text-center shadow-elevated sm:p-6">
        <img src="/icon.svg" alt="" className="mx-auto size-16 rounded-2xl" />
        {children}
      </section>
    </main>
  );
}

function LockSplash() {
  return (
    <LockScreen>
      <Loader2 className="mx-auto mt-6 size-6 animate-spin text-primary" />
      <p className="mt-3 text-sm text-muted-foreground">جارٍ تأمين MemoFlow…</p>
    </LockScreen>
  );
}

function PinInput({
  value,
  onChange,
  label,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="mt-4 block text-right text-sm font-medium">
      {label}
      <input
        autoFocus={autoFocus}
        aria-label={label}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        className="mt-2 min-h-12 w-full rounded-2xl border border-border bg-background px-4 text-center text-xl tracking-[0.45em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        dir="ltr"
      />
    </label>
  );
}

function SetupLock({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validAppPin(pin) || pin !== repeat) {
      setError("أدخل 6 أرقام متطابقة");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await appLock.configure(pin);
      onDone();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر حفظ رمز التطبيق");
    } finally {
      setBusy(false);
    }
  };
  return (
    <LockScreen>
      <ShieldCheck className="mx-auto mt-5 size-8 text-primary" />
      <h1 className="mt-3 text-xl font-bold">احمِ التطبيق قبل المتابعة</h1>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        أنشئ رمزًا من 6 أرقام. سيُطلب عند فتح MemoFlow أو العودة إليه بعد مغادرته، ولن يُحفظ الرمز
        نفسه على الجهاز.
      </p>
      <form onSubmit={submit}>
        <PinInput value={pin} onChange={setPin} label="رمز التطبيق" autoFocus />
        <PinInput value={repeat} onChange={setRepeat} label="تأكيد الرمز" />
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={busy || !validAppPin(pin) || pin !== repeat}
          className="mt-5 flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : "تفعيل قفل MemoFlow"}
        </button>
      </form>
    </LockScreen>
  );
}

function UnlockApp({
  blockedUntil,
  onUnlocked,
  onBlocked,
  onReset,
}: {
  blockedUntil: number;
  onUnlocked: () => void;
  onBlocked: (until: number) => void;
  onReset: () => void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (blockedUntil <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [blockedUntil]);
  const wait = Math.max(0, Math.ceil((blockedUntil - now) / 1_000));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (wait > 0 || !validAppPin(pin)) return;
    setBusy(true);
    setError("");
    try {
      await appLock.unlock(pin);
      setPin("");
      onUnlocked();
    } catch (reason) {
      const status = await appLock.status().catch(() => null);
      if (status) onBlocked(status.blockedUntil);
      setPin("");
      setError(reason instanceof Error ? reason.message : "رمز التطبيق غير صحيح");
    } finally {
      setBusy(false);
    }
  };
  const forgot = async () => {
    if (
      !window.confirm(
        "سيتم تسجيل الخروج وإلغاء رمز هذا الجهاز ومسح المسودات المحلية غير المتزامنة. ملفات النسخ السابقة وبيانات حسابك المحفوظة لن تُحذف. هل تريد المتابعة؟",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await supabase.auth.signOut({ scope: "local" });
      await nativeBackup.clearConfiguration();
      await appLock.resetAfterSignOut();
      onReset();
    } catch {
      setError("تعذر تسجيل الخروج وإعادة الضبط. حاول مجددًا.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <LockScreen>
      <LockKeyhole className="mx-auto mt-5 size-8 text-primary" />
      <h1 className="mt-3 text-xl font-bold">MemoFlow مقفّل</h1>
      <p className="mt-2 text-xs text-muted-foreground">أدخل رمز التطبيق قبل عرض بياناتك.</p>
      <form onSubmit={submit}>
        <PinInput value={pin} onChange={setPin} label="رمز التطبيق" autoFocus />
        {wait > 0 && <p className="mt-3 text-sm text-destructive">حاول مجددًا بعد {wait} ثانية.</p>}
        {error && wait === 0 && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={busy || wait > 0 || !validAppPin(pin)}
          className="mt-5 flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : "فتح التطبيق"}
        </button>
      </form>
      <button
        type="button"
        disabled={busy}
        onClick={forgot}
        className="mx-auto mt-4 flex items-center gap-2 text-xs text-muted-foreground"
      >
        <LogOut className="size-4" /> نسيت الرمز؟ تسجيل الخروج وإعادة الضبط
      </button>
    </LockScreen>
  );
}
