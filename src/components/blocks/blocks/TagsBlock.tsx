import type { BlockRendererProps } from "@/lib/engine/blocks";

export type TagsBlockProps = { tags: string[]; emptyLabel?: string };

export function TagsBlock({ block }: BlockRendererProps<TagsBlockProps>) {
  const { tags, emptyLabel = "لا توجد وسوم." } = block.props;
  if (!tags.length) return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">{t}</span>
      ))}
    </div>
  );
}