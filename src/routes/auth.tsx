import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "MemoFlow — تسجيل الدخول" },
      { name: "description", content: "سجّل دخولك أو أنشئ حسابًا جديدًا في MemoFlow لمزامنة ملاحظاتك ومهامك." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<null | "email" | "google" | "apple">(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const onEmail = async () => {
    setError(null);
    setBusy("email");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await router.invalidate();
      navigate({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(null);
    }
  };

  const oauth = async (provider: "google" | "apple") => {
    setError(null);
    setBusy(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      if (result.redirected) return;
      await router.invalidate();
      navigate({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تسجيل الدخول");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-dvh bg-background gradient-soft px-5 py-10 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-3xl gradient-primary text-3xl text-primary-foreground shadow-fab">
            📝
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">MemoFlow</h1>
          <p className="mt-1 text-sm text-muted-foreground">ملاحظاتك ومهامك، في مكان واحد آمن.</p>
        </div>

        <div className="rounded-3xl bg-card p-6 shadow-elevated">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1 text-sm font-bold">
            <button onClick={() => setMode("signin")} className={`rounded-lg py-2 transition-colors ${mode === "signin" ? "bg-card text-foreground shadow-card" : "text-muted-foreground"}`}>تسجيل الدخول</button>
            <button onClick={() => setMode("signup")} className={`rounded-lg py-2 transition-colors ${mode === "signup" ? "bg-card text-foreground shadow-card" : "text-muted-foreground"}`}>حساب جديد</button>
          </div>

          {mode === "signup" && (
            <Field label="الاسم">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك الكامل" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" />
            </Field>
          )}
          <Field label="البريد الإلكتروني" icon={<Mail className="size-4 text-muted-foreground" />}>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" dir="ltr" />
          </Field>
          <Field label="كلمة المرور" icon={<Lock className="size-4 text-muted-foreground" />}>
            <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" dir="ltr" />
          </Field>

          {error && <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</p>}

          <button
            onClick={onEmail}
            disabled={busy !== null || !email || !password}
            className="mt-4 grid w-full place-items-center rounded-2xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-fab disabled:opacity-60"
          >
            {busy === "email" ? <Loader2 className="size-5 animate-spin" /> : mode === "signup" ? "إنشاء الحساب" : "دخول"}
          </button>

          <div className="my-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[11px] text-muted-foreground">
            <span className="h-px bg-border" /><span>أو</span><span className="h-px bg-border" />
          </div>

          <div className="grid gap-2">
            <OAuthBtn onClick={() => oauth("google")} busy={busy === "google"} disabled={busy !== null}>
              <GoogleIcon /> المتابعة عبر Google
            </OAuthBtn>
            <OAuthBtn onClick={() => oauth("apple")} busy={busy === "apple"} disabled={busy !== null}>
              <AppleIcon /> المتابعة عبر Apple
            </OAuthBtn>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          بالتسجيل، أنت توافق على شروط استخدام MemoFlow وسياسة الخصوصية.
        </p>
      </div>
    </main>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="mt-3 block">
      <span className="mb-1.5 block text-[11px] font-bold text-muted-foreground">{label}</span>
      <span className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        {icon}
        {children}
      </span>
    </label>
  );
}

function OAuthBtn({ onClick, busy, disabled, children }: { onClick: () => void; busy?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="grid w-full grid-cols-[auto_1fr] items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold text-foreground shadow-card transition-colors hover:bg-secondary disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-5 animate-spin" /> : <span className="grid size-5 place-items-center">{Array.isArray(children) ? children[0] : null}</span>}
      <span className="text-center">{Array.isArray(children) ? children[1] : children}</span>
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <path d="M16.36 1.43c0 1.14-.43 2.21-1.29 3.21-1.04 1.21-2.3 1.91-3.66 1.8a3.69 3.69 0 0 1-.03-.46c0-1.1.5-2.27 1.36-3.25.43-.48.99-.88 1.66-1.21.66-.32 1.29-.5 1.89-.54l.07.45zM21 17.27c-.34.78-.74 1.5-1.21 2.18-.64.92-1.16 1.56-1.57 1.91-.63.58-1.31.87-2.04.88-.52.02-1.16-.15-1.9-.5-.74-.35-1.42-.52-2.04-.52-.65 0-1.35.17-2.1.52-.75.35-1.36.53-1.83.54-.7.03-1.39-.27-2.07-.9-.44-.4-.97-1.06-1.6-2-.66-1-1.21-2.15-1.64-3.47-.46-1.43-.69-2.81-.69-4.15 0-1.53.33-2.85.99-3.96a5.78 5.78 0 0 1 2.09-2.13c.86-.5 1.79-.76 2.79-.77.55 0 1.27.17 2.17.5.9.34 1.48.51 1.74.51.19 0 .83-.2 1.93-.6 1.04-.37 1.92-.52 2.64-.46 1.95.16 3.41.93 4.39 2.32-1.74 1.05-2.61 2.53-2.59 4.42 0 1.47.54 2.7 1.6 3.67.48.46 1.02.81 1.62 1.06-.13.37-.27.73-.42 1.08z"/>
    </svg>
  );
}