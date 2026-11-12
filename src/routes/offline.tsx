import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, KeyRound, Lock, Search, Trash2 } from "lucide-react";
import { pageHead } from "@/lib/page-head";
import { plainTextFromHtml } from "@/lib/format";
import type { OfflineSnapshot } from "@/features/offline-archive/crypto";
import {
  deleteOfflineArchive, listOfflineArchives, openOfflineArchive,
  type OfflineSnapshotMetadata,
} from "@/features/offline-archive/storage";

export const Route = createFileRoute("/offline")({
  ssr: false,
  head: () => pageHead("MemoFlow — الأرشيف المشفّر", "قراءة نسخة محلية مشفّرة دون اتصال بالإنترنت."),
  component: OfflineArchiveReader,
});

function OfflineArchiveReader() {
  const [archives, setArchives] = useState<OfflineSnapshotMetadata[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [password, setPassword] = useState("");
  const [archive, setArchive] = useState<OfflineSnapshot | null>(null);
  const [tab, setTab] = useState<"notes" | "tasks">("notes");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);

  const refresh = async () => {
    const list = await listOfflineArchives();
    setArchives(list);
    setSelectedAccount((current) =>
      list.some((item) => item.accountId === current) ? current : list[0]?.accountId ?? "",
    );
  };
  useEffect(() => {
    let active = true;
    void listOfflineArchives().then((list) => {
      if (!active) return;
      setArchives(list);
      setSelectedAccount(list[0]?.accountId ?? "");
    }).catch(() => {
      if (active) setError("تعذر فتح قاعدة البيانات المشفّرة على هذا الجهاز.");
    });
    const hide = () => {
      if (!document.hidden) return;
      generation.current++;
      setArchive(null);
      setPassword("");
      setSelectedId(null);
      setBusy(false);
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      active = false;
      generation.current++;
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);

  const unlock = async () => {
    if (!selectedAccount || !password || busy) return;
    const request = ++generation.current;
    setError("");
    setBusy(true);
    try {
      const value = await openOfflineArchive(selectedAccount, password);
      if (generation.current !== request) return;
      setArchive(value);
      setSelectedId(null);
      setTab("notes");
      setSearch("");
    } catch (reason) {
      if (generation.current === request)
        setError(reason instanceof Error ? reason.message : "تعذر فتح النسخة المشفّرة.");
    } finally {
      if (generation.current === request) {
        setPassword("");
        setBusy(false);
      }
    }
  };
  const lock = () => {
    generation.current++;
    setArchive(null);
    setSelectedId(null);
    setSearch("");
    setPassword("");
  };
  const remove = async () => {
    if (!selectedAccount || busy) return;
    if (!window.confirm("حذف النسخة المشفّرة من هذا الجهاز نهائيًا؟ لا يحذف بيانات الحساب على الخادم.")) return;
    const request = ++generation.current;
    setBusy(true);
    setError("");
    try {
      await deleteOfflineArchive(selectedAccount);
      if (generation.current !== request) return;
      lock();
      await refresh();
    } catch (reason) {
      if (generation.current === request)
        setError(reason instanceof Error ? reason.message : "تعذر حذف الأرشيف المحلي.");
    } finally {
      setBusy(false);
    }
  };
  const entries = useMemo(() => archive
    ? (tab === "notes"
        ? archive.notes.map((note) => ({ id: note.id, title: note.title, subtitle: plainTextFromHtml(note.content) }))
        : archive.tasks.map((task) => ({ id: task.id, title: task.title, subtitle: task.description ?? "" })))
        .filter((entry) => `${entry.title} ${entry.subtitle}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    : [],
  [archive, search, tab]);
  const selectedNote = tab === "notes" ? archive?.notes.find((n) => n.id === selectedId) : undefined;
  const selectedTask = tab === "tasks" ? archive?.tasks.find((t) => t.id === selectedId) : undefined;

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground safe-x safe-bottom">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">الأرشيف المحلي المشفّر</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              القراءة فقط دون اتصال؛ لا يتم إرسال بيانات من هذا الأرشيف إلى الخادم.
            </p>
          </div>
          <Link to="/auth" className="flex min-h-11 items-center gap-1 rounded-xl bg-secondary px-3 text-sm">
            <ArrowRight className="size-4" /> تسجيل الدخول
          </Link>
        </header>
        {!archive ? (
          <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="size-5 text-primary" /> افتح نسختك بكلمة المرور المخصصة لها
            </div>
            {archives.length === 0 ? (
              <p role="status" className="text-sm leading-7 text-muted-foreground">
                لا توجد نسخ محلية محفوظة على هذا الجهاز. سجّل الدخول أثناء الاتصال ثم أنشئ نسخة
                من الإعدادات أولًا.
              </p>
            ) : (
              <>
                <label className="block text-sm">
                  <span>النسخة المحلية</span>
                  <select
                    aria-label="النسخة المحلية"
                    value={selectedAccount}
                    onChange={(event) => {
                      lock();
                      setSelectedAccount(event.target.value);
                    }}
                    className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-3"
                  >
                    {archives.map((item) => (
                      <option key={item.accountId} value={item.accountId}>
                        {new Date(item.createdAt).toLocaleString("ar-SA")} · الحساب {item.accountId.slice(-6)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="inline-flex items-center gap-2"><KeyRound className="size-4" /> كلمة مرور النسخة</span>
                  <input
                    aria-label="كلمة مرور النسخة المحلية"
                    type="password"
                    autoComplete="off"
                    value={password}
                    maxLength={256}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") void unlock(); }}
                    className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-3"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !password}
                  onClick={() => { void unlock(); }}
                  className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  {busy ? "جارٍ فك التشفير…" : "فتح النسخة المشفّرة"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { void remove(); }}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-xs text-destructive"
                >
                  <Trash2 className="size-4" /> حذف النسخة من الجهاز
                </button>
              </>
            )}
          </section>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card p-3 text-sm">
              <span>نسخة بتاريخ {new Date(archive.createdAt).toLocaleString("ar-SA")}</span>
              <button type="button" onClick={lock} className="min-h-11 rounded-xl bg-secondary px-4 font-medium">
                قفل النسخة
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setTab("notes"); setSelectedId(null); }}
                aria-pressed={tab === "notes"}
                className={`min-h-12 rounded-xl px-4 text-sm font-semibold ${tab === "notes" ? "bg-primary text-primary-foreground" : "bg-card"}`}
              >
                المذكرات ({archive.notes.length})
              </button>
              <button
                type="button"
                onClick={() => { setTab("tasks"); setSelectedId(null); }}
                aria-pressed={tab === "tasks"}
                className={`min-h-12 rounded-xl px-4 text-sm font-semibold ${tab === "tasks" ? "bg-primary text-primary-foreground" : "bg-card"}`}
              >
                المهام ({archive.tasks.length})
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                type="search"
                aria-label="بحث في الأرشيف"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setSelectedId(null); }}
                placeholder="ابحث في النسخة المحفوظة"
                className="min-h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
              <ul aria-label="عناصر الأرشيف" className="max-h-[60dvh] space-y-2 overflow-y-auto">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(entry.id)}
                      aria-pressed={selectedId === entry.id}
                      className="w-full rounded-xl border border-border bg-card p-3 text-start"
                    >
                      <span className="block break-words font-semibold">{entry.title || "بدون عنوان"}</span>
                      <span className="mt-1 block line-clamp-2 break-words text-xs text-muted-foreground">
                        {entry.subtitle}
                      </span>
                    </button>
                  </li>
                ))}
                {!entries.length && <li className="p-4 text-sm text-muted-foreground">لا توجد عناصر مطابقة.</li>}
              </ul>
              <article className="min-h-40 rounded-xl border border-border bg-card p-4 text-sm">
                {selectedNote ? (
                  <>
                    <h2 className="mb-3 break-words text-lg font-bold">{selectedNote.title || "بدون عنوان"}</h2>
                    <p className="whitespace-pre-wrap break-words leading-7">
                      {plainTextFromHtml(selectedNote.content)}
                    </p>
                  </>
                ) : selectedTask ? (
                  <>
                    <h2 className="mb-3 break-words text-lg font-bold">{selectedTask.title}</h2>
                    <p className="mb-2 text-xs text-muted-foreground">
                      {selectedTask.done ? "مكتملة" : "غير مكتملة"}
                      {selectedTask.due_at ? ` · الموعد: ${new Date(selectedTask.due_at).toLocaleString("ar-SA")}` : ""}
                    </p>
                    <p className="whitespace-pre-wrap break-words leading-7">{selectedTask.description || ""}</p>
                    {selectedTask.notes && <p className="mt-3 whitespace-pre-wrap break-words leading-7">{selectedTask.notes}</p>}
                  </>
                ) : (
                  <p className="text-muted-foreground">اختر مذكرة أو مهمة لعرضها للقراءة فقط.</p>
                )}
              </article>
            </div>
          </section>
        )}
        {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <p className="text-xs leading-6 text-muted-foreground">
          هذه نسخة سابقة محفوظة، وليست البيانات الحية. لا تتيح إنشاء أو تعديل عناصر، ولا تعرض الخزنة أو المرفقات.
        </p>
      </div>
    </main>
  );
}
