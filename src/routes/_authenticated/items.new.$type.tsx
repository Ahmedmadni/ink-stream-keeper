import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ListTree } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DynamicForm, DynamicHeader } from "@/components/dynamic";
import { getSchema } from "@/lib/engine/registry";
import { ITEM_TYPES, type ItemTypeKey } from "@/lib/item-types";
import { useAddTask } from "@/lib/data";
import { useCreatePurchaseList } from "@/lib/purchases";
import { taskValuesToInput } from "@/lib/engine/schemas/task.schema";
import { purchaseValuesToInput } from "@/lib/engine/schemas/purchase.schema";
import { createSubItemsFromOutline } from "@/lib/subitems";

export const Route = createFileRoute("/_authenticated/items/new/$type")({
  head: () => ({ meta: [{ title: "MemoFlow — إنشاء عنصر" }] }),
  component: NewItemPage,
});

function NewItemPage() {
  const { type } = Route.useParams();
  const router = useRouter();
  const key = type as ItemTypeKey;
  const def = ITEM_TYPES[key];
  const schema = def ? getSchema(key) : undefined;

  const addTask = useAddTask();
  const createPurchase = useCreatePurchaseList();
  const [outline, setOutline] = useState("");

  if (!def || !schema) {
    return (
      <AppShell>
        <header className="px-5 pt-6">
          <h1 className="text-xl font-extrabold">نوع غير مدعوم</h1>
          <p className="mt-1 text-xs text-muted-foreground">لم يتم تسجيل Schema لهذا النوع بعد.</p>
        </header>
      </AppShell>
    );
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (key === "task") {
      const created = await addTask.mutateAsync(taskValuesToInput(values));
      if (created?.id && outline.trim()) {
        await createSubItemsFromOutline("task", created.id, outline, { flat: true });
      }
      if (created?.id) router.navigate({ to: "/tasks/$id", params: { id: created.id } });
      else router.navigate({ to: "/tasks" });
      return;
    }
    if (key === "purchase_list") {
      const created = await createPurchase.mutateAsync(purchaseValuesToInput(values));
      router.navigate({ to: "/purchases/$id", params: { id: created.id } });
      return;
    }
  };

  return (
    <AppShell>
      <DynamicHeader
        type={key}
        title={`${def.label} جديد`}
        subtitle={def.description}
        actions={
          <button
            onClick={() => router.history.back()}
            className="grid size-10 place-items-center rounded-full bg-card shadow-card"
            aria-label="رجوع"
          >
            <ArrowRight className="size-5" />
          </button>
        }
      />
      <div className="px-5 pb-24 pt-2">
        {key === "task" && (
          <div className="mb-4 rounded-2xl bg-card p-4 shadow-card">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold">
              <ListTree className="size-4 text-primary" />
              <span>قائمة التحقق (اختيارية)</span>
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              اكتب كل خطوة مطلوبة في سطر مستقل. تكتمل المهمة تلقائيًا عند إنجازها كلها.
            </p>
            <textarea
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              rows={5}
              dir="rtl"
              placeholder={"جمع البيانات\nمراجعة الأرقام\nتصميم العرض\nإرسال النسخة النهائية"}
              className="w-full resize-y rounded-xl bg-secondary p-3 text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </div>
        )}
        <DynamicForm schema={schema} onSubmit={handleSubmit} submitLabel={`حفظ ${def.label}`} />
      </div>
    </AppShell>
  );
}
