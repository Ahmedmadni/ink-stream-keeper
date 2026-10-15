import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Moon, Bell, Lock, LogOut, ChevronLeft, Archive, Smartphone } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useProfile, useUpdateProfile } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { requestNotificationPermission } from "@/hooks/use-task-reminders";
import { lockVault } from "@/lib/vault";
import { toast } from "sonner";
import { BackupPanel } from "@/features/backup/BackupPanel";
import { AppLockSettings } from "@/components/AppLockSettings";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "MemoFlow — الإعدادات" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: profile, isError } = useProfile();
  const updateProfile = useUpdateProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pwa = usePwaInstall();
  const [signingOut, setSigningOut] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  return (
    <AppShell>
      <PageHeader
        title="الإعدادات"
        subtitle={profile?.display_name || "مساحة هادئة لأفكارك ومهامك"}
      />
      {isError && (
        <p role="alert" className="px-5 text-sm text-destructive">
          تعذر تحميل إعدادات الحساب.
        </p>
      )}
      <Group title="المظهر">
        <div className="flex items-center gap-3 p-4">
          <Moon className="size-5 text-primary" />
          <span className="flex-1 text-sm font-medium">الوضع الداكن</span>
          <button
            role="switch"
            aria-label="الوضع الداكن"
            aria-checked={profile?.theme === "dark"}
            disabled={!profile || updateProfile.isPending}
            onClick={() =>
              updateProfile.mutate(
                { theme: profile?.theme === "dark" ? "light" : "dark" },
                { onError: () => toast.error("تعذر حفظ المظهر") },
              )
            }
            className={`relative h-7 w-12 rounded-full disabled:opacity-50 ${profile?.theme === "dark" ? "bg-primary" : "bg-muted-foreground/30"}`}
          >
            <span
              className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-all ${profile?.theme === "dark" ? "right-1" : "right-6"}`}
            />
          </button>
        </div>
      </Group>
      <Group title="الخزنة والتذكيرات">
        <Link
          to="/vault"
          onClick={() => lockVault()}
          className="flex min-h-16 items-center gap-3 p-4"
        >
          <Lock className="size-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">فتح الخزنة بالرمز</p>
            <p className="mt-1 text-xs text-muted-foreground">
              تُقفل عند إخفاء التطبيق وبعد 5 دقائق من الخمول.
            </p>
          </div>
          <ChevronLeft className="size-4 text-muted-foreground" />
        </Link>
        <button
          disabled={notificationBusy}
          onClick={async () => {
            setNotificationBusy(true);
            try {
              const permission = await requestNotificationPermission();
              if (permission === "granted") toast.success("تم السماح بإشعارات التذكير");
              else toast.info("يمكن السماح بالإشعارات من إعدادات الجهاز أو المتصفح.");
            } catch {
              toast.error("تعذر طلب إذن الإشعارات");
            } finally {
              setNotificationBusy(false);
            }
          }}
          className="flex min-h-16 w-full items-center gap-3 p-4 text-start disabled:opacity-50"
        >
          <Bell className="size-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">السماح بإشعارات التذكير</p>
            <p className="mt-1 text-xs text-muted-foreground">
              اختر موعد التذكير من تفاصيل المهمة.
            </p>
          </div>
          <ChevronLeft className="size-4 text-muted-foreground" />
        </button>
      </Group>
      <AppLockSettings />
      <BackupPanel />
      <Group title="بياناتك السابقة">
        <details className="p-4">
          <summary className="flex min-h-10 items-center gap-3 text-sm font-medium">
            <Archive className="size-5 text-primary" />
            الأقسام السابقة
          </summary>
          <p className="py-3 text-xs leading-6 text-muted-foreground">
            بيانات هذه الأقسام محفوظة. يمكنك فتحها هنا أثناء انتقال التطبيق إلى تنظيمه الجديد.
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { to: "/workspaces", label: "مساحات العمل" },
                { to: "/plans", label: "الخطط" },
                { to: "/purchases", label: "المشتريات" },
              ] as const
            ).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-xl bg-secondary px-4 py-3 text-sm"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </details>
      </Group>
      <Group title="التطبيق والحساب">
        {!pwa.installed && (
          <button
            onClick={async () => {
              const result = await pwa.promptInstall();
              if (result === "unavailable")
                toast.info("من قائمة المتصفح اختر تثبيت التطبيق، إذا كان متاحًا.");
            }}
            className="flex min-h-16 w-full items-center gap-3 p-4 text-start"
          >
            <Smartphone className="size-5 text-primary" />
            <span className="flex-1 text-sm font-medium">إضافة إلى الشاشة الرئيسية</span>
            <ChevronLeft className="size-4 text-muted-foreground" />
          </button>
        )}
        <button
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true);
            lockVault();
            try {
              await qc.cancelQueries();
              qc.clear();
              const { error } = await supabase.auth.signOut();
              if (error) throw error;
              await navigate({ to: "/auth", replace: true });
            } catch {
              toast.error("تعذر تسجيل الخروج. الخزنة مقفلة؛ حاول مجددًا.");
            } finally {
              setSigningOut(false);
            }
          }}
          className="flex min-h-16 w-full items-center gap-3 p-4 text-start text-destructive disabled:opacity-50"
        >
          <LogOut className="size-5" />
          <span className="text-sm font-medium">
            {signingOut ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"}
          </span>
        </button>
      </Group>
    </AppShell>
  );
}
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-5 pb-6">
      <h2 className="mb-2 px-1 text-xs font-medium text-muted-foreground">{title}</h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl bg-card">{children}</div>
    </section>
  );
}
