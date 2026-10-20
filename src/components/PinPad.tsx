import { useEffect, useRef } from "react";
import { normalizePinInput } from "@/lib/pin-input";

export function PinPad({
  value,
  onChange,
  max = 6,
  disabled = false,
  label = "رمز الخزنة",
}: {
  value: string;
  onChange: (value: string) => void;
  max?: number;
  disabled?: boolean;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!disabled) input.current?.focus({ preventScroll: true });
  }, [disabled]);
  const press = (digit: string) => {
    if (disabled) return;
    onChange(digit === "del" ? value.slice(0, -1) : (value + digit).slice(0, max));
    input.current?.focus({ preventScroll: true });
  };
  return (
    <div className="mx-auto max-w-[280px] space-y-5">
      <label className="block text-center text-sm font-medium">
        {label}
        <input
          ref={input}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          aria-label={label}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(normalizePinInput(event.target.value, max))}
          dir="ltr"
          placeholder="••••••"
          className="mt-2 min-h-14 w-full rounded-2xl border border-border bg-card px-3 text-center text-2xl tracking-[0.45em] shadow-card outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
        />
        <span className="mt-2 block text-xs font-normal leading-5 text-muted-foreground">
          اكتب {max} أرقام أو استخدم الأزرار
        </span>
      </label>
      <div dir="ltr" className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((digit) =>
          digit ? (
            <button
              key={digit}
              type="button"
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => press(digit)}
              className={`grid h-14 place-items-center rounded-2xl bg-card font-bold shadow-card transition-transform active:scale-95 disabled:opacity-50 ${digit === "del" ? "text-sm text-muted-foreground" : "text-xl"}`}
            >
              {digit === "del" ? "حذف" : digit}
            </button>
          ) : (
            <div key="space" />
          ),
        )}
      </div>
    </div>
  );
}
