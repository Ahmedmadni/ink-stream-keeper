import type { ReactNode } from "react";
import { Loader2, AlertCircle, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScaleIn } from "@/components/motion";

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
  illustration,
  title,
  description,
  action,
}: {
  icon?: typeof Inbox;
  illustration?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <ScaleIn className="mx-auto flex max-w-sm flex-col items-center justify-center gap-3 p-8 text-center">
      {illustration ?? (
        <div className="grid size-16 place-items-center rounded-2xl bg-primary-soft text-primary" aria-hidden>
          <Icon className="size-8" />
        </div>
      )}
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </ScaleIn>
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

export type SkeletonVariant = "list" | "card" | "task" | "note" | "plan";

export function SkeletonList({ rows = 4, variant = "list" }: { rows?: number; variant?: SkeletonVariant }) {
  const items = Array.from({ length: rows });
  return (
    <div className="space-y-3 p-4" aria-hidden aria-busy="true">
      {items.map((_, i) => {
        if (variant === "task") {
          return (
            <div key={i} className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
              <Skeleton className="size-5 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          );
        }
        if (variant === "note") {
          return (
            <div key={i} className="rounded-2xl bg-card p-4 shadow-card">
              <Skeleton className="mb-2 h-5 w-2/3" />
              <Skeleton className="mb-1 h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          );
        }
        if (variant === "plan") {
          return (
            <div key={i} className="rounded-2xl bg-card p-4 shadow-card">
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="mt-3 h-2 w-full rounded-full" />
            </div>
          );
        }
        return (
          <div key={i} className="rounded-2xl bg-card p-4 shadow-card">
            <Skeleton className="mb-2 h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        );
      })}
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