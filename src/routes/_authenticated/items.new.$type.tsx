import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DynamicForm, DynamicHeader } from "@/components/dynamic";
import { getSchema } from "@/lib/engine/registry";
import { ITEM_TYPES, type ItemTypeKey } from "@/lib/item-types";
import { useAddTask } from "@/lib/data";
import { useCreatePurchaseList } from "@/lib/purchases";
import { taskValuesToInput } from "@/lib/engine/schemas/task.schema";
import { purchaseValuesToInput } from "@/lib/engine/schemas/purchase.schema";

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
      await addTask.mutateAsync(taskValuesToInput(values));
      router.navigate({ to: "/tasks" });
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
          <button onClick={() => router.history.back()} className="grid size-10 place-items-center rounded-full bg-card shadow-card" aria-label="رجوع">
            <ArrowRight className="size-5" />
          </button>
        }
      />
      <div className="px-5 pb-24 pt-2">
        <DynamicForm
          schema={schema}
          onSubmit={handleSubmit}
          submitLabel={`حفظ ${def.label}`}
        />
      </div>
    </AppShell>
  );
}