import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowRight, Plus, Wallet, Coins, Receipt, BarChart3, Trash2,
  Store, Save, X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  usePurchaseList, usePurchaseItems, usePurchaseStats,
  useUpdatePurchaseList, useDeletePurchaseList,
  useAddPurchaseItem, useUpdatePurchaseItem, useDeletePurchaseItem,
  useReorderPurchaseItems, type PurchaseItem,
} from "@/lib/purchases";
import { formatCurrency } from "@/lib/item-types";
import { StatisticsCard, type StatEntry } from "@/components/items/StatisticsCard";
import { ProgressCard } from "@/components/items/ProgressCard";
import { EditableChecklistRow } from "@/components/items/EditableChecklistRow";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/purchases/$id")({
  head: () => ({ meta: [{ title: "MemoFlow — قائمة مشتريات" }] }),
  component: PurchaseDetail,
});

function PurchaseDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { data: list, isLoading } = usePurchaseList(id);
  const { data: items = [] } = usePurchaseItems(id);
  const { data: stats } = usePurchaseStats(id);

  const updateList = useUpdatePurchaseList();
  const deleteList = useDeletePurchaseList();

  const [editMeta, setEditMeta] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBudget, setDraftBudget] = useState("");

  function startEdit() {
    if (!list) return;
    setDraftTitle(list.title);
    setDraftBudget(String(list.budget ?? 0));
    setEditMeta(true);
  }
  async function saveEdit() {
    if (!list) return;
    await updateList.mutateAsync({
      id: list.id,
      patch: { title: draftTitle.trim() || list.title, budget: Number(draftBudget) || 0 },
    });
    setEditMeta(false);
  }

  if (isLoading || !list) {
    return (
      <AppShell>
        <div className="space-y-3 p-5">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppShell>
    );
  }

  const currency = list.currency;
  const expected = stats?.expected_total ?? 0;
  const actual = stats?.actual_total ?? 0;
  const remaining = stats?.remaining_amount ?? list.budget;
  const progress = stats?.progress ?? 0;

  const statEntries: StatEntry[] = [
    { key: "budget", label: "الميزانية", value: formatCurrency(list.budget, currency), icon: Wallet, tone: "primary" },
    { key: "expected", label: "المتوقع", value: formatCurrency(expected, currency), icon: Coins, tone: "warning" },
    { key: "actual", label: "المصروف", value: formatCurrency(actual, currency), icon: Receipt, tone: "success" },
    { key: "remaining", label: "المتبقي", value: formatCurrency(remaining, currency), icon: BarChart3, tone: remaining < 0 ? "destructive" : "accent" },
  ];

  async function onDeleteList() {
    if (!confirm("حذف القائمة كاملة؟")) return;
    await deleteList.mutateAsync(list.id);
    router.navigate({ to: "/purchases" });
  }

  return (
    <AppShell>
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 pb-3 pt-6">
        <button onClick={() => router.history.back()} className="grid size-10 place-items-center rounded-full bg-card shadow-card" aria-label="رجوع">
          <ArrowRight className="size-5" />
        </button>
        {editMeta ? (
          <input
            value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)}
            className="min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-base font-bold outline-none"
          />
        ) : (
          <button onClick={startEdit} className="min-w-0 truncate text-right text-xl font-extrabold">
            {list.title}
          </button>
        )}
        {editMeta ? (
          <div className="flex gap-1">
            <button onClick={saveEdit} className="grid size-10 place-items-center rounded-full bg-success/15 text-success" aria-label="حفظ">
              <Save className="size-4" />
            </button>
            <button onClick={() => setEditMeta(false)} className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground" aria-label="إلغاء">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button onClick={onDeleteList} className="grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive" aria-label="حذف">
            <Trash2 className="size-4" />
          </button>
        )}
      </header>

      {editMeta ? (
        <div className="mx-5 mb-2 rounded-2xl bg-card p-3 shadow-card">
          <label className="block text-xs text-muted-foreground">الميزانية ({currency})</label>
          <input
            value={draftBudget} onChange={(e) => setDraftBudget(e.target.value)} inputMode="decimal"
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none"
          />
        </div>
      ) : null}

      <div className="space-y-3 px-5">
        <StatisticsCard entries={statEntries} columns={4} />
        <ProgressCard
          title="نسبة الإنجاز"
          subtitle={`${stats?.purchased_count ?? 0} من ${stats?.items_count ?? 0} عنصر`}
          value={progress}
        />
      </div>

      <AddItemBar listId={list.id} nextSort={items.length} />

      <ItemsList listId={list.id} items={items} currency={currency} />
    </AppShell>
  );
}

/* ---------------- Add bar ---------------- */

function AddItemBar({ listId, nextSort }: { listId: string; nextSort: number }) {
  const add = useAddPurchaseItem();
  const [title, setTitle] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [store, setStore] = useState("");

  async function submit() {
    const t = title.trim(); if (!t) return;
    await add.mutateAsync({
      listId, sort: nextSort, title: t,
      quantity: Number(qty) || 1,
      expected_price: Number(price) || 0,
      store_name: store.trim() || null,
    });
    setTitle(""); setQty("1"); setPrice(""); setStore("");
  }

  return (
    <div className="mx-5 my-3 space-y-2 rounded-2xl bg-card p-3 shadow-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input
          value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="إضافة عنصر…"
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none"
        />
        <button onClick={submit} disabled={!title.trim() || add.isPending} className="grid size-10 place-items-center rounded-xl gradient-primary text-primary-foreground disabled:opacity-50" aria-label="إضافة">
          <Plus className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" placeholder="الكمية"
               className="rounded-xl border border-input bg-background px-2 py-2 text-xs outline-none" />
        <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="السعر المتوقع"
               className="rounded-xl border border-input bg-background px-2 py-2 text-xs outline-none" />
        <input value={store} onChange={(e) => setStore(e.target.value)} placeholder="المتجر"
               className="rounded-xl border border-input bg-background px-2 py-2 text-xs outline-none" />
      </div>
    </div>
  );
}

/* ---------------- Items list (virtualized when long) ---------------- */

const VIRTUALIZE_THRESHOLD = 40;

function ItemsList({
  listId, items, currency,
}: { listId: string; items: PurchaseItem[]; currency: string }) {
  const update = useUpdatePurchaseItem();
  const del = useDeletePurchaseItem();
  const reorder = useReorderPurchaseItems();

  const onToggle = useCallback((it: PurchaseItem, next: boolean) => {
    update.mutate({ id: it.id, listId, patch: { purchased: next } });
  }, [update, listId]);

  const onPriceCommit = useCallback((it: PurchaseItem, raw: string) => {
    const v = raw === "" ? null : Number(raw);
    if (v === it.actual_price) return;
    update.mutate({ id: it.id, listId, patch: { actual_price: v } });
  }, [update, listId]);

  const onDelete = useCallback((it: PurchaseItem) => {
    del.mutate({ id: it.id, listId });
  }, [del, listId]);

  const onMove = useCallback((from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= items.length) return;
    const ids = items.map(i => i.id);
    const [m] = ids.splice(from, 1);
    ids.splice(to, 0, m);
    reorder.mutate({ listId, ordered: ids });
  }, [items, reorder, listId]);

  const onTitleChange = useCallback((it: PurchaseItem, text: string) => {
    update.mutate({ id: it.id, listId, patch: { title: text } });
  }, [update, listId]);

  if (items.length === 0) {
    return <p className="px-5 pb-10 pt-2 text-center text-sm text-muted-foreground">لا توجد عناصر — أضف أول عنصر للقائمة.</p>;
  }

  if (items.length < VIRTUALIZE_THRESHOLD) {
    return (
      <div className="space-y-2 px-5 pb-10">
        {items.map((it, idx) => (
          <ItemRow
            key={it.id} item={it} idx={idx} total={items.length} currency={currency}
            onToggle={onToggle} onTitleChange={onTitleChange}
            onPriceCommit={onPriceCommit} onDelete={onDelete} onMove={onMove}
          />
        ))}
      </div>
    );
  }

  return (
    <VirtualItems
      items={items} currency={currency}
      onToggle={onToggle} onTitleChange={onTitleChange}
      onPriceCommit={onPriceCommit} onDelete={onDelete} onMove={onMove}
    />
  );
}

type RowProps = {
  item: PurchaseItem; idx: number; total: number; currency: string;
  onToggle: (it: PurchaseItem, next: boolean) => void;
  onTitleChange: (it: PurchaseItem, text: string) => void;
  onPriceCommit: (it: PurchaseItem, raw: string) => void;
  onDelete: (it: PurchaseItem) => void;
  onMove: (from: number, dir: -1 | 1) => void;
};

function ItemRow({ item, idx, total, currency, onToggle, onTitleChange, onPriceCommit, onDelete, onMove }: RowProps) {
  const lineExpected = useMemo(
    () => (item.quantity || 0) * (item.expected_price || 0),
    [item.quantity, item.expected_price],
  );
  const lineActual = useMemo(
    () => (item.quantity || 0) * (item.actual_price ?? item.expected_price ?? 0),
    [item.quantity, item.actual_price, item.expected_price],
  );
  const [priceDraft, setPriceDraft] = useState<string>(item.actual_price?.toString() ?? "");

  return (
    <EditableChecklistRow
      id={item.id}
      checked={item.purchased}
      text={item.title}
      onToggle={(v) => onToggle(item, v)}
      onTextChange={(t) => onTitleChange(item, t)}
      onDelete={() => onDelete(item)}
      onMoveUp={idx > 0 ? () => onMove(idx, -1) : undefined}
      onMoveDown={idx < total - 1 ? () => onMove(idx, 1) : undefined}
      leading={
        item.image_url ? (
          <img src={item.image_url} alt="" className="size-9 rounded-lg object-cover" loading="lazy" />
        ) : (
          <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Store className="size-4" />
          </span>
        )
      }
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span>×{item.quantity}</span>
          {item.store_name ? <span>· {item.store_name}</span> : null}
          <span>· متوقع: {formatCurrency(lineExpected, currency)}</span>
          {item.purchased ? (
            <span className="text-success">· فعلي: {formatCurrency(lineActual, currency)}</span>
          ) : null}
        </span>
      }
      right={
        <input
          value={priceDraft}
          onChange={(e) => setPriceDraft(e.target.value)}
          onBlur={() => onPriceCommit(item, priceDraft)}
          inputMode="decimal" placeholder="فعلي"
          className="w-20 rounded-md border border-input bg-background px-2 py-1 text-[11px] outline-none"
          aria-label="السعر الفعلي"
        />
      }
    />
  );
}

function VirtualItems(props: {
  items: PurchaseItem[]; currency: string;
  onToggle: (it: PurchaseItem, next: boolean) => void;
  onTitleChange: (it: PurchaseItem, text: string) => void;
  onPriceCommit: (it: PurchaseItem, raw: string) => void;
  onDelete: (it: PurchaseItem) => void;
  onMove: (from: number, dir: -1 | 1) => void;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const v = useVirtualizer({
    count: props.items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 8,
  });

  return (
    <div ref={parentRef} className="mx-5 mb-10 max-h-[60vh] overflow-auto rounded-2xl bg-background">
      <div style={{ height: v.getTotalSize(), position: "relative", width: "100%" }}>
        {v.getVirtualItems().map((row) => {
          const it = props.items[row.index];
          return (
            <div
              key={it.id}
              style={{
                position: "absolute", top: 0, insetInlineStart: 0, width: "100%",
                transform: `translateY(${row.start}px)`, paddingBlock: 4,
              }}
            >
              <ItemRow
                item={it} idx={row.index} total={props.items.length} currency={props.currency}
                onToggle={props.onToggle} onTitleChange={props.onTitleChange}
                onPriceCommit={props.onPriceCommit} onDelete={props.onDelete} onMove={props.onMove}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}