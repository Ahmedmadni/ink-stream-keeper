import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, KeyRound, Mail, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import {
  beginNativeOAuth,
  consumeNativeAuthError,
  isNativeAuthAvailable,
  isNativeOAuthAvailable,
  nativeEmailConfirmationRedirectUrl,
  nativeRecoveryHandoffUrl,
  nativeRecoveryRedirectUrl,
} from "@/services/native-auth";
import { desktopBridge } from "@/services/desktop";

type AuthMode = "signin" | "signup" | "forgot" | "reset";

function readableAuthError(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : "حدث خطأ غير متوقع";
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  }
  if (normalized.includes("email not confirmed")) {
    return "يجب تأكيد البريد الإلكتروني أولًا، ثم محاولة تسجيل الدخول مجددًا";
  }
  if (normalized.includes("user already registered")) {
    return "هذا البريد مسجل بالفعل؛ استخدم تسجيل الدخول أو استعادة كلمة المرور";
  }
  if (normalized.includes("password should be at least")) {
    return "كلمة المرور يجب ألا تقل عن 8 أحرف";
  }
  if (normalized.includes("email rate limit exceeded")) {
    return "تم إرسال محاولات كثيرة إلى هذا البريد؛ انتظر قليلًا ثم حاول مجددًا";
  }
  return message;
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "MemoFlow — تسجيل الدخول" },
      {
        name: "description",
        content: "سجّل دخولك أو أنشئ حسابًا جديدًا في MemoFlow لمزامنة ملاحظاتك ومهامك.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const recoverInBrowser = desktopBridge()?.isWindowsStore === true;
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<null | "email" | "google" | "apple" | "recovery" | "reset">(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    const callbackError = consumeNativeAuthError();
    if (callbackError) setError(callbackError);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("recovery") === "1" || params.get("native_recovery") === "1") return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const webRecovery = params.get("recovery") === "1";
    const nativeHandoff = params.get("native_recovery") === "1" && !isNativeAuthAvailable();
    if (!webRecovery && !nativeHandoff) return;
    let active = true;
    const receive = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session) return;
      if (nativeHandoff) {
        const url = nativeRecoveryHandoffUrl(data.session.access_token, data.session.refresh_token);
        setHandoffUrl(url);
        window.location.replace(url);
      } else {
        setMode("reset");
      }
    };
    void receive();
    const { data: auth } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") void receive();
    });
    return () => {
      active = false;
      auth.subscription.unsubscribe();
    };
  }, []);

  const onEmail = async () => {
    setError(null);
    setNotice(null);
    setBusy("email");
    try {
      const normalizedEmail = email.trim();
      if (!normalizedEmail) throw new Error("أدخل البريد الإلكتروني");
      if (mode === "signup") {
        if (password.length < 8) throw new Error("كلمة المرور يجب ألا تقل عن 8 أحرف");
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: isNativeAuthAvailable()
              ? nativeEmailConfirmationRedirectUrl()
              : window.location.origin,
            data: { name },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setPassword("");
          setMode("signin");
          setNotice(
            "تم إنشاء الحساب. افتح رسالة التأكيد في بريدك، ثم ارجع إلى MemoFlow وسجّل الدخول.",
          );
          return;
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
        if (!data.session) throw new Error("لم تُنشأ جلسة تسجيل الدخول؛ حاول مرة أخرى");
      }
      await router.invalidate();
      await navigate({ to: "/" });
    } catch (e) {
      setError(readableAuthError(e));
    } finally {
      setBusy(null);
    }
  };

  const requestPasswordReset = async () => {
    setError(null);
    setNotice(null);
    setBusy("recovery");
    try {
      const normalizedEmail = email.trim();
      if (!normalizedEmail) throw new Error("أدخل البريد الإلكتروني");
      const redirectTo = isNativeAuthAvailable()
        ? nativeRecoveryRedirectUrl()
        : new URL("/auth?recovery=1", window.location.origin).toString();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
      if (error) throw error;
      setNotice(
        recoverInBrowser
          ? "أرسلنا رابط الاستعادة إن كان البريد مسجلًا. افتحه في المتصفح لتغيير كلمة المرور، ثم سجّل الدخول هنا."
          : "أرسلنا رابط الاستعادة إن كان البريد مسجلًا. افتحه على هذا الهاتف للعودة إلى MemoFlow.",
      );
    } catch (reason) {
      setError(readableAuthError(reason));
    } finally {
      setBusy(null);
    }
  };

  const updatePassword = async () => {
    setError(null);
    setNotice(null);
    if (password.length < 8) {
      setError("كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف");
      return;
    }
    if (password !== repeatPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    setBusy("reset");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setRepeatPassword("");
      await router.invalidate();
      await navigate({ to: "/" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحديث كلمة المرور");
    } finally {
      setBusy(null);
    }
  };

  const oauth = async (provider: "google" | "apple") => {
    setError(null);
    setBusy(provider);
    try {
      if (isNativeOAuthAvailable()) {
        await beginNativeOAuth(provider);
        return;
      }
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
      setError(readableAuthError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-dvh bg-background gradient-soft px-4 py-6 sm:px-5 sm:py-10 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center sm:mb-8">
          <img
            src="/icon.svg"
            alt=""
            className="mx-auto size-14 rounded-2xl shadow-fab sm:size-16 sm:rounded-3xl"
          />
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:mt-4 sm:text-3xl">
            MemoFlow
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">ملاحظاتك ومهامك، في مكان واحد آمن.</p>
        </div>

        <div className="rounded-2xl bg-card p-5 shadow-elevated sm:rounded-3xl sm:p-6">
          {handoffUrl ? (
            <div className="py-3 text-center">
              <Loader2 className="mx-auto size-6 animate-spin text-primary" />
              <h2 className="mt-4 text-lg font-bold">العودة إلى تطبيق MemoFlow</h2>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                إذا لم يُفتح التطبيق تلقائيًا، استخدم الزر التالي.
              </p>
              <a
                href={handoffUrl}
                className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground"
              >
                فتح MemoFlow
              </a>
            </div>
          ) : mode === "forgot" ? (
            <div>
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setNotice(null);
                }}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <ArrowRight className="size-4" /> العودة لتسجيل الدخول
              </button>
              <KeyRound className="mx-auto mt-4 size-8 text-primary" />
              <h2 className="mt-3 text-center text-lg font-bold">استعادة كلمة المرور</h2>
              <p className="mt-2 text-center text-xs leading-6 text-muted-foreground">
                {recoverInBrowser
                  ? "سنرسل رابطًا آمنًا إلى بريدك لتغيير كلمة المرور في المتصفح، ثم يمكنك تسجيل الدخول هنا."
                  : "سنرسل رابطًا آمنًا إلى بريدك، ثم يعيدك إلى التطبيق لاختيار كلمة مرور جديدة."}
              </p>
              <Field
                label="البريد الإلكتروني"
                icon={<Mail className="size-4 text-muted-foreground" />}
              >
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  dir="ltr"
                />
              </Field>
              <AuthMessage error={error} notice={notice} />
              <button
                type="button"
                onClick={requestPasswordReset}
                disabled={busy !== null || !email.trim()}
                className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-40"
              >
                {busy === "recovery" ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  "إرسال رابط الاستعادة"
                )}
              </button>
            </div>
          ) : mode === "reset" ? (
            <div>
              <KeyRound className="mx-auto size-8 text-primary" />
              <h2 className="mt-3 text-center text-lg font-bold">كلمة مرور جديدة</h2>
              <p className="mt-2 text-center text-xs leading-6 text-muted-foreground">
                اختر كلمة قوية لا تقل عن 8 أحرف.
              </p>
              <Field
                label="كلمة المرور الجديدة"
                icon={<Lock className="size-4 text-muted-foreground" />}
              >
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                  dir="ltr"
                />
              </Field>
              <Field
                label="تأكيد كلمة المرور"
                icon={<Lock className="size-4 text-muted-foreground" />}
              >
                <input
                  type="password"
                  autoComplete="new-password"
                  value={repeatPassword}
                  onChange={(event) => setRepeatPassword(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                  dir="ltr"
                />
              </Field>
              <AuthMessage error={error} notice={notice} />
              <button
                type="button"
                onClick={updatePassword}
                disabled={busy !== null || password.length < 8 || password !== repeatPassword}
                className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-40"
              >
                {busy === "reset" ? <Loader2 className="size-5 animate-spin" /> : "حفظ كلمة المرور"}
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1 text-sm font-bold">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={`rounded-lg py-2 transition-colors ${mode === "signin" ? "bg-card text-foreground shadow-card" : "text-muted-foreground"}`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`rounded-lg py-2 transition-colors ${mode === "signup" ? "bg-card text-foreground shadow-card" : "text-muted-foreground"}`}
                >
                  حساب جديد
                </button>
              </div>

              {mode === "signup" && (
                <Field label="الاسم">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="اسمك الكامل"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                </Field>
              )}
              <Field
                label="البريد الإلكتروني"
                icon={<Mail className="size-4 text-muted-foreground" />}
              >
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  dir="ltr"
                />
              </Field>
              <Field label="كلمة المرور" icon={<Lock className="size-4 text-muted-foreground" />}>
                <input
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  dir="ltr"
                />
              </Field>
              <AuthMessage error={error} notice={notice} />
              <button
                type="button"
                onClick={onEmail}
                disabled={busy !== null || !email || !password}
                className="mt-4 grid min-h-12 w-full place-items-center rounded-2xl gradient-primary px-4 text-sm font-bold text-primary-foreground shadow-fab disabled:opacity-60"
              >
                {busy === "email" ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : mode === "signup" ? (
                  "إنشاء الحساب"
                ) : (
                  "دخول"
                )}
              </button>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError(null);
                    setNotice(null);
                    setPassword("");
                  }}
                  className="mx-auto mt-3 block text-xs font-medium text-primary"
                >
                  نسيت كلمة المرور؟
                </button>
              )}
              <div className="my-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[11px] text-muted-foreground">
                <span className="h-px bg-border" />
                <span>أو</span>
                <span className="h-px bg-border" />
              </div>
              <div className="grid gap-2">
                <OAuthBtn
                  onClick={() => oauth("google")}
                  busy={busy === "google"}
                  disabled={busy !== null}
                >
                  <GoogleIcon /> المتابعة عبر Google
                </OAuthBtn>
                <OAuthBtn
                  onClick={() => oauth("apple")}
                  busy={busy === "apple"}
                  disabled={busy !== null}
                >
                  <AppleIcon /> المتابعة عبر Apple
                </OAuthBtn>
              </div>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          بالتسجيل، أنت توافق على شروط استخدام MemoFlow وسياسة الخصوصية.
        </p>
      </div>
    </main>
  );
}

function AuthMessage({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error && (
        <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-3 rounded-lg bg-primary-soft px-3 py-2 text-xs font-semibold text-primary">
          {notice}
        </p>
      )}
    </>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
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

function OAuthBtn({
  onClick,
  busy,
  disabled,
  children,
}: {
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="grid w-full grid-cols-[auto_1fr] items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold text-foreground shadow-card transition-colors hover:bg-secondary disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <span className="grid size-5 place-items-center">
          {Array.isArray(children) ? children[0] : null}
        </span>
      )}
      <span className="text-center">{Array.isArray(children) ? children[1] : children}</span>
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <path d="M16.36 1.43c0 1.14-.43 2.21-1.29 3.21-1.04 1.21-2.3 1.91-3.66 1.8a3.69 3.69 0 0 1-.03-.46c0-1.1.5-2.27 1.36-3.25.43-.48.99-.88 1.66-1.21.66-.32 1.29-.5 1.89-.54l.07.45zM21 17.27c-.34.78-.74 1.5-1.21 2.18-.64.92-1.16 1.56-1.57 1.91-.63.58-1.31.87-2.04.88-.52.02-1.16-.15-1.9-.5-.74-.35-1.42-.52-2.04-.52-.65 0-1.35.17-2.1.52-.75.35-1.36.53-1.83.54-.7.03-1.39-.27-2.07-.9-.44-.4-.97-1.06-1.6-2-.66-1-1.21-2.15-1.64-3.47-.46-1.43-.69-2.81-.69-4.15 0-1.53.33-2.85.99-3.96a5.78 5.78 0 0 1 2.09-2.13c.86-.5 1.79-.76 2.79-.77.55 0 1.27.17 2.17.5.9.34 1.48.51 1.74.51.19 0 .83-.2 1.93-.6 1.04-.37 1.92-.52 2.64-.46 1.95.16 3.41.93 4.39 2.32-1.74 1.05-2.61 2.53-2.59 4.42 0 1.47.54 2.7 1.6 3.67.48.46 1.02.81 1.62 1.06-.13.37-.27.73-.42 1.08z" />
    </svg>
  );
}
