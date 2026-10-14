import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyRound,
  Lock,
  Unlock,
  ShieldCheck,
  Plus,
  Mail,
  Sparkles,
  Users,
  CreditCard,
  Briefcase,
  Fingerprint,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Pencil,
  X,
  Search,
  Check,
  Download,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "@/components/feedback";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  lockVault,
  revealPassword,
  useAddVaultCategory,
  useAddVaultEntry,
  useDeleteVaultEntry,
  useSetupVaultPin,
  useUnlockVault,
  useUpdateVaultEntry,
  useVaultCategories,
  useVaultEntries,
  useVaultLocked,
  useVaultSettings,
  type VaultCategory,
  type VaultEntry,
} from "@/lib/vault";
import { androidAutofill, type AutofillStatus } from "@/services/autofill";

export const Route = createFileRoute("/_authenticated/vault")({
  head: () => ({
    meta: [
      { title: "MemoFlow — خزنة كلمات السر" },
      { name: "description", content: "احفظ كلمات السر بأمان داخل خزنة مشفّرة محمية برمز سري." },
      { property: "og:title", content: "MemoFlow — خزنة كلمات السر" },
      {
        property: "og:description",
        content: "احفظ كلمات السر بأمان داخل خزنة مشفّرة محمية برمز سري.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VaultPage,
});

const iconMap: Record<string, typeof KeyRound> = {
  KeyRound,
  Mail,
  Sparkles,
  Users,
  CreditCard,
  Briefcase,
};

function toneBg(tone: string) {
  switch (tone) {
    case "warning":
      return "bg-warning/15 text-warning";
    case "success":
      return "bg-success/15 text-success";
    case "destructive":
      return "bg-destructive/15 text-destructive";
    case "accent":
      return "bg-accent text-accent-foreground";
    default:
      return "bg-primary-soft text-primary";
  }
}

function VaultPage() {
  const { data: settings, isLoading, isError, refetch } = useVaultSettings();
  const locked = useVaultLocked();

  if (isLoading) {
    return (
      <AppShell>
        <div className="px-5 pt-20 text-center text-sm text-muted-foreground">جاري التحميل...</div>
      </AppShell>
    );
  }
  if (isError)
    return (
      <AppShell>
        <ErrorState
          title="تعذر تحميل الخزنة"
          onRetry={() => {
            void refetch();
          }}
        />
      </AppShell>
    );
  if (!settings) return <SetupPin />;
  if (locked) return <UnlockScreen />;
  return <VaultHome />;
}

// ---------- PIN pad
function PinPad({
  value,
  onChange,
  max = 6,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  max?: number;
  disabled?: boolean;
}) {
  const press = (k: string) => {
    if (k === "del") return onChange(value.slice(0, -1));
    if (value.length >= max) return;
    onChange(value + k);
  };
  const dots = Array.from({ length: max }).map((_, i) => (
    <span
      key={i}
      className={`size-3.5 rounded-full transition-all ${
        i < value.length ? "bg-primary scale-110" : "bg-border"
      }`}
    />
  ));
  return (
    <div className="space-y-6">
      <div className="flex justify-center gap-3">{dots}</div>
      <div dir="ltr" className="mx-auto grid max-w-[260px] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => press(n)}
            className="grid h-14 place-items-center rounded-2xl bg-card text-xl font-bold shadow-card transition-transform active:scale-95"
          >
            {n}
          </button>
        ))}
        <div />
        <button
          type="button"
          disabled={disabled}
          onClick={() => press("0")}
          className="grid h-14 place-items-center rounded-2xl bg-card text-xl font-bold shadow-card transition-transform active:scale-95"
        >
          0
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => press("del")}
          className="grid h-14 place-items-center rounded-2xl bg-card text-sm font-bold text-muted-foreground shadow-card transition-transform active:scale-95"
        >
          حذف
        </button>
      </div>
    </div>
  );
}

// ---------- Setup
function SetupPin() {
  const [step, setStep] = useState<"first" | "confirm">("first");
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const setup = useSetupVaultPin();

  useEffect(() => {
    if (step === "first" && pin1.length === 6) setStep("confirm");
  }, [pin1, step]);

  useEffect(() => {
    if (step === "confirm" && pin2.length === 6) {
      if (pin1 !== pin2) {
        setErr("الرمز غير مطابق، حاول من جديد");
        setPin1("");
        setPin2("");
        setStep("first");
        return;
      }
      setErr(null);
      setup.mutate(
        { pin: pin1 },
        {
          onError: (error) => {
            setErr(error.message);
            setPin1("");
            setPin2("");
            setStep("first");
          },
        },
      );
    }
  }, [pin2, step]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppShell>
      <PageHeader title="إنشاء خزنة جديدة" subtitle="حدد رمز سري من 6 أرقام لحماية كلمات السر" />
      <div className="px-5 pt-4">
        <div className="rounded-2xl gradient-soft p-5 text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-elevated">
            <ShieldCheck className="size-7" />
          </div>
          <p className="text-sm font-bold">
            {step === "first" ? "اختر رمزًا سريًا (6 أرقام)" : "أعد إدخال الرمز للتأكيد"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            هذا الرمز يشفّر كلمات سرّك. لا يمكن استرجاعه إذا نسيته.
          </p>
        </div>

        <div className="pt-8">
          <PinPad
            disabled={setup.isPending}
            value={step === "first" ? pin1 : pin2}
            onChange={step === "first" ? setPin1 : setPin2}
          />
        </div>

        {err && <p className="mt-4 text-center text-xs font-semibold text-destructive">{err}</p>}
        {setup.isPending && (
          <p className="mt-4 text-center text-xs text-muted-foreground">جاري التشفير...</p>
        )}
        {setup.isError && (
          <p className="mt-4 text-center text-xs text-destructive">حدث خطأ، حاول مجددًا</p>
        )}
      </div>
    </AppShell>
  );
}

// ---------- Unlock
function UnlockScreen() {
  const { data: settings } = useVaultSettings();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const unlock = useUnlockVault();

  useEffect(() => {
    if (pin.length === 6 && settings) {
      unlock.mutate(
        { pin, settings },
        {
          onError: (error) => {
            setErr(error.message);
            setPin("");
          },
          onSuccess: () => {
            setErr(null);
            setPin("");
          },
        },
      );
    }
  }, [pin, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppShell>
      <PageHeader title="فتح الخزنة" subtitle="أدخل الرمز السري المكوّن من 6 أرقام" />
      <div className="px-5 pt-6">
        <div className="rounded-2xl gradient-soft p-5 text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-elevated">
            <Lock className="size-7" />
          </div>
          <p className="text-sm font-bold">الخزنة مقفلة</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            كلمات المرور مشفّرة. أدخل الرمز لفتح الخزنة.
          </p>
        </div>

        <div className="pt-8">
          <PinPad value={pin} onChange={setPin} disabled={unlock.isPending} />
        </div>
        {err && <p className="mt-4 text-center text-xs font-semibold text-destructive">{err}</p>}
        {unlock.isPending && (
          <p className="mt-4 text-center text-xs text-muted-foreground">جاري التحقق...</p>
        )}
      </div>
    </AppShell>
  );
}

// ---------- Home (unlocked)
function VaultHome() {
  const categoryQuery = useVaultCategories();
  const entryQuery = useVaultEntries();
  const categories = categoryQuery.data ?? [];
  const entries = useMemo(() => entryQuery.data ?? [], [entryQuery.data]);
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [editing, setEditing] = useState<VaultEntry | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (activeCat !== "all" && e.category_id !== activeCat) return false;
      if (!text) return true;
      return (
        e.label.toLowerCase().includes(text) ||
        e.username.toLowerCase().includes(text) ||
        e.url.toLowerCase().includes(text)
      );
    });
  }, [entries, q, activeCat]);

  return (
    <AppShell>
      <PageHeader
        title="خزنة كلمات السر"
        subtitle={`${entries.length} حساب محفوظ`}
        action={
          <button
            onClick={() => lockVault()}
            className="grid size-10 place-items-center rounded-full bg-card text-foreground shadow-card"
            aria-label="قفل"
          >
            <Unlock className="size-5 text-primary" />
          </button>
        }
      />

      <div className="px-5">
        <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-card">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن حساب..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <AndroidAutofillCard entries={entries} ready={!entryQuery.isLoading && !entryQuery.isError} />

      <section className="px-5 pt-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <CatChip
            active={activeCat === "all"}
            onClick={() => setActiveCat("all")}
            label="الكل"
            count={entries.length}
          />
          {categories.map((c) => (
            <CatChip
              key={c.id}
              active={activeCat === c.id}
              onClick={() => setActiveCat(c.id)}
              label={c.name}
              count={entries.filter((e) => e.category_id === c.id).length}
              color={c.color}
              icon={c.icon}
            />
          ))}
          <AddCategoryButton />
        </div>
      </section>

      <section className="px-5 pt-5">
        {entryQuery.isError || categoryQuery.isError ? (
          <ErrorState
            title="تعذر تحميل الحسابات"
            onRetry={() => {
              void entryQuery.refetch();
              void categoryQuery.refetch();
            }}
          />
        ) : entryQuery.isLoading || categoryQuery.isLoading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
            {entries.length
              ? "لا توجد نتائج لهذا البحث أو التصنيف."
              : "لا توجد حسابات محفوظة. أضف أول حساب."}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((e) => (
              <EntryRow key={e.id} entry={e} categories={categories} onEdit={() => setEditing(e)} />
            ))}
          </div>
        )}
      </section>

      <button
        onClick={() => setCreating(true)}
        className="fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full gradient-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-fab"
      >
        <Plus className="size-4" /> حساب جديد
      </button>

      {(creating || editing) && (
        <EntryDialog
          categories={categories}
          entry={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </AppShell>
  );
}

function AndroidAutofillCard({ entries, ready }: { entries: VaultEntry[]; ready: boolean }) {
  const available = androidAutofill.isAvailable();
  const [status, setStatus] = useState<AutofillStatus | null>(null);
  const [busy, setBusy] = useState<"sync" | "import" | "enable" | null>(null);
  const synced = useRef(false);
  const add = useAddVaultEntry();
  const update = useUpdateVaultEntry();

  const refreshStatus = async () => {
    if (!available) return;
    try {
      setStatus(await androidAutofill.status());
    } catch {
      toast.error("تعذر قراءة حالة الملء التلقائي.");
    }
  };

  const syncNow = async (notify: boolean) => {
    if (!available || !ready) return;
    setBusy("sync");
    try {
      const credentials = await Promise.all(
        entries.map(async (entry) => ({
          id: entry.id,
          label: entry.label,
          username: entry.username,
          password: await revealPassword(entry),
          url: entry.url,
        })),
      );
      const result = await androidAutofill.sync(credentials);
      setStatus((current) =>
        current ? { ...current, ...result } : { supported: true, enabled: true, ...result },
      );
      if (notify) toast.success("تم تحديث حسابات الملء التلقائي بأمان.");
    } catch {
      synced.current = false;
      toast.error("تعذرت مزامنة الحسابات. افتح الخزنة وحاول مجددًا.");
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!available) return;
    void refreshStatus();
    const onFocus = () => void refreshStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [available]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || !status?.enabled || synced.current) return;
    synced.current = true;
    void syncNow(false);
  }, [ready, status?.enabled, entries]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!available || !status?.supported) return null;

  const importPending = async () => {
    setBusy("import");
    const imported: string[] = [];
    try {
      const pending = await androidAutofill.pending();
      for (const credential of pending) {
        const existing = entries.find((entry) => entry.id === credential.id);
        if (existing) {
          await update.mutateAsync({
            id: existing.id,
            categoryId: existing.category_id,
            label: existing.label || credential.label,
            username: credential.username,
            password: credential.password,
            url: credential.url || existing.url,
            notes: existing.notes,
          });
        } else {
          await add.mutateAsync({
            categoryId: null,
            label:
              credential.label || credential.webDomain || credential.packageName || "حساب محفوظ",
            username: credential.username,
            password: credential.password,
            url: credential.url,
            notes: "حُفظ تلقائيًا من Android Autofill.",
          });
        }
        imported.push(credential.id);
        await androidAutofill.markImported([credential.id]);
      }
      await refreshStatus();
      toast.success(`تم استيراد ${imported.length} حساب إلى الخزنة.`);
    } catch {
      toast.error(
        imported.length
          ? "اكتمل جزء من الاستيراد؛ بقيت الحسابات غير المستوردة محفوظة على الجهاز."
          : "تعذر استيراد الحسابات المحفوظة من أندرويد.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="px-5 pt-4">
      <div className="rounded-2xl border border-primary/15 bg-primary-soft/60 p-4 shadow-card">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Smartphone className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold">الملء التلقائي على أندرويد</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {status.enabled
                    ? `${status.credentialCount} حساب مشفّر على هذا الجهاز`
                    : "فعّل MemoFlow من إعدادات الملء التلقائي مرة واحدة"}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  status.enabled ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                }`}
              >
                {status.enabled ? "مفعّل" : "غير مفعّل"}
              </span>
            </div>

            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              يعرض أندرويد نافذة تأكيد قبل حفظ بيانات دخول جديدة، ويطلب قفل الجهاز قبل ملء كلمة
              المرور. البيانات المحلية مشفّرة ولا تدخل النسخة الاحتياطية للنظام.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                disabled={busy !== null}
                onClick={async () => {
                  setBusy("enable");
                  try {
                    await androidAutofill.requestEnable();
                  } catch {
                    toast.error("تعذر فتح إعدادات الملء التلقائي.");
                  } finally {
                    setBusy(null);
                  }
                }}
                className="rounded-lg bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
              >
                {status.enabled ? "إدارة الإعداد" : "تفعيل الآن"}
              </button>
              {status.enabled && (
                <button
                  disabled={busy !== null || !ready}
                  onClick={() => void syncNow(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-card px-3 py-2 text-[11px] font-bold text-foreground disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${busy === "sync" ? "animate-spin" : ""}`} />
                  تحديث الحسابات
                </button>
              )}
              {status.pendingCount > 0 && (
                <button
                  disabled={busy !== null}
                  onClick={() => void importPending()}
                  className="flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  <Download className="size-3.5" />
                  استيراد المحفوظ ({status.pendingCount})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CatChip({
  active,
  onClick,
  label,
  count,
  color = "primary",
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color?: string;
  icon?: string;
}) {
  const Icon = icon ? (iconMap[icon] ?? KeyRound) : null;
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-colors ${
        active ? "bg-primary text-primary-foreground" : `${toneBg(color)}`
      }`}
    >
      {Icon && <Icon className="size-3.5" />}
      <span>{label}</span>
      <span className="rounded-full bg-black/10 px-1.5 text-[10px]">{count}</span>
    </button>
  );
}

function AddCategoryButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const add = useAddVaultCategory();
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1 rounded-full border-2 border-dashed border-border px-3 py-2 text-xs font-bold text-muted-foreground"
      >
        <Plus className="size-3.5" /> تصنيف
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-bold">تصنيف جديد</h3>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم التصنيف"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-muted-foreground"
              >
                إلغاء
              </button>
              <button
                disabled={!name.trim() || add.isPending}
                onClick={async () => {
                  try {
                    await add.mutateAsync({ name: name.trim() });
                    setName("");
                    setOpen(false);
                  } catch {
                    toast.error("تعذر حفظ التصنيف. حاول مجددًا.");
                  }
                }}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EntryRow({
  entry,
  categories,
  onEdit,
}: {
  entry: VaultEntry;
  categories: VaultCategory[];
  onEdit: () => void;
}) {
  const cat = categories.find((c) => c.id === entry.category_id);
  const Icon = cat ? (iconMap[cat.icon] ?? KeyRound) : KeyRound;
  const [shown, setShown] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const del = useDeleteVaultEntry();

  const reveal = async () => {
    if (shown) return setShown(null);
    try {
      setShown(await revealPassword(entry));
    } catch {
      toast.error("تعذر إظهار كلمة المرور. افتح الخزنة مجددًا.");
    }
  };
  const copy = async () => {
    try {
      const pw = await revealPassword(entry);
      await navigator.clipboard.writeText(pw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("تعذر النسخ. افتح الخزنة وحاول مجددًا.");
    }
  };

  return (
    <div className="rounded-2xl bg-card p-3.5 shadow-card">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <div
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${toneBg(cat?.color ?? "primary")}`}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold">{entry.label}</h3>
          {entry.username && (
            <p className="truncate text-xs text-muted-foreground">{entry.username}</p>
          )}
          {entry.url && <p className="truncate text-[10px] text-primary">{entry.url}</p>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
            aria-label="تعديل"
          >
            <Pencil className="size-4" />
          </button>
          <button
            disabled={del.isPending}
            onClick={() => {
              if (confirm("حذف هذا الحساب؟"))
                del.mutate(entry.id, {
                  onError: () => toast.error("تعذر حذف الحساب. حاول مجددًا."),
                });
            }}
            className="grid size-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
            aria-label="حذف"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs">{shown ?? "••••••••••"}</code>
        <button
          onClick={reveal}
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
          aria-label="عرض"
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
        <button
          onClick={copy}
          className="grid size-7 place-items-center rounded-md text-primary hover:bg-primary/10"
          aria-label="نسخ"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function EntryDialog({
  categories,
  entry,
  onClose,
}: {
  categories: VaultCategory[];
  entry: VaultEntry | null;
  onClose: () => void;
}) {
  const isEdit = !!entry;
  const [label, setLabel] = useState(entry?.label ?? "");
  const [username, setUsername] = useState(entry?.username ?? "");
  const [url, setUrl] = useState(entry?.url ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(
    entry?.category_id ?? categories[0]?.id ?? null,
  );
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadedRef = useRef(false);
  const add = useAddVaultEntry();
  const upd = useUpdateVaultEntry();

  useEffect(() => {
    if (entry && !loadedRef.current) {
      loadedRef.current = true;
      revealPassword(entry)
        .then((p) => setPassword(p))
        .catch(() => setLoadError(true));
    }
  }, [entry]);

  const submit = async () => {
    if (!label.trim() || !password) return;
    try {
      if (isEdit) {
        await upd.mutateAsync({
          id: entry!.id,
          categoryId,
          label: label.trim(),
          username: username.trim(),
          url: url.trim(),
          notes: notes.trim(),
          password,
        });
      } else {
        await add.mutateAsync({
          categoryId,
          label: label.trim(),
          username: username.trim(),
          url: url.trim(),
          notes: notes.trim(),
          password,
        });
      }
      onClose();
    } catch {
      toast.error("تعذر حفظ الحساب. بياناتك ما زالت في النموذج؛ حاول مجددًا.");
    }
  };

  const generate = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    const arr = crypto.getRandomValues(new Uint8Array(16));
    let out = "";
    for (let i = 0; i < arr.length; i++) out += charset[arr[i] % charset.length];
    setPassword(out);
    setShowPw(true);
  };

  const pending = add.isPending || upd.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "تعديل الحساب" : "حساب جديد"}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 shadow-elevated sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">{isEdit ? "تعديل الحساب" : "حساب جديد"}</h3>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="grid size-8 place-items-center rounded-lg hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        {loadError && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            تعذر فك كلمة المرور. أغلق هذه النافذة وأعد فتح الخزنة قبل التعديل.
          </p>
        )}
        <div className="space-y-3">
          <Field label="العنوان">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="مثال: Gmail الشخصي"
              className="input"
            />
          </Field>

          <Field label="التصنيف">
            <select
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="input"
            >
              <option value="">— بدون تصنيف —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="اسم المستخدم / البريد">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="name@example.com"
              className="input"
              dir="ltr"
            />
          </Field>

          <Field label="كلمة المرور">
            <div className="flex items-center gap-2">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input flex-1"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="grid size-9 place-items-center rounded-lg bg-secondary text-muted-foreground"
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
              <button
                type="button"
                onClick={generate}
                className="rounded-lg bg-primary-soft px-2.5 py-2 text-[11px] font-bold text-primary"
              >
                توليد
              </button>
            </div>
          </Field>

          <Field label="الرابط (اختياري)">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              className="input"
              dir="ltr"
            />
          </Field>

          <Field label="ملاحظات (اختياري)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="input resize-none"
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs font-bold text-muted-foreground"
          >
            إلغاء
          </button>
          <button
            disabled={!label.trim() || !password || pending || loadError}
            onClick={submit}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {pending ? "حفظ..." : isEdit ? "حفظ التعديلات" : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
