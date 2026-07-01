import type { ReactNode } from "react";
import { Loader2, AlertCircle, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared, tone-aware feedback primitives used across all pages to unify
 * loading / empty / error states. Wave 6.1.
 */

export function LoadingState({ label = "جاري التحميل..." }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 p-10 text-sm text-muted-foreground"
    >
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: typeof Inbox;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-3 p-8 text-center animate-fade-in">
      <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary" aria-hidden>
        <Icon className="size-7" />
      </div>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "حدث خطأ ما",
  description = "تعذر إتمام العملية. يرجى المحاولة مرة أخرى.",
  onRetry,
}: {
  title?: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-sm flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <div className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive" aria-hidden>
        <AlertCircle className="size-7" />
      </div>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-card transition-transform hover:scale-[1.02] active:scale-95 tap-44"
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-card p-4 shadow-card">
          <Skeleton className="mb-2 h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-card p-4 shadow-card ${className}`}>
      {(title || action) && (
        <header className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          {title && <h2 className="truncate text-sm font-bold text-foreground">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}