import type { BlockRendererProps } from "@/lib/engine/blocks";

export type LinksBlockProps = { links: string[]; emptyLabel?: string };

export function LinksBlock({ block }: BlockRendererProps<LinksBlockProps>) {
  const { links, emptyLabel = "لا توجد روابط." } = block.props;
  if (!links.length) return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  return (
    <ul className="space-y-1">
      {links.map((l) => (
        <li key={l}>
          <a href={l} target="_blank" rel="noreferrer" className="truncate text-xs text-primary underline">{l}</a>
        </li>
      ))}
    </ul>
  );
}