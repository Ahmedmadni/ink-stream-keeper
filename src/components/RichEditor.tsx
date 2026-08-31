import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import {
  Bold, Italic, Underline as UIcon, Strikethrough, Heading1, Heading2,
  List, ListOrdered, ListChecks, Quote, Highlighter, Link as LinkIcon,
  Image as ImgIcon, AlignRight, AlignCenter, AlignLeft, Undo2, Redo2,
  Table as TableIcon, Code2, Minus, Superscript as SupIcon, Subscript as SubIcon,
  Palette, Pilcrow,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { DictateButton } from "@/components/speech/DictateButton";

export type RichEditorHandle = Editor;

export function RichEditor({
  value,
  onChange,
  onAddAttachment,
  placeholder = "ابدأ الكتابة...",
  editable = true,
  showCount = false,
}: {
  value: string;
  onChange?: (html: string) => void;
  onAddAttachment?: (file: File) => void;
  placeholder?: string;
  editable?: boolean;
  showCount?: boolean;
}) {
  const initial = normalizeToHtml(value);
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder }),
      Underline,
      Highlight.configure({ multicolor: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ["heading", "paragraph"], defaultAlignment: "right" }),
      Typography,
      CharacterCount,
      TextStyle,
      Color,
      Subscript,
      Superscript,
      Table.configure({ resizable: false, HTMLAttributes: { class: "mf-table" } }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initial,
    editorProps: {
      attributes: {
        dir: "rtl",
        class:
          "prose-mf min-h-[220px] focus:outline-none text-[15px] leading-relaxed",
      },
    },
    onUpdate({ editor }) {
      onChange?.(editor.getHTML());
    },
  });

  // Sync external value when switching notes
  const lastValue = useRef(initial);
  useEffect(() => {
    if (!editor) return;
    const html = normalizeToHtml(value);
    if (html !== editor.getHTML() && html !== lastValue.current) {
      editor.commands.setContent(html, { emitUpdate: false });
      lastValue.current = html;
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  if (!editor) return <div className="min-h-[220px] animate-pulse rounded-2xl bg-muted/40" />;

  return (
    <div className="space-y-3">
      {editable && <Toolbar editor={editor} onAddAttachment={onAddAttachment} />}
      <div className="rounded-2xl bg-card p-4 shadow-card">
        <EditorContent editor={editor} />
      </div>
      {showCount && editable && (
        <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
          <span>{editor.storage.characterCount.words()} كلمة · {editor.storage.characterCount.characters()} حرف</span>
          <span>~{Math.max(1, Math.ceil(editor.storage.characterCount.words() / 180))} د قراءة</span>
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor, onAddAttachment }: { editor: Editor; onAddAttachment?: (f: File) => void }) {
  const imgInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const colorInput = useRef<HTMLInputElement>(null);

  const addImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      editor.chain().focus().setImage({ src, alt: file.name }).run();
    };
    reader.readAsDataURL(file);
  };

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("رابط:", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="sticky top-0 z-10 -mx-1 overflow-x-auto rounded-2xl bg-card/95 px-2 py-2 shadow-card backdrop-blur">
      <div className="flex items-center gap-1">
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} label="عريض"><Bold className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} label="مائل"><Italic className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} label="تسطير"><UIcon className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} label="يتوسطه خط"><Strikethrough className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} label="تظليل"><Highlighter className="size-4" /></Btn>
        <Btn onClick={() => colorInput.current?.click()} active={!!editor.getAttributes("textStyle").color} label="لون النص"><Palette className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive("superscript")} label="مرتفع"><SupIcon className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive("subscript")} label="منخفض"><SubIcon className="size-4" /></Btn>
        <Divider />
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} label="عنوان 1"><Heading1 className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} label="عنوان 2"><Heading2 className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive("paragraph")} label="فقرة"><Pilcrow className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} label="اقتباس"><Quote className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} label="كود"><Code2 className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} label="فاصل"><Minus className="size-4" /></Btn>
        <Divider />
        <DictateButton
          size="sm"
          live
          label="إملاء صوتي داخل المحرر"
          className="!bg-transparent !shadow-none hover:bg-primary-soft"
          onText={(t) => editor.chain().focus().insertContent(`${t} `).run()}
        />
        <Divider />
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} label="قائمة"><List className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} label="قائمة مرقمة"><ListOrdered className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} label="قائمة مهام"><ListChecks className="size-4" /></Btn>
        <Divider />
        <Btn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} label="يمين"><AlignRight className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} label="وسط"><AlignCenter className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} label="يسار"><AlignLeft className="size-4" /></Btn>
        <Divider />
        <Btn onClick={setLink} active={editor.isActive("link")} label="رابط"><LinkIcon className="size-4" /></Btn>
        <Btn onClick={() => imgInput.current?.click()} label="صورة"><ImgIcon className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} label="جدول"><TableIcon className="size-4" /></Btn>
        {onAddAttachment && (
          <Btn onClick={() => fileInput.current?.click()} label="ملف مرفق"><span className="text-xs font-bold">📎</span></Btn>
        )}
        <Divider />
        <Btn onClick={() => editor.chain().focus().undo().run()} label="تراجع"><Undo2 className="size-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} label="إعادة"><Redo2 className="size-4" /></Btn>
      </div>
      <input ref={imgInput} type="file" accept="image/*" hidden onChange={(e) => {
        const f = e.target.files?.[0]; if (f) addImage(f); e.target.value = "";
      }} />
      <input ref={fileInput} type="file" hidden onChange={(e) => {
        const f = e.target.files?.[0]; if (f && onAddAttachment) onAddAttachment(f); e.target.value = "";
      }} />
      <input ref={colorInput} type="color" hidden onChange={(e) => {
        editor.chain().focus().setColor(e.target.value).run();
      }} />
    </div>
  );
}

function Btn({
  onClick, active, label, children,
}: { onClick: () => void; active?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary ${
        active ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-6 w-px shrink-0 bg-border" />;
}

function normalizeToHtml(value: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.startsWith("<")) return value;
  // Plain seed text → wrap each line in a paragraph
  return trimmed
    .split(/\n+/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}