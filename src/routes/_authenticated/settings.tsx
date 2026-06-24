import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fingerprint, Lock, Moon, Bell, Cloud, Globe, Info, ChevronLeft, Shield, Download, LogOut, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useProfile, useUpdateProfile } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "MemoFlow — الإعدادات" },
      { name: "description", content: "خصص التطبيق: الحساب، الوضع الداكن، الإشعارات، المزامنة." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [dark, setDark] = useState(profile?.theme === "dark");
  const [biometric, setBiometric] = useState(true);
  const [notifs, setNotifs] = useState(true);
  const [sync, setSync] = useState(true);
  const [name, setName] = useState(profile?.display_name ?? "");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setDark(profile?.theme === "dark");
    setName(profile?.display_name ?? "");
    if (profile?.theme === "dark") document.documentElement.classList.add("dark");
  }, [profile?.id]);

  const onSignOut = async () => {
    setSigningOut(true);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const userName = profile?.display_name?.trim() || "MemoFlow";

  return (
    <AppShell>
      <PageHeader title="الإعدادات" />

      <div className="px-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl gradient-primary p-4 text-primary-foreground shadow-elevated">
          <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white/20 text-lg font-bold">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="size-full object-cover" /> : userName.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold">{userName}</p>
            <p className="truncate text-xs opacity-90">حساب MemoFlow</p>
          </div>
          <ChevronLeft className="size-5" />
        </div>
      </div>

      <Group title="الملف الشخصي">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Globe className="size-4" /></div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك المعروض" className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-muted-foreground/60" />
          <button onClick={() => updateProfile.mutate({ display_name: name })} disabled={updateProfile.isPending || name === (profile?.display_name ?? "")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50">
            {updateProfile.isPending ? "..." : "حفظ"}
          </button>
        </div>
      </Group>

      <Group title="الأمان">
        <Toggle icon={Fingerprint} label="القفل بالبصمة" desc="استخدم بصمتك لفتح التطبيق" value={biometric} onChange={setBiometric} />
        <Toggle icon={Lock} label="رمز PIN" desc="رمز سريع من 4-6 أرقام" value={false} onChange={() => {}} />
        <Toggle icon={Shield} label="إخفاء محتوى الإشعارات" desc="على شاشة القفل" value={true} onChange={() => {}} />
      </Group>

      <Group title="المظهر والإشعارات">
        <Toggle icon={Moon} label="الوضع الداكن" desc="مريح للقراءة الليلية" value={dark} onChange={(v) => {
          setDark(v);
          document.documentElement.classList.toggle("dark", v);
          updateProfile.mutate({ theme: v ? "dark" : "light" });
        }} />
        <Toggle icon={Bell} label="الإشعارات الذكية" desc="تذكيرات للمهام والتواريخ" value={notifs} onChange={setNotifs} />
      </Group>

      <Group title="البيانات">
        <Toggle icon={Cloud} label="المزامنة السحابية" desc="مفعّلة عبر Lovable Cloud" value={sync} onChange={setSync} />
        <Row icon={Download} label="تصدير البيانات" desc="JSON أو PDF" />
      </Group>

      <Group title="الحساب">
        <button onClick={onSignOut} disabled={signingOut} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-right transition-colors hover:bg-destructive/10">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-destructive/15 text-destructive">
            {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-destructive">تسجيل الخروج</p>
            <p className="truncate text-[11px] text-muted-foreground">سيتم مسح الجلسة من هذا الجهاز</p>
          </div>
        </button>
      </Group>

      <Group title="عن التطبيق">
        <Row icon={Info} label="MemoFlow" desc="الإصدار 1.0.0" />
      </Group>
    </AppShell>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 pt-6">
      <h2 className="mb-2 px-1 text-xs font-bold text-muted-foreground">{title}</h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-card">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, label, desc }: { icon: typeof Lock; label: string; desc?: string }) {
  return (
    <button className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-right transition-colors hover:bg-secondary">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="size-4" /></div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{label}</p>
        {desc && <p className="truncate text-[11px] text-muted-foreground">{desc}</p>}
      </div>
      <ChevronLeft className="size-4 text-muted-foreground" />
    </button>
  );
}

function Toggle({ icon: Icon, label, desc, value, onChange }: { icon: typeof Lock; label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="size-4" /></div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{label}</p>
        {desc && <p className="truncate text-[11px] text-muted-foreground">{desc}</p>}
      </div>
      <button role="switch" aria-checked={value} onClick={() => onChange(!value)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? "bg-primary" : "bg-border"}`}>
        <span className={`absolute top-0.5 grid size-5 place-items-center rounded-full bg-white shadow transition-all ${value ? "right-0.5" : "right-[22px]"}`} />
      </button>
    </div>
  );
}