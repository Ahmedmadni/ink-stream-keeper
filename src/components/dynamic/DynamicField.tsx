import { useState } from "react";
import { X } from "lucide-react";
import type { FieldSchema } from "@/lib/engine/types";
import { cn } from "@/lib/utils";
import { DictateButton } from "@/components/speech/DictateButton";

/**
 * Single-field renderer. Controlled — receives value + onChange.
 * Covers every field type listed in the engine; unknown types fall back to text.
 */
export function DynamicField({
  field, value, onChange, error,
}: {
  field: FieldSchema;
  value: unknown;
  onChange: (next: unknown) => void;
  error?: string;
}) {
  const baseCls = "w-full rounded-2xl bg-card px-4 py-3 text-sm outline-none shadow-card focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/60";
  const readOnly = field.readOnly;

  const wrap = (children: React.ReactNode) => (
    <div className={cn("flex flex-col gap-1.5", colSpan(field.width))}>
      <label className="flex items-center justify-between text-xs font-bold text-muted-foreground">
        <span>{field.label}{field.required ? <span className="text-destructive"> *</span> : null}</span>
      </label>
      {children}
      {field.help ? <p className="text-[10px] text-muted-foreground">{field.help}</p> : null}
      {error ? <p className="text-[11px] font-semibold text-destructive">{error}</p> : null}
    </div>
  );

  switch (field.type) {
    case "textarea":
      return wrap(
        <div className="flex items-start gap-2">
          <textarea
            value={(value as string) ?? ""} readOnly={readOnly}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder} rows={4}
            className={cn(baseCls, "resize-y")}
          />
          {!readOnly && (
            <DictateButton size="sm" live onText={(t) => onChange(appendText(value as string, t))} />
          )}
        </div>,
      );

    case "rich_text":
      return wrap(
        <div className="flex items-start gap-2">
          <textarea
            value={(value as string) ?? ""} readOnly={readOnly}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? "نص غني..."} rows={6}
            className={cn(baseCls, "resize-y font-mono text-xs")}
          />
          {!readOnly && (
            <DictateButton size="sm" live onText={(t) => onChange(appendText(value as string, t))} />
          )}
        </div>,
      );

    case "number": case "money": case "currency": case "duration":
      return wrap(
        <input
          type="number" inputMode="decimal" readOnly={readOnly}
          value={(value as string | number) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder} className={baseCls}
        />,
      );

    case "progress": case "rating": {
      const max = field.type === "rating" ? 5 : 100;
      const num = Number(value ?? 0);
      return wrap(
        <div className="rounded-2xl bg-card p-3 shadow-card">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold">
            <span>{num}{field.type === "progress" ? "%" : `/${max}`}</span>
          </div>
          <input type="range" min={0} max={max} value={num}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-primary" />
        </div>,
      );
    }

    case "date":
      return wrap(<input type="date" value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)} className={baseCls} />);
    case "time":
      return wrap(<input type="time" value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)} className={baseCls} />);
    case "datetime":
      return wrap(<input type="datetime-local" value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)} className={baseCls} />);

    case "color":
      return wrap(<input type="color" value={(value as string) || "#1e40af"}
        onChange={(e) => onChange(e.target.value)} className="h-12 w-full rounded-2xl bg-card shadow-card" />);

    case "select": case "radio":
      return wrap(
        <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}
          className={cn(baseCls, "font-semibold")}>
          {!field.required && <option value="">—</option>}
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>,
      );

    case "multi_select":
      return wrap(
        <MultiSelect options={field.options ?? []} value={(value as string[]) ?? []} onChange={(v) => onChange(v)} />,
      );

    case "checkbox": case "switch":
      return wrap(
        <label className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-card">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          <span className="text-sm">{field.placeholder ?? "تفعيل"}</span>
        </label>,
      );

    case "tags":
      return wrap(<TagsInput value={(value as string[]) ?? []} onChange={(v) => onChange(v)} placeholder={field.placeholder} />);

    case "url": case "email": case "phone":
      return wrap(
        <input type={field.type === "phone" ? "tel" : field.type}
          value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder} className={baseCls} />,
      );

    case "icon":
      return wrap(<input type="text" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}
        placeholder="اسم أيقونة Lucide" className={baseCls} />);

    case "image": case "gallery": case "attachment":
    case "checklist": case "subtasks":
    case "location": case "barcode": case "date_range":
      return wrap(
        <div className="rounded-2xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground shadow-card">
          هذا الحقل ({field.type}) يُعرض في صفحة التفاصيل عبر مكوّن مخصص.
        </div>,
      );

    default:
      return wrap(<input type="text" value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={baseCls} />);
  }
}

function colSpan(w?: 1 | 2 | 3 | 4) {
  switch (w) {
    case 1: return "sm:col-span-1";
    case 2: return "sm:col-span-1";
    case 3: return "sm:col-span-2";
    default: return "sm:col-span-2";
  }
}

function TagsInput({ value, onChange, placeholder }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t || value.includes(t)) return;
    onChange([...value, t]); setDraft("");
  };
  return (
    <div className="rounded-2xl bg-card p-2 shadow-card">
      <div className="flex flex-wrap gap-1.5">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="grid size-4 place-items-center rounded-full hover:bg-primary/20">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? "أضف وسماً..."}
          className="min-w-[8ch] flex-1 bg-transparent px-2 py-1 text-sm outline-none"
        />
      </div>
    </div>
  );
}

function MultiSelect({ options, value, onChange }: {
  options: { value: string; label: React.ReactNode }[];
  value: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl bg-card p-3 shadow-card">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button key={o.value} type="button" onClick={() => toggle(o.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition",
              on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
            )}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
function appendText(prev: string | undefined | null, next: string): string {
  const base = (prev ?? "").trim();
  return base ? `${base} ${next}` : next;
}
