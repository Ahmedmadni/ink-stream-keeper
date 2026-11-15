import { useState } from "react";
import { plainTextFromHtml } from "@/lib/format";
import { inkPath, notebookPlainText, type NotebookPage } from "./model";
import { stickerIcon } from "./sticker-packs";
import { type VaultNoteCopy, vaultNotePages } from "./vault-note";

const TINT = {
  white: "#ffffff", ivory: "#fffdf4", mint: "#f4fff9", blue: "#f4faff", rose: "#fff6fa",
};
function PageReader({ page }: { page: NotebookPage }) {
  const stripes = page.paper === "lined" || page.paper === "cornell";
  const graph = page.paper === "grid" || page.paper === "ledger";
  const dotted = page.paper === "dots";
  return (
    <div className="relative mx-auto min-h-56 w-full max-w-md overflow-hidden rounded-lg border border-border p-[7%] text-[#17263b]"
      style={{
        backgroundColor: TINT[page.tint],
        backgroundImage: stripes ? "repeating-linear-gradient(to bottom,transparent 0px,transparent 27px,#d3dfeb 28px)"
          : graph ? "linear-gradient(90deg,#d3dfeb 1px,transparent 1px),linear-gradient(#d3dfeb 1px,transparent 1px)"
          : dotted ? "radial-gradient(circle,#bed3e6 1px,transparent 2px)" : "none",
        backgroundSize: graph ? "28px 28px" : dotted ? "25px 25px" : undefined,
      }}>
      {page.paper === "cornell" && <div className="pointer-events-none absolute inset-y-[10%] right-[27%] w-px bg-[#dcafb5]" />}
      <p className="relative z-10 whitespace-pre-wrap break-words text-sm leading-7">
        {notebookPlainText({ version: 1, pages: [page] })}
      </p>
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 size-full">
        {page.strokes.map((stroke) => (
          <path key={stroke.id} d={inkPath(stroke.points)} fill="none" stroke={stroke.color}
            strokeWidth={stroke.width} opacity={stroke.tool === "highlighter" ? .34 : 1}
            strokeLinejoin="round" strokeLinecap="round"/>
        ))}
      </svg>
      {page.stickers.map((sticker) => {
        const Icon = stickerIcon(sticker.kind);
        return (
          <span key={sticker.id} aria-label={"ملصق " + sticker.kind}
            className="pointer-events-none absolute z-30 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white text-white"
            style={{
              left: String(sticker.x * 100) + "%", top: String(sticker.y * 100) + "%",
              width: String(sticker.scale * 100) + "%", aspectRatio: "1 / 1",
              backgroundColor: sticker.color,
            }}>
            <Icon size="62%" />
          </span>
        );
      })}
    </div>
  );
}

export function VaultSecureNotePreview({ copy }: { copy: VaultNoteCopy }) {
  const [index, setIndex] = useState(0);
  let book: ReturnType<typeof vaultNotePages>;
  try { book = vaultNotePages(copy.content); }
  catch {
    return <p role="alert" className="mt-3 text-xs text-destructive">
      بيانات الصفحات المشفّرة غير قابلة للقراءة. لم يتم تعديل النسخة المحفوظة.
    </p>;
  }
  return (
    <section className="mt-3 space-y-3 rounded-xl border border-border bg-secondary/50 p-3">
      <p className="break-words text-sm font-bold">{copy.title}</p>
      <p className="text-xs text-muted-foreground">نسخة مشفّرة داخل الخزنة · للقراءة فقط · لا تشمل مرفقات المذكرة</p>
      {book ? (
        <>
          <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="صفحات المذكرة المحمية">
            {book.pages.map((page, n) => (
              <button key={page.id} type="button" role="tab"
                aria-selected={index === n} onClick={() => setIndex(n)}
                className={"min-h-10 shrink-0 rounded-lg px-3 text-xs " +
                  (index === n ? "bg-primary text-primary-foreground" : "bg-card")}>
                صفحة {n + 1}
              </button>
            ))}
          </div>
          <PageReader key={book.pages[Math.min(index, book.pages.length - 1)].id}
            page={book.pages[Math.min(index, book.pages.length - 1)]} />
        </>
      ) : (
        <p className="whitespace-pre-wrap break-words rounded-xl bg-card p-3 text-sm leading-7">
          {plainTextFromHtml(copy.content)}
        </p>
      )}
    </section>
  );
}
