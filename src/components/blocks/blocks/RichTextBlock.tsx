import { useEffect, useState } from "react";
import type { BlockRendererProps } from "@/lib/engine/blocks";
import { emit } from "@/lib/engine/block-events";

export type RichTextBlockProps = {
  html?: string;
  text?: string;
  emptyLabel?: string;
  onSave?: (text: string) => void;
  placeholder?: string;
};

export function RichTextBlock({ block }: BlockRendererProps<RichTextBlockProps>) {
  const { html, text, emptyLabel = "لا يوجد محتوى.", onSave, placeholder = "اكتب هنا..." } = block.props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text ?? "");
  useEffect(() => { setDraft(text ?? ""); }, [text]);

  if (onSave) {
    if (editing) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { setEditing(false); if (draft !== (text ?? "")) { onSave(draft); emit("field:save", { name: "rich_text", value: draft }); } }}
          placeholder={placeholder}
          rows={4}
          className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      );
    }
    return (
      <button type="button" onClick={() => setEditing(true)} className="block w-full whitespace-pre-wrap text-right text-sm leading-relaxed hover:bg-muted/40 rounded-lg p-1 -m-1 transition">
        {text ? text : <span className="text-muted-foreground">{placeholder}</span>}
      </button>
    );
  }

  if (html) return <div className="prose-mf" dir="rtl" dangerouslySetInnerHTML={{ __html: html }} />;
  if (text) return <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>;
  return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
}