import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, NotebookPen, CheckSquare, Loader2 } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAddNote, useAddTask } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/create")({
  validateSearch: (search: Record<string, unknown>): { kind?: "note" | "task" } => ({
    kind: search.kind === "note" || search.kind === "task" ? search.kind : undefined,
  }),
  head: () => ({ meta: [{ title: "MemoFlow — إضافة جديدة" }] }),
  component: CreatePage,
});

function CreatePage() {
  const { kind } = Route.useSearch();
  return (
    <AppShell>
      <PageHeader
        title={kind === "note" ? "مذكرة جديدة" : kind === "task" ? "مهمة جديدة" : "إضافة جديدة"}
        action={
          <Link
            to={kind === "task" ? "/tasks" : "/notes"}
            aria-label="رجوع"
            className="grid size-11 place-items-center rounded-full bg-card"
          >
            <ArrowRight className="size-5" />
          </Link>
        }
      />
      {!kind ? (
        <div className="grid gap-3 px-5 sm:grid-cols-2">
          <Link to="/create" search={{ kind: "note" }} className="rounded-2xl bg-card p-6">
            <NotebookPen className="mb-4 size-7 text-primary" />
            <p className="font-semibold">مذكرة جديدة</p>
            <p className="mt-1 text-sm text-muted-foreground">فكرة أو شيء تريد الاحتفاظ به</p>
          </Link>
          <Link to="/create" search={{ kind: "task" }} className="rounded-2xl bg-card p-6">
            <CheckSquare className="mb-4 size-7 text-primary" />
            <p className="font-semibold">مهمة جديدة</p>
            <p className="mt-1 text-sm text-muted-foreground">ابدأ بعنوان وأضف التفاصيل داخلها</p>
          </Link>
        </div>
      ) : (
        <CreateForm key={kind} kind={kind} />
      )}
    </AppShell>
  );
}

function CreateForm({ kind }: { kind: "note" | "task" }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const addNote = useAddNote();
  const addTask = useAddTask();
  const navigate = useNavigate();
  const busy = addNote.isPending || addTask.isPending;
  return (
    <form
      className="space-y-5 px-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!title.trim() || busy) return;
        setError("");
        try {
          if (kind === "note") {
            const note = await addNote.mutateAsync({
              title: title.trim(),
              content: "",
              categoryId: null,
            });
            await navigate({ to: "/notes/$id", params: { id: note.id } });
          } else {
            const task = await addTask.mutateAsync({ title: title.trim() });
            await navigate({ to: "/tasks/$id", params: { id: task.id } });
          }
        } catch {
          setError("تعذر الإنشاء. تحقق من الاتصال وحاول مجددًا.");
        }
      }}
    >
      <label className="block rounded-2xl bg-card p-5">
        <span className="mb-3 block text-sm text-muted-foreground">
          {kind === "note" ? "عنوان المذكرة" : "ما الذي تريد إنجازه؟"}
        </span>
        <input
          autoFocus
          required
          maxLength={500}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === "note" ? "اكتب عنوانًا" : "اسم المهمة"}
          className="w-full bg-transparent text-lg outline-none"
        />
      </label>
      <p className="text-sm leading-7 text-muted-foreground">
        {kind === "note"
          ? "بعد الإنشاء، اكتب المحتوى وأضف مرفقاتك داخل المذكرة."
          : "التفاصيل والبنود والمواعيد اختيارية، ويمكن إضافتها داخل المهمة."}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!title.trim() || busy}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {kind === "note" ? "إنشاء وفتح المذكرة" : "إنشاء وفتح المهمة"}
      </button>
    </form>
  );
}
