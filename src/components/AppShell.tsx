import { Link, useLocation } from "@tanstack/react-router";
import { Home, NotebookText, CheckSquare, Settings, Plus, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useTaskReminders } from "@/hooks/use-task-reminders";

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

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  useTaskReminders();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-md pb-28">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          {nav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            if (item.primary) {
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="-mt-8 grid h-14 w-14 shrink-0 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-fab transition-transform active:scale-95"
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
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors ${
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