import type { BlockRendererProps } from "@/lib/engine/blocks";
import { SubItemsTree } from "@/components/subitems/SubItemsTree";
import type { SubItemParentType } from "@/lib/subitems";

export type SubItemsBlockProps = {
  parentType: SubItemParentType;
  parentId: string;
  title?: string;
  allowConvertToTask?: boolean;
  readonly?: boolean;
  onProgress?: (pct: number, done: number, total: number) => void;
};

export function SubItemsBlock({ block }: BlockRendererProps<SubItemsBlockProps>) {
  const p = block.props;
  if (!p.parentId) return null;
  return (
    <SubItemsTree
      parentType={p.parentType}
      parentId={p.parentId}
      title={p.title ?? "التقسيم الفرعي"}
      allowConvertToTask={p.allowConvertToTask}
      readonly={p.readonly}
      compact={p.parentType === "task"}
      addPlaceholder={p.parentType === "task" ? "أضف بندًا للمهمة…" : undefined}
      onProgress={p.onProgress}
    />
  );
}
