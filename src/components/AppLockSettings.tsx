import { useState, type FormEvent } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { appLock, validAppPin } from "@/services/app-lock";

export function AppLockSettings() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (!appLock.supported()) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validAppPin(next) || next !== repeat) {
      setError("أدخل رمزًا جديدًا من 6 أرقام متطابقة");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await appLock.changePin(current, next);
      setCurrent("");
      setNext("");
      setRepeat("");
      setMessage("تم تغيير رمز التطبيق.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تغيير رمز التطبيق");
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: string, update: (value: string) => void) => (
    <label className="block text-sm">
      {label}
      <input
        aria-label={label}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        onChange={(event) => update(event.target.value.replace(/\D/g, "").slice(0, 6))}
        className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-center tracking-[0.35em]"
        dir="ltr"
      />
    </label>
  );

  return (
    <section className="px-4 pb-6 sm:px-5" aria-labelledby="app-lock-title">
      <h2 id="app-lock-title" className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
        قفل التطبيق
      </h2>
      <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          <KeyRound className="size-6 text-primary" />
          <h3 className="text-base font-semibold">رمز فتح MemoFlow</h3>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          يُقفل التطبيق عند مغادرته أو إغلاقه، وتُخفى لقطات الشاشة لحماية محتوى الخزنة.
        </p>
        <details className="mt-3 rounded-xl border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">تغيير الرمز</summary>
          <form onSubmit={submit} className="mt-3 space-y-3">
            {field("الرمز الحالي", current, setCurrent)}
            {field("الرمز الجديد", next, setNext)}
            {field("تأكيد الرمز الجديد", repeat, setRepeat)}
            {error && <p className="text-xs text-destructive">{error}</p>}
            {message && <p className="text-xs text-muted-foreground">{message}</p>}
            <button
              type="submit"
              disabled={busy || !validAppPin(current) || !validAppPin(next) || next !== repeat}
              className="flex min-h-11 w-full items-center justify-center rounded-xl bg-secondary px-4 text-sm font-medium disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : "حفظ الرمز الجديد"}
            </button>
          </form>
        </details>
      </div>
    </section>
  );
}
