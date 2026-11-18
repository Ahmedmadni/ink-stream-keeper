import { useEffect, useRef, useState } from "react";
import { plainTextFromHtml } from "@/lib/format";
import { type NotebookPage } from "./model";
import { PageArtwork } from "./PageArtwork";
import { pageLayout } from "./page-layout";
import { type VaultNoteCopy, vaultNotePages } from "./vault-note";

function PageReader({ page }: { page: NotebookPage }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const layout = pageLayout(page);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const scale = width / layout.width;
  return <div ref={ref} className="relative mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-border"
    style={{ height: layout.height * scale }}>
    <div className="absolute left-0 top-0" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
      <PageArtwork page={page}/>
    </div>
  </div>;
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
