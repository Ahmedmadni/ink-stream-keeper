import { Link, useLocation } from "@tanstack/react-router";
import { Home, NotebookText, CheckSquare, Settings, ShieldCheck, Plus } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useProfile } from "@/lib/data";
import { useTaskReminders } from "@/hooks/use-task-reminders";
import { CommandPalette } from "@/components/CommandPalette";
import { PageFade } from "@/components/motion";
import { BrandMark } from "@/components/BrandMark";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { OfflineModeNotice } from "@/components/OfflineModeNotice";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/", label: "الرئيسية", icon: Home, exact: true },
  { to: "/notes", label: "المذكرات", icon: NotebookText, exact: false },
  { to: "/tasks", label: "المهام", icon: CheckSquare, exact: false },
  { to: "/vault", label: "الخزنة", icon: ShieldCheck, exact: false },
  { to: "/settings", label: "الإعدادات", icon: Settings, exact: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const workspace = /^\/notes\/[^/]+$/.test(pathname);
  useTaskReminders();
  const { data: profile } = useProfile();
  useEffect(() => {
    if (profile) document.documentElement.classList.toggle("dark", profile.theme === "dark");
  }, [profile]);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <CommandPalette />
      <div className={workspace ? "w-full md:grid md:grid-cols-[72px_minmax(0,1fr)]" : "mx-auto max-w-6xl md:grid md:grid-cols-[220px_minmax(0,1fr)]"}>
        <aside className={"sticky top-0 hidden h-dvh border-e border-border md:flex md:flex-col " + (workspace ? "items-center px-2 py-4" : "px-4 py-8")}>
          <Link to="/" aria-label="MemoFlow — الرئيسية" title="الرئيسية" className={"flex items-center gap-3 text-xl font-semibold " + (workspace ? "mb-6" : "mb-10 px-3")}>
            <BrandMark />
            {!workspace && <span dir="ltr">MemoFlow</span>}
          </Link>
          <nav aria-label="التنقل الجانبي" className="space-y-2">
            {nav.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? pathname === to : pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  aria-label={label} title={label}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg ${workspace ? "size-12 justify-center" : "px-4 py-3"} text-sm font-medium transition-colors ${active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-secondary"}`}
                >
                  <Icon className="size-5" />
                  {!workspace && label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main
          id="main"
          className="min-w-0 pb-[calc(env(safe-area-inset-bottom)+6rem)] safe-x md:pb-12"
        >
          <div className={"mx-auto flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)] sm:px-5 " + (workspace ? "md:pt-2" : "max-w-3xl md:pt-8")}>
            <Link
              to="/"
              className="flex items-center gap-2 text-sm font-semibold md:hidden"
              dir="ltr"
            >
              <BrandMark className="size-8" /> MemoFlow
            </Link>
            <ConnectionStatus />
            {pathname !== "/" && !pathname.startsWith("/notes") && !pathname.startsWith("/tasks") && !pathname.startsWith("/create") && (
              <Button asChild variant="ghost" size="icon" className="size-11 shrink-0 rounded-lg md:hidden">
                <Link to="/create" aria-label="إضافة جديدة" title="إضافة جديدة"><Plus aria-hidden="true" /></Link>
              </Button>
            )}
          </div>
          <OfflineModeNotice />
          <PageFade key={pathname} className={workspace ? "mx-auto w-full" : "mx-auto max-w-3xl"}>
            {children}
          </PageFade>
        </main>
      </div>
      <nav
        aria-label="التنقل الرئيسي"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-xl safe-bottom safe-x md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 py-2 sm:gap-2 sm:px-4">
          {nav.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                aria-label={label} title={label}
                aria-current={active ? "page" : undefined}
                className={`flex ${workspace ? "min-h-11" : "min-h-14"} flex-col items-center justify-center gap-1 rounded-2xl text-xs font-medium transition-colors ${active ? "bg-primary-soft text-primary" : "text-muted-foreground"}`}
              >
                <Icon className="size-6" strokeWidth={active ? 2.25 : 1.75} />
                {!workspace && <span>{label}</span>}
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
        <h1 className="break-words text-2xl font-semibold leading-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
