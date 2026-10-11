import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ShoppingCart, Plus, Wallet, ListChecks, ChevronLeft,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  usePurchaseLists, useAllPurchaseStats, useCreatePurchaseList,
  type PurchaseStats,
} from "@/lib/purchases";
import { formatCurrency } from "@/lib/item-types";
import { ProgressCard } from "@/components/items/ProgressCard";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/purchases/")({
  head: () => ({
    meta: [
      { title: "MemoFlow — قوائم المشتريات" },
      { name: "description", content: "إدارة قوائم المشتريات والميزانية والمتاجر." },
    ],
  }),
  component: PurchasesPage,
});

function PurchasesPage() {
  const { data: lists = [], isLoading } = usePurchaseLists();
  const { data: stats = [] } = useAllPurchaseStats();
  const router = useRouter();
  const create = useCreatePurchaseList();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState<string>("");

  const statsById = useMemo(() => {
    const m = new Map<string, PurchaseStats>();
    for (const s of stats) m.set(s.purchase_list_id, s);
    return m;
  }, [stats]);

  async function submit() {
    const t = title.trim(); if (!t) return;
    const created = await create.mutateAsync({
      title: t, budget: Number(budget) || 0,
    });
    setTitle(""); setBudget(""); setCreating(false);
    router.navigate({ to: "/purchases/$id", params: { id: created.id } });
  }

  return (
    <AppShell>
      <PageHeader
        title="قوائم المشتريات"
        subtitle="ميزانيتك ومشترياتك في مكان واحد"
        action={
          <button onClick={() => setCreating((v) => !v)} className="grid size-10 place-items-center rounded-full gradient-primary text-primary-foreground shadow-fab" aria-label="جديد">
            <Plus className="size-5" />
          </button>
        }
      />

      {creating ? (
        <div className="mx-5 mt-3 space-y-2 rounded-2xl bg-card p-4 shadow-card">
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="اسم القائمة (مثال: مشتريات العيد)"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none"
            autoFocus
          />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              value={budget} onChange={(e) => setBudget(e.target.value)}
              inputMode="decimal" placeholder="الميزانية (اختياري)"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none"
            />
            <button onClick={submit} disabled={!title.trim() || create.isPending} className="rounded-xl gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
              إنشاء
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-3 px-5">
        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : lists.length === 0 ? (
          <EmptyState onCreate={() => setCreating(true)} />
        ) : (
          lists.map((l) => {
            const s = statsById.get(l.id);
            const spent = s?.actual_total ?? 0;
            return (
              <Link
                key={l.id} to="/purchases/$id" params={{ id: l.id }}
                className="block rounded-2xl bg-card p-4 shadow-card transition-transform active:scale-[0.99]"
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-success/15 text-success">
                    <ShoppingCart className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{l.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {s ? `${s.purchased_count}/${s.items_count} عنصر` : "—"}
                      {" · "}
                      <Wallet className="-mt-0.5 inline size-3" /> {formatCurrency(spent, l.currency)} / {formatCurrency(l.budget, l.currency)}
                    </p>
                  </div>
                  <ChevronLeft className="size-5 text-muted-foreground" />
                </div>
                <ProgressCard
                  className="mt-3 bg-background"
                  title={<span className="text-xs text-muted-foreground">الإنجاز</span>}
                  value={s?.progress ?? 0}
                />
              </Link>
            );
          })
        )}
      </div>
    </AppShell>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="grid place-items-center rounded-2xl bg-card p-8 text-center shadow-card">
      <span className="grid size-14 place-items-center rounded-2xl bg-success/15 text-success">
        <ListChecks className="size-7" />
      </span>
      <p className="mt-3 text-sm font-bold">لا توجد قوائم بعد</p>
      <p className="mt-1 text-xs text-muted-foreground">أنشئ قائمتك الأولى وابدأ بتتبع الميزانية والعناصر.</p>
      <button onClick={onCreate} className="mt-4 rounded-xl gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground">
        قائمة جديدة
      </button>
    </div>
  );
}