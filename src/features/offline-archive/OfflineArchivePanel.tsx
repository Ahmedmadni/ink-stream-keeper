import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { DatabaseBackup, KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { notesQuery, tasksQuery } from "@/lib/data";
import { assertNoUnsavedDrafts } from "@/features/backup/automatic";
import { saveOfflineArchive, listOfflineArchives } from "./storage";
import type { OfflineSnapshot } from "./crypto";

export function OfflineArchivePanel() {
  const { user } = useAuth();
  return user ? <AccountArchive key={user.id} accountId={user.id} /> : null;
}

function AccountArchive({ accountId }: { accountId: string }) {
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const generation = useRef(0);

  useEffect(() => {
    const current = ++generation.current;
    void listOfflineArchives()
      .then((list) => {
        if (current === generation.current)
          setSavedAt(list.find((entry) => entry.accountId === accountId)?.createdAt ?? null);
      })
      .catch(() => {
        if (current === generation.current) setError("تعذر قراءة أرشيف هذا الجهاز.");
      });
    const hide = () => {
      if (document.hidden) {
        generation.current++;
        setPassword("");
        setRepeat("");
        setBusy(false);
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      generation.current++;
      document.removeEventListener("visibilitychange", hide);
    };
  }, [accountId]);

  const create = async () => {
    if (busy) return;
    const token = ++generation.current;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      if (!navigator.onLine) throw new Error("أنشئ النسخة أثناء الاتصال بالإنترنت.");
      if (password.length < 12 || password.trim().length < 12 || password !== repeat)
        throw new Error("اكتب كلمة مرور قوية من 12 حرفًا على الأقل وأكدها.");
      if (qc.isMutating() > 0) throw new Error("هناك تغييرات جارٍ حفظها. حاول بعد اكتمالها.");
      assertNoUnsavedDrafts(accountId);
      const { data: first, error: firstError } = await supabase.auth.getUser();
      if (firstError || first.user?.id !== accountId)
        throw new Error("تعذر التحقق من الحساب قبل إنشاء النسخة.");
      // Fresh server reads, not cached rows from a different session or device.
      const [notes, tasks] = await Promise.all([
        qc.fetchQuery({ ...notesQuery, staleTime: 0 }),
        qc.fetchQuery({ ...tasksQuery, staleTime: 0 }),
      ]);
      if (generation.current !== token) return;
      if (qc.isMutating() > 0) throw new Error("هناك تغييرات جارٍ حفظها. حاول بعد اكتمالها.");
      assertNoUnsavedDrafts(accountId);
      if (notes.some((n) => n.user_id !== accountId) ||
          tasks.some((t) => t.user_id !== accountId))
        throw new Error("تحتوي البيانات على عناصر تخص حسابًا آخر. أُلغيت النسخة.");
      const snapshot: OfflineSnapshot = {
        version: 1,
        accountId,
        createdAt: new Date().toISOString(),
        notes: notes.map((n) => ({
          id: n.id, user_id: n.user_id, title: n.title,
          content: n.content, updated_at: n.updated_at,
        })),
        tasks: tasks.map((t) => ({
          id: t.id, user_id: t.user_id, title: t.title,
          description: t.description ?? null, notes: t.notes ?? null, done: t.done,
          due_at: t.due_at, reminder_at: t.reminder_at,
          priority: t.priority, updated_at: t.updated_at,
        })),
      };
      const { data: last, error: lastError } = await supabase.auth.getUser();
      if (lastError || last.user?.id !== accountId || generation.current !== token)
        throw new Error("تغير الحساب قبل الحفظ. أُلغيت النسخة.");
      await saveOfflineArchive(snapshot, password);
      if (generation.current !== token) return;
      setSavedAt(snapshot.createdAt);
      setMessage(`حُفظت نسخة مشفّرة تضم ${notes.length} مذكرة و${tasks.length} مهمة للقراءة فقط.`);
    } catch (reason) {
      if (generation.current === token)
        setError(reason instanceof Error ? reason.message : "تعذر حفظ النسخة المشفّرة.");
    } finally {
      if (generation.current === token) {
        setBusy(false);
        setPassword("");
        setRepeat("");
      }
    }
  };
  return (
    <section className="px-4 pb-6 sm:px-5" aria-labelledby="offline-archive-title">
      <h2 id="offline-archive-title" className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
        القراءة المشفّرة دون إنترنت
      </h2>
      <div className="space-y-3 rounded-3xl border border-border/60 bg-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          <DatabaseBackup className="size-6 shrink-0 text-primary" />
          <div>
            <h3 className="font-semibold">أرشيف محلي اختياري</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              احفظ مذكراتك ومهامك مشفّرة على هذا الجهاز، ثم افتحها بكلمة المرور حتى بعد إغلاق التطبيق.
            </p>
          </div>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          للقراءة فقط؛ لا تشمل الخزنة والمرفقات أو المسودات غير المرفوعة. تُستبدل النسخة
          السابقة لهذا الحساب عند الحفظ. هذه ليست مزامنة تلقائية أو نسخة احتياطية كاملة.
        </p>
        {savedAt && (
          <p role="status" className="text-xs text-muted-foreground">
            آخر نسخة على الجهاز: {new Date(savedAt).toLocaleString("ar-SA")}
          </p>
        )}
        <label className="block text-sm">
          <span className="flex items-center gap-2"><KeyRound className="size-4" /> كلمة مرور النسخة (12 حرفًا على الأقل)</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-3"
            maxLength={256}
            placeholder="احتفظ بها في مكان آمن"
          />
        </label>
        <label className="block text-sm">
          <span>تأكيد كلمة المرور</span>
          <input
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-3"
            maxLength={256}
          />
        </label>
        <button
          type="button"
          disabled={busy || !password || !repeat}
          onClick={() => { void create(); }}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy ? "جارٍ تشفير النسخة وحفظها…" : "حفظ نسخة مشفّرة للقراءة دون إنترنت"}
        </button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {message && <p role="status" className="text-sm text-primary">{message}</p>}
        <Link to="/offline" className="block min-h-11 rounded-xl bg-secondary px-4 py-3 text-center text-sm font-medium">
          فتح الأرشيف المشفّر
        </Link>
        <p className="text-xs text-muted-foreground">
          لا يمكن استرجاع كلمة المرور إذا نسيتها. لا تُحذف مسوداتك الحالية ولا تُشفّر بهذه العملية.
        </p>
      </div>
    </section>
  );
}
