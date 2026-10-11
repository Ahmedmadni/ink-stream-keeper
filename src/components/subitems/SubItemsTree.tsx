import { memo, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  CornerDownLeft,
  GripVertical,
  Indent,
  ListTree,
  Outdent,
  Plus,
  Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DictateButton } from "@/components/speech/DictateButton";
import { cn } from "@/lib/utils";
import {
  MAX_SUBITEM_DEPTH,
  buildTree,
  computeSubItemsProgress,
  nodeProgress,
  createSubItemsFromOutline,
  parseOutline,
  useSubItemMutations,
  useSubItems,
  type SubItem,
  type SubItemNode,
  type SubItemParentType,
} from "@/lib/subitems";
import { useQueryClient } from "@tanstack/react-query";
import { subItemKeys } from "@/lib/subitems";

type Props = {
  parentType: SubItemParentType;
  parentId: string;
  title?: string;
  addPlaceholder?: string;
  /** Show the "حوّل إلى مهمة" action (useful on notes). */
  allowConvertToTask?: boolean;
  readonly?: boolean;
  compact?: boolean;
  /** Called whenever the rollup progress changes (parent can persist it). */
  onProgress?: (pct: number, done: number, total: number) => void;
};

export function SubItemsTree({
  parentType,
  parentId,
  title = "البنود الفرعية",
  addPlaceholder = "أضف بنداً… (Enter للحفظ)",
  allowConvertToTask = false,
  readonly = false,
  compact = false,
  onProgress,
}: Props) {
  const { data: rows = [], isLoading } = useSubItems(parentType, parentId);
  const m = useSubItemMutations(parentType, parentId);
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const dragId = useRef<string | null>(null);

  const tree = useMemo(() => buildTree(rows), [rows]);
  const roll = useMemo(() => computeSubItemsProgress(rows), [rows]);
  const lastReported = useRef<number>(-1);
  if (onProgress && roll.pct !== lastReported.current) {
    lastReported.current = roll.pct;
    queueMicrotask(() => onProgress(roll.pct, roll.done, roll.total));
  }

  const siblingsOf = (parentItemId: string | null) =>
    rows
      .filter((r) => (r.parent_item_id ?? null) === parentItemId)
      .sort((a, b) => a.position - b.position);

  async function addRoot(text: string) {
    const sibs = siblingsOf(null);
    await m.add.mutateAsync({
      title: text,
      parentItemId: null,
      depth: 0,
      position: (sibs.at(-1)?.position ?? -1) + 1,
    });
  }

  /** لصق/كتابة عدة أسطر دفعة واحدة → شجرة كاملة بمستوياتها. */
  async function addBulk(text: string) {
    setBulkBusy(true);
    try {
      const sibs = siblingsOf(null);
      await createSubItemsFromOutline(parentType, parentId, text, {
        startPosition: (sibs.at(-1)?.position ?? -1) + 1,
      });
      qc.invalidateQueries({ queryKey: subItemKeys.list(parentType, parentId) });
    } finally {
      setBulkBusy(false);
    }
  }

  /** Enter داخل بند → بند شقيق جديد تحته مباشرة. */
  function addSibling(node: SubItem) {
    const sibs = siblingsOf(node.parent_item_id ?? null);
    m.add.mutate({
      title: "بند جديد",
      parentItemId: node.parent_item_id ?? null,
      depth: node.depth,
      position: (sibs.at(-1)?.position ?? -1) + 1,
    });
  }

  function addChild(node: SubItem) {
    if (node.depth >= MAX_SUBITEM_DEPTH) return;
    const sibs = siblingsOf(node.id);
    m.add.mutate({
      title: "بند جديد",
      parentItemId: node.id,
      depth: node.depth + 1,
      position: (sibs.at(-1)?.position ?? -1) + 1,
    });
  }

  function descendants(id: string): SubItem[] {
    const out: SubItem[] = [];
    const walk = (pid: string) =>
      rows
        .filter((r) => r.parent_item_id === pid)
        .forEach((c) => {
          out.push(c);
          walk(c.id);
        });
    walk(id);
    return out;
  }

  function indent(node: SubItem) {
    const sibs = siblingsOf(node.parent_item_id ?? null);
    const idx = sibs.findIndex((s) => s.id === node.id);
    const prev = sibs[idx - 1];
    if (!prev || prev.depth + 1 > MAX_SUBITEM_DEPTH) return;
    const shift = prev.depth + 1 - node.depth;
    const kids = siblingsOf(prev.id);
    m.move.mutate([
      {
        id: node.id,
        parent_item_id: prev.id,
        depth: prev.depth + 1,
        position: (kids.at(-1)?.position ?? -1) + 1,
      },
      ...descendants(node.id)
        .filter((d) => d.depth + shift <= MAX_SUBITEM_DEPTH)
        .map((d) => ({
          id: d.id,
          parent_item_id: d.parent_item_id,
          depth: d.depth + shift,
          position: d.position,
        })),
    ]);
  }

  function outdent(node: SubItem) {
    if (!node.parent_item_id) return;
    const parent = rows.find((r) => r.id === node.parent_item_id);
    if (!parent) return;
    const uncles = siblingsOf(parent.parent_item_id ?? null);
    const shift = parent.depth - node.depth;
    m.move.mutate([
      {
        id: node.id,
        parent_item_id: parent.parent_item_id,
        depth: parent.depth,
        position: parent.position + 1,
      },
      ...uncles
        .filter((u) => u.position > parent.position)
        .map((u) => ({
          id: u.id,
          parent_item_id: u.parent_item_id,
          depth: u.depth,
          position: u.position + 2,
        })),
      ...descendants(node.id).map((d) => ({
        id: d.id,
        parent_item_id: d.parent_item_id,
        depth: d.depth + shift,
        position: d.position,
      })),
    ]);
  }

  function drop(target: SubItem) {
    const id = dragId.current;
    dragId.current = null;
    if (!id || id === target.id) return;
    const src = rows.find((r) => r.id === id);
    if (!src) return;
    if (descendants(id).some((d) => d.id === target.id)) return; // no cycles
    const sibs = siblingsOf(target.parent_item_id ?? null).filter((s) => s.id !== id);
    const before = sibs.filter((s) => s.position <= target.position);
    const after = sibs.filter((s) => s.position > target.position);
    const ordered = [...before, src, ...after];
    const shift = target.depth - src.depth;
    m.move.mutate([
      ...ordered.map((r, i) => ({
        id: r.id,
        parent_item_id: r.id === id ? (target.parent_item_id ?? null) : (r.parent_item_id ?? null),
        depth: r.id === id ? target.depth : r.depth,
        position: i,
      })),
      ...descendants(id)
        .filter((d) => d.depth + shift >= 0 && d.depth + shift <= MAX_SUBITEM_DEPTH)
        .map((d) => ({
          id: d.id,
          parent_item_id: d.parent_item_id,
          depth: d.depth + shift,
          position: d.position,
        })),
    ]);
  }

  /** Toggling a node cascades to its descendants. */
  function toggle(node: SubItem, next: boolean) {
    m.update.mutate({
      id: node.id,
      patch: {
        done: next,
        status: next ? "done" : "todo",
        progress: next ? 100 : 0,
        done_at: next ? new Date().toISOString() : null,
      },
    });
    descendants(node.id).forEach((d) => {
      if (d.done !== next)
        m.update.mutate({
          id: d.id,
          patch: { done: next, status: next ? "done" : "todo", progress: next ? 100 : 0 },
        });
    });
  }

  const renderNode = (node: SubItemNode): React.ReactNode => {
    const isCollapsed = collapsed.has(node.id);
    const p = nodeProgress(rows, node.id);
    return (
      <li key={node.id}>
        <Row
          compact={compact}
          node={node}
          readonly={readonly}
          collapsed={isCollapsed}
          childCount={node.children.length}
          progress={node.children.length ? p.pct : null}
          allowConvertToTask={allowConvertToTask}
          onCollapse={() =>
            setCollapsed((s) => {
              const n = new Set(s);
              n.has(node.id) ? n.delete(node.id) : n.add(node.id);
              return n;
            })
          }
          onToggle={(v) => toggle(node, v)}
          onRename={(t) => m.update.mutate({ id: node.id, patch: { title: t } })}
          onEnter={() => addSibling(node)}
          onDelete={() => m.remove.mutate(node.id)}
          onAddChild={() => addChild(node)}
          onIndent={() => indent(node)}
          onOutdent={() => outdent(node)}
          onConvert={() => m.convertToTask.mutate(node)}
          onDragStart={() => {
            dragId.current = node.id;
          }}
          onDrop={() => drop(node)}
        />
        {!isCollapsed && node.children.length > 0 && (
          <ul className="mt-1.5 space-y-1.5 border-e-2 border-border/70 pe-3 ms-0 me-3">
            {node.children.map(renderNode)}
          </ul>
        )}
      </li>
    );
  };

  return (
    <section className="space-y-3">
      {!compact && (
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <ListTree className="size-4 text-primary" />
            {title}
          </h3>
          {roll.total > 0 && (
            <span className="text-[11px] font-bold text-muted-foreground">
              {roll.done}/{roll.total} · {roll.pct}%
            </span>
          )}
        </div>
      )}

      {roll.total > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-gradient-to-l from-primary to-primary/70 transition-all"
            style={{ width: `${roll.pct}%` }}
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">جارٍ التحميل…</p>
      ) : tree.length === 0 ? (
        <p className="text-xs text-muted-foreground">لا توجد بنود بعد — ابدأ بإضافة بند بالأسفل.</p>
      ) : (
        <ul className="space-y-1.5">{tree.map(renderNode)}</ul>
      )}

      {!readonly && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const v = draft.trim();
            if (!v) return;
            try {
              if (parseOutline(v).length > 1) await addBulk(v);
              else await addRoot(v);
              setDraft((current) => (current.trim() === v ? "" : current));
            } catch {
              toast.error("تعذر حفظ البند. حاول مجددًا.");
            }
          }}
          className="flex items-center gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (!text.includes("\n")) return;
              e.preventDefault();
              setDraft(text);
              void addBulk(text)
                .then(() => setDraft((current) => (current === text ? "" : current)))
                .catch(() => toast.error("تعذر حفظ البنود. حاول مجددًا."));
            }}
            placeholder={addPlaceholder}
            className="min-w-0 flex-1 rounded-2xl bg-card px-4 py-2.5 text-sm shadow-card outline-none focus:ring-2 focus:ring-primary"
          />
          {!compact && (
            <DictateButton size="sm" onText={(t) => setDraft((d) => (d ? `${d} ${t}` : t))} />
          )}
          <button
            type="submit"
            disabled={bulkBusy || m.add.isPending}
            className="grid size-10 shrink-0 place-items-center rounded-full gradient-primary text-primary-foreground shadow-fab disabled:opacity-60"
            aria-label="إضافة بند"
          >
            <Plus className="size-4" />
          </button>
        </form>
      )}

      {!readonly && !compact && (
        <p className="hidden text-[11px] text-muted-foreground sm:block">
          Enter: بند جديد · Tab / Shift+Tab: تفريع أو إرجاع · الصق عدة أسطر لإنشاء شجرة كاملة
          (مسافتان = مستوى أعمق).
        </p>
      )}
    </section>
  );
}

type RowProps = {
  compact?: boolean;
  node: SubItem;
  readonly: boolean;
  collapsed: boolean;
  childCount: number;
  progress: number | null;
  allowConvertToTask: boolean;
  onCollapse: () => void;
  onToggle: (v: boolean) => void;
  onRename: (t: string) => void;
  onEnter: () => void;
  onDelete: () => void;
  onAddChild: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onConvert: () => void;
  onDragStart: () => void;
  onDrop: () => void;
};

const Row = memo(function Row(p: RowProps) {
  const [draft, setDraft] = useState(p.node.title);
  const [over, setOver] = useState(false);
  const original = useRef(p.node.title);
  if (p.node.title !== original.current) {
    original.current = p.node.title;
  }

  return (
    <div
      draggable={!p.readonly && !p.compact}
      onDragStart={p.onDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        p.onDrop();
      }}
      className={cn(
        "group grid items-center gap-2 rounded-xl bg-card p-2.5 shadow-card transition",
        p.compact
          ? "grid-cols-[auto_auto_minmax(0,1fr)_auto]"
          : "grid-cols-[auto_auto_auto_minmax(0,1fr)_auto]",
        p.node.done && "opacity-70",
        over && "ring-2 ring-primary",
      )}
    >
      {!p.compact &&
        (!p.readonly ? (
          <GripVertical className="size-4 cursor-grab text-muted-foreground/60" aria-hidden />
        ) : (
          <span />
        ))}

      {p.childCount > 0 ? (
        <button
          onClick={p.onCollapse}
          aria-label="طي"
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <ChevronLeft
            className={cn("size-4 transition-transform", !p.collapsed && "-rotate-90")}
          />
        </button>
      ) : (
        <span className="size-6" />
      )}

      <Checkbox
        checked={p.node.done}
        disabled={p.readonly}
        onCheckedChange={(v) => p.onToggle(!!v)}
        aria-label="تبديل الإنجاز"
      />

      <div className="min-w-0">
        {p.readonly ? (
          <p className={cn("truncate text-sm font-semibold", p.node.done && "line-through")}>
            {p.node.title}
          </p>
        ) : (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const t = draft.trim();
              if (t && t !== p.node.title) p.onRename(t);
              else if (!t) setDraft(p.node.title);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
                p.onEnter();
              }
              if (e.key === "Tab" && !p.compact) {
                e.preventDefault();
                e.shiftKey ? p.onOutdent() : p.onIndent();
              }
            }}
            className={cn(
              "w-full bg-transparent text-sm font-semibold outline-none",
              p.node.done && "line-through",
            )}
          />
        )}
        {(p.progress !== null || p.node.converted_task_id) && (
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            {p.progress !== null && <span>{p.progress}% مكتمل</span>}
            {p.node.converted_task_id && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">
                مهمة
              </span>
            )}
          </div>
        )}
      </div>

      {!p.readonly && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-end gap-0.5",
            !p.compact && "col-span-full sm:col-auto",
          )}
        >
          {!p.compact && p.node.depth < MAX_SUBITEM_DEPTH && (
            <button
              onClick={p.onAddChild}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label="بند فرعي"
            >
              <Plus className="size-4" />
            </button>
          )}
          {!p.compact && (
            <button
              onClick={p.onIndent}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label="إزاحة لليمين"
            >
              <Indent className="size-4" />
            </button>
          )}
          {!p.compact && (
            <button
              onClick={p.onOutdent}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label="إزاحة لليسار"
            >
              <Outdent className="size-4" />
            </button>
          )}
          {p.allowConvertToTask && !p.node.converted_task_id && (
            <button
              onClick={p.onConvert}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label="تحويل إلى مهمة"
            >
              <CornerDownLeft className="size-4" />
            </button>
          )}
          <button
            onClick={p.onDelete}
            className="grid size-7 place-items-center rounded-md text-destructive hover:bg-destructive/10"
            aria-label="حذف"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
});
