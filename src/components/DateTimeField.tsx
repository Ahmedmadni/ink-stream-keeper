import { CalendarDays, X } from "lucide-react";
import { formatTaskDateTime } from "@/features/tasks/task-rules";

/** Show an unambiguous Arabic date while retaining Android's native picker. */
export function DateTimeField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1" dir="rtl">
      <label className="relative flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl bg-background px-3">
        <CalendarDays className="size-5 shrink-0 text-muted-foreground" />
        <span aria-hidden className="min-w-0 text-sm font-medium leading-6">
          {formatTaskDateTime(value)}
        </span>
        <input
          aria-label={label}
          type="datetime-local"
          lang="ar"
          dir="ltr"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      {value && (
        <button
          type="button"
          aria-label={`مسح ${label}`}
          onClick={() => onChange("")}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-background"
        >
          <X className="size-5" />
        </button>
      )}
    </div>
  );
}
