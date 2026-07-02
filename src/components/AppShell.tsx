import { Link, useLocation } from "@tanstack/react-router";
import { Home, NotebookText, CheckSquare, Settings, Plus, ShieldCheck, LayoutGrid, Target, ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useTaskReminders } from "@/hooks/use-task-reminders";
import { useIsTablet, usePanel, type PanelKind } from "@/hooks/use-panel";
import { useWorkspaces } from "@/lib/workspaces";
import { DetailPanel } from "@/components/DetailPanel";

type NavItem = {
  to: "/" | "/notes" | "/create" | "/tasks" | "/vault" | "/settings";
  label: string;
  icon: typeof Home;
  primary?: boolean;
};

const nav: NavItem[] = [
  { to: "/", label: "الرئيسية", icon: Home },
  { to: "/notes", label: "الملاحظات", icon: NotebookText },
  { to: "/create", label: "إنشاء", icon: Plus, primary: true },
  { to: "/tasks", label: "المهام", icon: CheckSquare },
  { to: "/vault", label: "الخزنة", icon: ShieldCheck },
  { to: "/settings", label: "إعدادات", icon: Settings },
];

// Tablet sidebar nav — flat list, no FAB.
const tabletNav: { to: NavItem["to"] | "/purchases" | "/plans" | "/workspaces"; label: string; icon: typeof Home }[] = [
  { to: "/", label: "الرئيسية", icon: Home },
  { to: "/notes", label: "الملاحظات", icon: NotebookText },
  { to: "/tasks", label: "المهام", icon: CheckSquare },
  { to: "/purchases", label: "المشتريات", icon: ShoppingBag },
  { to: "/plans", label: "الخطط", icon: Target },
  { to: "/workspaces", label: "مساحات العمل", icon: LayoutGrid },
  { to: "/vault", label: "الخزنة", icon: ShieldCheck },
  { to: "/settings", label: "الإعدادات", icon: Settings },
];

/** Intercepts detail links in tablet mode → open panel instead of full navigation. */
function usePanelLinkInterceptor(enabled: boolean) {
  const { select } = usePanel();
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href) return;
      const m = href.match(/^\/(notes|tasks|purchases|plans|workspaces)\/([^/?#]+)$/);
      if (!m) return;
      e.preventDefault();
      select({ kind: m[1] as PanelKind, id: decodeURIComponent(m[2]) });
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [enabled, select]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isTablet = useIsTablet();
  useTaskReminders();
  usePanelLinkInterceptor(isTablet);

  if (isTablet) return <TabletShell pathname={pathname}>{children}</TabletShell>;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main id="main" className="mx-auto max-w-md pb-[calc(env(safe-area-inset-bottom)+7rem)] safe-x">
        {children}
      </main>

      <nav
        aria-label="التنقل الرئيسي"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-bottom safe-x"
      >
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          {nav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            if (item.primary) {
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="-mt-8 grid h-14 w-14 shrink-0 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-fab transition-transform hover:scale-[1.03] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                  aria-label={item.label}
                >
                  <Icon className="size-7" strokeWidth={2.5} />
                </Link>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium tap-44 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function TabletShell({ children, pathname }: { children: ReactNode; pathname: string }) {
  const { data: workspaces = [] } = useWorkspaces();
  const { select } = usePanel();
  return (
    <div dir="ltr" className="grid min-h-dvh bg-background text-foreground grid-cols-[280px_minmax(0,1fr)_min(420px,32vw)]">
      {/* LEFT — Navigation + Workspaces */}
      <aside dir="rtl" className="sticky top-0 h-dvh overflow-y-auto border-e border-border bg-card/40 backdrop-blur">
        <div className="flex items-center gap-2 px-5 py-4">
          <div className="grid size-9 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-fab">
            <NotebookText className="size-5" />
          </div>
          <span className="text-lg font-extrabold tracking-tight">MemoFlow</span>
        </div>
        <nav aria-label="التنقل الجانبي" className="px-2 pb-4">
          <ul className="space-y-0.5">
            {tabletNav.map((item) => {
              const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors tap-44 ${
                      active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={active ? 2.5 : 2} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-6">
            <div className="flex items-center justify-between px-3 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">مساحات العمل</span>
              <Link to="/create" className="text-xs font-bold text-primary hover:underline">جديد</Link>
            </div>
            {workspaces.length === 0 ? (
              <p className="px-3 text-xs text-muted-foreground">لا توجد مساحات بعد.</p>
            ) : (
              <ul className="space-y-0.5">
                {workspaces.slice(0, 12).map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => select({ kind: "workspaces", id: w.id })}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-sm text-foreground hover:bg-muted"
                    >
                      <span className="text-base">{w.icon || "📁"}</span>
                      <span className="min-w-0 flex-1 truncate">{w.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </nav>
      </aside>

      {/* CENTER — the current route */}
      <main id="main" dir="rtl" className="min-w-0 overflow-y-auto max-h-dvh">
        <div className="mx-auto max-w-2xl pb-16">{children}</div>
      </main>

      {/* RIGHT — details panel */}
      <aside dir="rtl" className="sticky top-0 h-dvh overflow-hidden border-s border-border bg-card/30 backdrop-blur">
        <DetailPanel />
      </aside>
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
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 pb-2 pt-6">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}