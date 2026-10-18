import { Link, useLocation } from "@tanstack/react-router";
import { NotebookText, CheckSquare, Settings, ShieldCheck } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useProfile } from "@/lib/data";
import { useTaskReminders } from "@/hooks/use-task-reminders";
import { CommandPalette } from "@/components/CommandPalette";
import { PageFade } from "@/components/motion";

const nav = [
  { to: "/notes", label: "المذكرات", icon: NotebookText },
  { to: "/tasks", label: "المهام", icon: CheckSquare },
  { to: "/vault", label: "الخزنة", icon: ShieldCheck },
  { to: "/settings", label: "الإعدادات", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  useTaskReminders();
  const { data: profile } = useProfile();
  useEffect(() => {
    if (profile) document.documentElement.classList.toggle("dark", profile.theme === "dark");
  }, [profile]);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <CommandPalette />
      <div className="mx-auto max-w-6xl md:grid md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh border-e border-border px-4 py-8 md:flex md:flex-col">
          <Link to="/notes" className="mb-10 flex items-center gap-3 px-3 text-xl font-semibold">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <NotebookText className="size-5" />
            </span>
            <span dir="ltr">MemoFlow</span>
          </Link>
          <nav aria-label="التنقل الجانبي" className="space-y-2">
            {nav.map(({ to, label, icon: Icon }) => {
              const active = pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-secondary"}`}
                >
                  <Icon className="size-5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main
          id="main"
          className="min-w-0 pb-[calc(env(safe-area-inset-bottom)+6rem)] safe-x md:pb-12"
        >
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)] sm:px-5 md:pt-8">
            <Link
              to="/notes"
              className="text-sm font-semibold tracking-wide text-muted-foreground"
              dir="ltr"
            >
              MemoFlow
            </Link>
            <Link
              to="/settings"
              aria-label="الإعدادات"
              className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              <Settings className="size-5" />
            </Link>
          </div>
          <PageFade key={pathname} className="mx-auto max-w-3xl">
            {children}
          </PageFade>
        </main>
      </div>
      <nav
        aria-label="التنقل الرئيسي"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-xl safe-bottom safe-x md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2 sm:gap-2 sm:px-4">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-medium transition-colors ${active ? "bg-primary-soft text-primary" : "text-muted-foreground"}`}
              >
                <Icon className="size-6" strokeWidth={active ? 2.25 : 1.75} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 pb-4 pt-3 sm:px-5 sm:pb-6 sm:pt-4">
      <div className="min-w-0">
        <h1 className="text-[clamp(1.4rem,6vw,1.875rem)] font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
