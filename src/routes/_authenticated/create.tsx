import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, NotebookPen, CheckSquare, Loader2, FolderPlus } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAddCategory, useAddNote, useAddTask, useCategories } from "@/lib/data";
import { createSubItemsFromOutline } from "@/lib/subitems";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/create")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { kind?: "note" | "task"; category?: string } => ({
    kind: search.kind === "note" || search.kind === "task" ? search.kind : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
  }),
  head: () => ({ meta: [{ title: "MemoFlow — إضافة جديدة" }] }),
  component: CreatePage,
});

function CreatePage() {
  const { kind, category } = Route.useSearch();
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
        <CreateForm key={`${kind}:${category ?? ""}`} kind={kind} initialCategory={category} />
      )}
    </AppShell>
  );
}

function CreateForm({
  kind,
  initialCategory,
}: {
  kind: "note" | "task";
  initialCategory?: string;
}) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(initialCategory ?? "");
  const [items, setItems] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [error, setError] = useState("");
  const addNote = useAddNote();
  const addTask = useAddTask();
  const addCategory = useAddCategory();
  const { data: categories = [] } = useCategories();
  const navigate = useNavigate();
  const busy = addNote.isPending || addTask.isPending || addCategory.isPending;
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
            const task = await addTask.mutateAsync({
              title: title.trim(),
              category_id: categoryId || null,
            });
            if (items.trim()) {
              try {
                await createSubItemsFromOutline("task", task.id, items, { flat: true });
              } catch {
                toast.error("حُفظت المهمة، لكن تعذر حفظ بعض البنود. أضفها من صفحة المهمة.");
              }
            }
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
      {kind === "task" && (
        <div className="space-y-3 rounded-2xl bg-card p-5">
          <label className="block text-sm text-muted-foreground" htmlFor="task-category">
            التصنيف
          </label>
          <div className="flex items-center gap-2">
            <select
              id="task-category"
              aria-label="تصنيف المهمة"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-xl bg-secondary px-3 text-sm"
            >
              <option value="">بدون تصنيف</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="تصنيف جديد"
              onClick={() => setShowNewCategory((value) => !value)}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary"
            >
              <FolderPlus className="size-5" />
            </button>
          </div>
          {showNewCategory && (
            <div className="flex items-center gap-2">
              <input
                aria-label="اسم التصنيف الجديد"
                maxLength={80}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="مثل: العمل أو تطوير المواقع"
                className="min-h-11 min-w-0 flex-1 rounded-xl bg-secondary px-3 text-sm outline-none"
              />
              <button
                type="button"
                disabled={!newCategory.trim() || addCategory.isPending}
                onClick={async () => {
                  try {
                    const category = await addCategory.mutateAsync({
                      name: newCategory.trim(),
                      icon: "ListChecks",
                    });
                    setCategoryId(category.id);
                    setNewCategory("");
                    setShowNewCategory(false);
                  } catch {
                    toast.error("تعذر إنشاء التصنيف");
                  }
                }}
                className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                حفظ
              </button>
            </div>
          )}
          <label className="block text-sm text-muted-foreground" htmlFor="task-items">
            بنود المهمة
          </label>
          <textarea
            id="task-items"
            aria-label="بنود المهمة الفرعية"
            rows={5}
            value={items}
            onChange={(e) => setItems(e.target.value)}
            placeholder={
              "اكتب كل بند في سطر:\nإقفال البرنامج الأول\nتطوير البرنامج الثاني\nإعادة تصميم البرنامج الثالث"
            }
            className="w-full resize-y rounded-xl bg-secondary px-4 py-3 text-sm leading-7 outline-none"
          />
          <p className="text-xs leading-6 text-muted-foreground">
            تكتمل المهمة تلقائيًا عند إنجاز جميع البنود. ويمكنك إضافة أو تعديل البنود لاحقًا.
          </p>
        </div>
      )}
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
