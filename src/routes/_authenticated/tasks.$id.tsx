import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Trash2, Loader2, Plus, Check as CheckIcon, X, GripVertical,
  Calendar, Clock, Flag, Tag as TagIcon, LinkIcon, FileText,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  useTask, useUpdateTask, useDeleteTask, useCategories,
  useChecklist, useAddChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem,
  useSubtasks, useAddSubtask, useUpdateSubtask, useDeleteSubtask,
  computeProgress,
} from "@/lib/data";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tasks/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `MemoFlow — مهمة ${params.id}` },
      { name: "description", content: "تفاصيل المهمة، البنود، المهام الفرعية، والوسوم." },
    ],
  }),
  component: TaskDetail,
});

const STATUS_LABEL: Record<string, string> = {
  todo: "للقيام به", in_progress: "قيد التنفيذ", blocked: "موقوفة", done: "مكتملة",
};
const PRIO_LABEL: Record<string, string> = { low: "منخفضة", med: "متوسطة", high: "عالية" };

function toLocalInput(s: string | null | undefined) {
  if (!s) return "";
  const d = new Date(s);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TaskDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { data: task, isLoading } = useTask(id);
  const { data: categories = [] } = useCategories();
  const { data: checklist = [] } = useChecklist(id);
  const { data: subs = [] } = useSubtasks(id);
  const update = useUpdateTask();
  const del = useDeleteTask();

  const addCheck = useAddChecklistItem();
  const updCheck = useUpdateChecklistItem();
  const delCheck = useDeleteChecklistItem();
  const addSub = useAddSubtask();
  const updSub = useUpdateSubtask();
  const delSub = useDeleteSubtask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [newCheck, setNewCheck] = useState("");
  const [newSub, setNewSub] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [linkInput, setLinkInput] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setNotes(task.notes ?? "");
    }
  }, [task?.id, task?.updated_at]);

  // auto progress
  const autoProgress = useMemo(() => computeProgress(checklist, subs), [checklist, subs]);
  useEffect(() => {
    if (!task) return;
    if ((checklist.length + subs.length) === 0) return;
    if ((task.progress ?? 0) !== autoProgress) {
      update.mutate({ id, patch: { progress: autoProgress } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoProgress]);

  if (isLoading) {
    return <AppShell><div className="p-8 text-center"><Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" /></div></AppShell>;
  }
  if (!task) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-muted-foreground">
          لم يتم العثور على المهمة.
          <div className="mt-4"><Link to="/tasks" className="text-primary font-semibold">العودة للمهام</Link></div>
        </div>
      </AppShell>
    );
  }

  const cat = categories.find((c) => c.id === task.category_id);

  function saveBasic() {
    update.mutate({ id, patch: { title, description, notes } }, { onSuccess: () => setEditing(false) });
  }

  function addTag() {
    const v = tagInput.trim();
    if (!v) return;
    const next = Array.from(new Set([...(task!.tags ?? []), v]));
    update.mutate({ id, patch: { tags: next } });
    setTagInput("");
  }
  function removeTag(t: string) {
    update.mutate({ id, patch: { tags: (task!.tags ?? []).filter(x => x !== t) } });
  }
  function addLink() {
    const v = linkInput.trim();
    if (!v) return;
    const next = Array.from(new Set([...(task!.links ?? []), v]));
    update.mutate({ id, patch: { links: next } });
    setLinkInput("");
  }
  function removeLink(l: string) {
    update.mutate({ id, patch: { links: (task!.links ?? []).filter(x => x !== l) } });
  }

  const progress = task.progress ?? 0;

  return (
    <AppShell>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => router.history.back()} aria-label="رجوع" className="grid size-10 place-items-center rounded-full bg-card shadow-card">
          <ArrowRight className="size-5" />
        </button>
        <div className="text-xs text-muted-foreground">{formatRelative(new Date(task.updated_at).getTime())}</div>
        <button
          onClick={() => { if (confirm("حذف هذه المهمة؟")) del.mutate(id, { onSuccess: () => router.navigate({ to: "/tasks" }) }); }}
          className="grid size-10 place-items-center rounded-full bg-card text-destructive shadow-card"
          aria-label="حذف"
        >
          <Trash2 className="size-5" />
        </button>
      </div>

      <div className="space-y-5 px-4 py-5">
        {/* Title + description */}
        <section className="rounded-2xl bg-card p-4 shadow-card">
          {editing ? (
            <div className="space-y-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-base font-bold outline-none focus:ring-2 focus:ring-primary/40" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف..." rows={3} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات..." rows={2} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
              <div className="flex gap-2">
                <button onClick={saveBasic} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground">حفظ</button>
                <button onClick={() => setEditing(false)} className="rounded-lg bg-secondary px-4 py-1.5 text-sm font-bold">إلغاء</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="block w-full text-right">
              <h1 className="text-lg font-extrabold">{task.title}</h1>
              {task.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}
              {task.notes && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-secondary/60 p-2 text-xs text-muted-foreground">{task.notes}</p>}
              {!task.description && !task.notes && <p className="text-xs text-muted-foreground">اضغط للتحرير...</p>}
            </button>
          )}
        </section>

        {/* Progress */}
        <section className="rounded-2xl bg-card p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>نسبة الإنجاز</span>
            <span className="text-primary">{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-gradient-to-l from-primary to-primary/70 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </section>

        {/* Properties grid */}
        <section className="grid grid-cols-2 gap-2">
          <PropCard icon={<Flag className="size-4" />} label="الحالة">
            <select
              value={task.status ?? "todo"}
              onChange={(e) => update.mutate({ id, patch: { status: e.target.value as any, done: e.target.value === "done" } })}
              className="w-full bg-transparent text-sm font-bold outline-none"
            >
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </PropCard>
          <PropCard icon={<Flag className="size-4" />} label="الأولوية">
            <select
              value={task.priority}
              onChange={(e) => update.mutate({ id, patch: { priority: e.target.value as any } })}
              className="w-full bg-transparent text-sm font-bold outline-none"
            >
              {Object.entries(PRIO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </PropCard>
          <PropCard icon={<Calendar className="size-4" />} label="تاريخ البداية">
            <input
              type="datetime-local"
              value={toLocalInput(task.start_at)}
              onChange={(e) => update.mutate({ id, patch: { start_at: e.target.value ? new Date(e.target.value).toISOString() : null } })}
              className="w-full bg-transparent text-xs font-bold outline-none"
            />
          </PropCard>
          <PropCard icon={<Clock className="size-4" />} label="تاريخ النهاية">
            <input
              type="datetime-local"
              value={toLocalInput(task.due_at)}
              onChange={(e) => update.mutate({ id, patch: { due_at: e.target.value ? new Date(e.target.value).toISOString() : null } })}
              className="w-full bg-transparent text-xs font-bold outline-none"
            />
          </PropCard>
          <PropCard icon={<TagIcon className="size-4" />} label="التصنيف">
            <select
              value={task.category_id ?? ""}
              onChange={(e) => update.mutate({ id, patch: { category_id: e.target.value || null } })}
              className="w-full bg-transparent text-sm font-bold outline-none"
            >
              <option value="">— بدون —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </PropCard>
          <PropCard icon={<Clock className="size-4" />} label="التكرار">
            <select
              value={task.recurrence}
              onChange={(e) => update.mutate({ id, patch: { recurrence: e.target.value as any } })}
              className="w-full bg-transparent text-sm font-bold outline-none"
            >
              <option value="none">بدون</option>
              <option value="daily">يومي</option>
              <option value="weekly">أسبوعي</option>
              <option value="monthly">شهري</option>
            </select>
          </PropCard>
        </section>

        {/* Checklist */}
        <section className="rounded-2xl bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold">قائمة البنود</h2>
            <span className="text-xs text-muted-foreground">{checklist.filter(c => c.done).length}/{checklist.length}</span>
          </div>
          <ul className="space-y-1.5">
            {checklist.map((c) => (
              <li key={c.id} className="group flex items-center gap-2 rounded-lg p-1.5 hover:bg-secondary/60">
                <button
                  onClick={() => updCheck.mutate({ id: c.id, taskId: id, patch: { done: !c.done } })}
                  className={`grid size-5 shrink-0 place-items-center rounded border-2 transition-colors ${c.done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                  aria-label="تبديل"
                >
                  {c.done && <CheckIcon className="size-3.5" strokeWidth={3} />}
                </button>
                <input
                  defaultValue={c.text}
                  onBlur={(e) => { if (e.target.value !== c.text) updCheck.mutate({ id: c.id, taskId: id, patch: { text: e.target.value } }); }}
                  className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${c.done ? "text-muted-foreground line-through" : ""}`}
                />
                <button onClick={() => delCheck.mutate({ id: c.id, taskId: id })} className="opacity-0 group-hover:opacity-100" aria-label="حذف">
                  <X className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={(e) => { e.preventDefault(); if (!newCheck.trim()) return; addCheck.mutate({ taskId: id, text: newCheck.trim(), sort: checklist.length }); setNewCheck(""); }} className="mt-2 flex items-center gap-2">
            <Plus className="size-4 text-muted-foreground" />
            <input value={newCheck} onChange={(e) => setNewCheck(e.target.value)} placeholder="إضافة بند..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </form>
        </section>

        {/* Subtasks */}
        <section className="rounded-2xl bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold">المهام الفرعية</h2>
            <span className="text-xs text-muted-foreground">{subs.filter(s => s.done).length}/{subs.length}</span>
          </div>
          <ul className="space-y-1.5">
            {subs.map((s) => (
              <li key={s.id} className="group flex items-center gap-2 rounded-lg p-1.5 hover:bg-secondary/60">
                <button
                  onClick={() => updSub.mutate({ id: s.id, taskId: id, patch: { done: !s.done } })}
                  className={`grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors ${s.done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                  aria-label="تبديل"
                >
                  {s.done && <CheckIcon className="size-3.5" strokeWidth={3} />}
                </button>
                <input
                  defaultValue={s.title}
                  onBlur={(e) => { if (e.target.value !== s.title) updSub.mutate({ id: s.id, taskId: id, patch: { title: e.target.value } }); }}
                  className={`min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none ${s.done ? "text-muted-foreground line-through" : ""}`}
                />
                <button onClick={() => delSub.mutate({ id: s.id, taskId: id })} className="opacity-0 group-hover:opacity-100" aria-label="حذف">
                  <X className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={(e) => { e.preventDefault(); if (!newSub.trim()) return; addSub.mutate({ taskId: id, title: newSub.trim(), sort: subs.length }); setNewSub(""); }} className="mt-2 flex items-center gap-2">
            <Plus className="size-4 text-muted-foreground" />
            <input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="إضافة مهمة فرعية..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </form>
        </section>

        {/* Tags */}
        <section className="rounded-2xl bg-card p-4 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-sm font-extrabold"><TagIcon className="size-4" /> الوسوم</div>
          <div className="flex flex-wrap gap-1.5">
            {(task.tags ?? []).map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
                {t}
                <button onClick={() => removeTag(t)} aria-label={`حذف ${t}`}><X className="size-3" /></button>
              </span>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); addTag(); }} className="mt-2 flex items-center gap-2">
            <Plus className="size-4 text-muted-foreground" />
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="وسم جديد..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </form>
        </section>

        {/* Links */}
        <section className="rounded-2xl bg-card p-4 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-sm font-extrabold"><LinkIcon className="size-4" /> الروابط</div>
          <ul className="space-y-1">
            {(task.links ?? []).map((l) => (
              <li key={l} className="group flex items-center gap-2 rounded-md p-1 hover:bg-secondary/60">
                <a href={l} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-xs text-primary underline">{l}</a>
                <button onClick={() => removeLink(l)} className="opacity-0 group-hover:opacity-100" aria-label="حذف"><X className="size-4 text-muted-foreground" /></button>
              </li>
            ))}
          </ul>
          <form onSubmit={(e) => { e.preventDefault(); addLink(); }} className="mt-2 flex items-center gap-2">
            <Plus className="size-4 text-muted-foreground" />
            <input value={linkInput} onChange={(e) => setLinkInput(e.target.value)} placeholder="https://..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </form>
        </section>

        {cat && (
          <div className="text-center text-xs text-muted-foreground">
            <FileText className="me-1 inline size-3" />
            ضمن تصنيف: <span className="font-bold text-foreground">{cat.name}</span>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PropCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card p-3 shadow-card">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
        {icon}<span>{label}</span>
      </div>
      {children}
    </div>
  );
}