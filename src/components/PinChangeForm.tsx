import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { normalizePinInput } from "@/lib/pin-input";
import { ChevronDown, Loader2 } from "lucide-react";

export function PinChangeForm({
  subject,
  onSave,
}: {
  subject: "الخزنة" | "التطبيق";
  onSave: (current: string, next: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const epoch = useRef(0);
  const clear = useCallback(() => {
    epoch.current++;
    setCurrent("");
    setNext("");
    setRepeat("");
    setError("");
    setMessage("");
  }, []);
  useEffect(() => {
    const generation = epoch;
    const hide = () => {
      if (document.hidden) {
        clear();
        setOpen(false);
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      generation.current++;
      document.removeEventListener("visibilitychange", hide);
    };
  }, [clear]);
  const valid = (value: string) => /^\d{6}$/.test(value);
  const same = !!current && current === next;
  const mismatch = !!repeat && next !== repeat;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !valid(current) || !valid(next) || next !== repeat || same) return;
    const ticket = epoch.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await onSave(current, next);
      if (ticket === epoch.current) setMessage(`تم تغيير رمز ${subject} بنجاح.`);
    } catch (reason) {
      if (ticket === epoch.current)
        setError(reason instanceof Error ? reason.message : `تعذر تغيير رمز ${subject}`);
    } finally {
      setCurrent("");
      setNext("");
      setRepeat("");
      setBusy(false);
    }
  };
  const field = (label: string, value: string, update: (value: string) => void) => (
    <label className="block text-sm font-medium">
      {label}
      <input
        aria-label={label}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        disabled={busy}
        value={value}
        onChange={(event) => {
          update(normalizePinInput(event.target.value));
          setError("");
          setMessage("");
        }}
        className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-3 text-center text-base tracking-[0.35em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
        dir="ltr"
      />
    </label>
  );
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        disabled={busy}
        onClick={() => {
          clear();
          setOpen((value) => !value);
        }}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-secondary px-4 text-start text-sm font-semibold disabled:opacity-50"
      >
        تغيير رمز {subject}
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <form aria-label={`تغيير رمز ${subject}`} onSubmit={submit} className="mt-4 space-y-3">
          {field(`رمز ${subject} الحالي`, current, setCurrent)}
          {field(`رمز ${subject} الجديد`, next, setNext)}
          {field(`تأكيد رمز ${subject} الجديد`, repeat, setRepeat)}
          {(same || mismatch) && (
            <p className="text-sm text-destructive">
              {same ? "اختر رمزًا جديدًا مختلفًا عن الرمز الحالي" : "تأكيد الرمز الجديد غير مطابق"}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="text-sm text-success">
              {message}
            </p>
          )}
          {message && subject === "الخزنة" && (
            <p className="text-sm leading-6 text-muted-foreground">
              أنشئ نسخة احتياطية جديدة لتضمين إعداد الخزنة الحالي.
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !valid(current) || !valid(next) || next !== repeat || same}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {busy ? (
              <>
                <Loader2 className="size-5 animate-spin" /> جارٍ حفظ الرمز…
              </>
            ) : (
              `حفظ رمز ${subject} الجديد`
            )}
          </button>
        </form>
      )}
    </div>
  );
}
