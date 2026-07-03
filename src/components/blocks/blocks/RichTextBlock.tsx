import type { BlockRendererProps } from "@/lib/engine/blocks";

export type RichTextBlockProps = {
  html?: string;
  text?: string;
  emptyLabel?: string;
};

export function RichTextBlock({ block }: BlockRendererProps<RichTextBlockProps>) {
  const { html, text, emptyLabel = "لا يوجد محتوى." } = block.props;
  if (html) return <div className="prose-mf" dir="rtl" dangerouslySetInnerHTML={{ __html: html }} />;
  if (text) return <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>;
  return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
}