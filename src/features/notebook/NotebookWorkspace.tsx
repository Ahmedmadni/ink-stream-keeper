import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Editor } from "@tiptap/react";
import {
  BookOpen, Brush, Eraser, FileDown, Layers, PenLine, Plus, Palette,
  Copy, Trash2, Check, Highlighter, Undo2, CircleHelp, Sticker, SlidersHorizontal,
} from "lucide-react";
import { RichEditor, CompactToolbar } from "@/components/RichEditor";
import {
  createPage, dimensionsMm, fromLegacyNote, inkPath, isNotebookContent, parseNotebook,
  serializeNotebook, PAPER_SIZES, PAPER_TINTS, PAPER_TYPES,
  type Notebook, type NotebookPage, type InkStroke, type PageSticker,
} from "./model";
import { STICKER_GROUPS, stickerIcon } from "./sticker-packs";

const PAPER_LABELS = {
  plain: "سادة", lined: "مسطرة", grid: "مربعات", dots: "منقّطة",
  cornell: "كورنيل", ledger: "جدول محاسبي",
} as const;
const SIZE_LABELS = { a4: "A4", a5: "A5", letter: "Letter", square: "مربعة" };
const TINT_LABELS = { white: "أبيض", ivory: "كريمي", mint: "نعناعي", blue: "أزرق هادئ", rose: "وردي" };
const TINT_COLORS = {
  white: "#ffffff", ivory: "#fffdf4", mint: "#f4fff9", blue: "#f4faff", rose: "#fff6fa",
} as const;
type PaletteGroup = "text" | "draw" | "stickers" | "paper";
type InkMode = "pen" | "highlighter" | "eraser";

function paperStyle(page: NotebookPage): CSSProperties {
  const color = "rgba(80,119,177,.17)";
  const style: CSSProperties = { backgroundColor: TINT_COLORS[page.tint] };
  if (page.paper === "lined" || page.paper === "cornell") {
    style.backgroundImage = "repeating-linear-gradient(to bottom, transparent 0px, transparent 29px, " + color + " 30px, transparent 31px)";
  } else if (page.paper === "grid" || page.paper === "ledger") {
    style.backgroundImage = "linear-gradient(to right, " + color + " 1px, transparent 1px), linear-gradient(to bottom, " + color + " 1px, transparent 1px)";
    style.backgroundSize = page.paper === "ledger" ? "84px 31px" : "30px 30px";
  } else if (page.paper === "dots") {
    style.backgroundImage = "radial-gradient(circle, rgba(66,112,166,.30) 1px, transparent 1.6px)";
    style.backgroundSize = "24px 24px";
  }
  return style;
}
function readInitial(content: string): { book: Notebook | null; error: string } {
  try { return { book: parseNotebook(content), error: "" }; }
  catch { return { book: null, error: "تنسيق صفحات المذكرة غير صالح. لن يتم تعديل بياناتها حتى تُستعاد نسخة صحيحة." }; }
}
export function NotebookWorkspace({
  content, onChange, onAddAttachment, filename,
}: {
  content: string;
  onChange: (html: string) => void;
  onAddAttachment?: (file: File) => void;
  filename: string;
}) {
  const [initial] = useState(() => readInitial(content));
  const [book, setBook] = useState<Notebook | null>(initial.book);
  const bookRef = useRef<Notebook | null>(initial.book);
  const lastContent = useRef(content);
  const [fatal, setFatal] = useState(initial.error);
  const [warning, setWarning] = useState("");
  const [index, setIndex] = useState(0);
  const [group, setGroup] = useState<PaletteGroup>("text");
  const [inkMode, setInkMode] = useState<InkMode>("pen");
  const [penColor, setPenColor] = useState("#293648");
  const [penWidth, setPenWidth] = useState(4);
  const [smooth, setSmooth] = useState(true);
  const [live, setLive] = useState<InkStroke | null>(null);
  const liveRef = useRef<InkStroke | null>(null);
  const lastPen = useRef(0);
  const [stickerGroup, setStickerGroup] = useState<string>("medical");
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragging = useRef<string | null>(null);
  const [startingPaper, setStartingPaper] = useState<NotebookPage["paper"]>("lined");
  const [startingSize, setStartingSize] = useState<NotebookPage["size"]>("a4");
  const [startingOrientation, setStartingOrientation] = useState<NotebookPage["orientation"]>("portrait");
  const [startingTint, setStartingTint] = useState<NotebookPage["tint"]>("ivory");
  const [exporting, setExporting] = useState(false);
  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null);
  const handleEditor = useCallback((editor: Editor | null) => setActiveTextEditor(editor), []);

  useEffect(() => {
    if (lastContent.current === content) return;
    lastContent.current = content;
    const next = readInitial(content);
    bookRef.current = next.book;
    setBook(next.book);
    setFatal(next.error);
    setWarning("");
    setIndex((prev) => Math.min(prev, Math.max(0, (next.book?.pages.length ?? 1) - 1)));
  }, [content]);

  const commit = (next: Notebook) => {
    try {
      const html = serializeNotebook(next);
      bookRef.current = next;
      lastContent.current = html;
      setBook(next);
      setWarning("");
      onChange(html); // Existing synchronous draft recovery + server CAS remain in charge.
    } catch (error) {
      setWarning(error instanceof Error ? error.message : "تعذر حفظ الصفحة.");
    }
  };
  const updatePage = (edit: (page: NotebookPage) => NotebookPage) => {
    const current = bookRef.current;
    if (!current) return;
    const active = current.pages[index];
    if (!active) return;
    commit({ ...current, pages: current.pages.map((p, i) => i === index ? edit(p) : p) });
  };
  if (fatal) return (
    <div role="alert" className="rounded-2xl border border-destructive bg-destructive/10 p-5 text-sm">
      <p className="font-semibold">{fatal}</p>
      <p className="mt-2">احتفظ بالمحتوى الأصلي؛ تجنب أي حفظ جديد من هذه الشاشة.</p>
    </div>
  );

  if (!book) return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2"><BookOpen className="size-5 text-primary" />
          <h2 className="text-base font-bold">حوّل المذكرة إلى دفتر صفحات</h2>
        </div>
        <p className="mb-4 text-sm leading-7 text-muted-foreground">
          اختر الورق قبل البدء. سيتم نقل النص الحالي بالكامل إلى الصفحة الأولى دون حذف،
          ثم يمكنك إضافة صفحات وأقلام ورسومات وملصقات.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-sm">نوع الورق
            <select aria-label="نوع ورق الدفتر الجديد" value={startingPaper}
              onChange={(e) => setStartingPaper(e.target.value as NotebookPage["paper"])}
              className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-2">
              {PAPER_TYPES.map((p) => <option value={p} key={p}>{PAPER_LABELS[p]}</option>)}
            </select>
          </label>
          <label className="text-sm">المقاس
            <select aria-label="مقاس الدفتر الجديد" value={startingSize}
              onChange={(e) => setStartingSize(e.target.value as NotebookPage["size"])}
              className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-2">
              {PAPER_SIZES.map((p) => <option value={p} key={p}>{SIZE_LABELS[p]}</option>)}
            </select>
          </label>
          <label className="text-sm">الاتجاه
            <select aria-label="اتجاه الدفتر الجديد" value={startingOrientation}
              onChange={(e) => setStartingOrientation(e.target.value as NotebookPage["orientation"])}
              className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-2">
              <option value="portrait">رأسي</option><option value="landscape">أفقي</option>
            </select>
          </label>
          <label className="text-sm">الخامة
            <select aria-label="لون ورق الدفتر الجديد" value={startingTint}
              onChange={(e) => setStartingTint(e.target.value as NotebookPage["tint"])}
              className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-2">
              {PAPER_TINTS.map((p) => <option key={p} value={p}>{TINT_LABELS[p]}</option>)}
            </select>
          </label>
        </div>
        <button type="button"
          onClick={() => { commit(fromLegacyNote(content, {
            paper: startingPaper, size: startingSize,
            orientation: startingOrientation, tint: startingTint,
          })); }}
          className="mt-4 min-h-12 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">
          إنشاء دفتر بالصفحات
        </button>
      </section>
      <RichEditor value={content} onChange={onChange} onAddAttachment={onAddAttachment}
        placeholder="اكتب محتوى المذكرة..." showCount />
    </div>
  );
  const page = book.pages[index];
  if (!page) return null;
  const [pageW, pageH] = dimensionsMm(page.size, page.orientation);
  const isDrawing = group === "draw";
  const selected = page.stickers.find((s) => s.id === selectedSticker) ?? null;
  const coords = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1000, (event.clientX - rect.left) * 1000 / rect.width)),
      Math.max(0, Math.min(1000, (event.clientY - rect.top) * 1000 / rect.height)),
    ] as [number, number];
  };
  const finish = () => {
    const stroke = liveRef.current;
    liveRef.current = null; setLive(null);
    if (stroke?.points.length) updatePage((p) => ({
      ...p, strokes: [...p.strokes, stroke],
    }));
  };
  const startInk = (event: PointerEvent<SVGSVGElement>) => {
    if (!isDrawing || !event.isPrimary) return;
    if (event.pointerType === "pen") lastPen.current = Date.now();
    if (event.pointerType === "touch" && Date.now() - lastPen.current < 800) return;
    event.preventDefault();
    if (inkMode === "eraser") {
      const id = (event.target as Element).getAttribute("data-stroke-id");
      if (id) updatePage((p) => ({ ...p, strokes: p.strokes.filter((stroke) => stroke.id !== id) }));
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    liveRef.current = {
      id: crypto.randomUUID(),
      tool: inkMode, color: inkMode === "highlighter" ? "#f2c94c" : penColor,
      width: inkMode === "highlighter" ? penWidth * 4 : penWidth,
      points: [coords(event)],
    };
    setLive(liveRef.current);
  };
  const moveInk = (event: PointerEvent<SVGSVGElement>) => {
    if (!liveRef.current || !event.isPrimary) return;
    event.preventDefault();
    const next = coords(event);
    const prev = liveRef.current.points[liveRef.current.points.length - 1];
    if (Math.hypot(next[0] - prev[0], next[1] - prev[1]) < 1.3) return;
    if (liveRef.current.points.length >= 4000) { finish(); return; }
    liveRef.current = { ...liveRef.current, points: [...liveRef.current.points, next] };
    setLive(liveRef.current);
  };
  const addSticker = (kind: PageSticker["kind"]) => {
    updatePage((p) => {
      if (p.stickers.length >= 120) { setWarning("الصفحة تحتوي الحد الأقصى من الملصقات."); return p; }
      const stamp: PageSticker = {
        id: crypto.randomUUID(), kind, color: "#3275ba",
        x: 0.35 + ((p.stickers.length % 5) * 0.08), y: 0.35 + ((p.stickers.length % 4) * 0.07),
        scale: 0.12,
      };
      setSelectedSticker(stamp.id);
      return { ...p, stickers: [...p.stickers, stamp] };
    });
  };
  const addPage = () => {
    const current = bookRef.current;
    if (!current || current.pages.length >= 36) { setWarning("الحد الأقصى 36 صفحة لكل دفتر."); return; }
    const next = createPage({ paper: page.paper, size: page.size, orientation: page.orientation, tint: page.tint });
    commit({ ...current, pages: [...current.pages, next] });
    setIndex(current.pages.length);
    setGroup("text"); setSelectedSticker(null);
  };
  const duplicatePage = () => {
    const current = bookRef.current;
    if (!current || current.pages.length >= 36) { setWarning("الحد الأقصى 36 صفحة."); return; }
    const copy: NotebookPage = {
      ...page, id: crypto.randomUUID(),
      strokes: page.strokes.map((s) => ({ ...s, id: crypto.randomUUID() })),
      stickers: page.stickers.map((s) => ({ ...s, id: crypto.randomUUID() })),
    };
    commit({ ...current, pages: [...current.pages.slice(0, index + 1), copy, ...current.pages.slice(index + 1)] });
    setIndex(index + 1);
  };
  const removePage = () => {
    const current = bookRef.current;
    if (!current || current.pages.length === 1) { setWarning("لا يمكن حذف آخر صفحة."); return; }
    if (!window.confirm("حذف هذه الصفحة بكل النصوص والرسومات والملصقات؟")) return;
    commit({ ...current, pages: current.pages.filter((p) => p.id !== page.id) });
    setIndex(Math.max(0, index - 1));
  };
  const exportPdf = async () => {
    if (exporting) return;
    setExporting(true); setWarning("");
    try {
      const { downloadNotebookPdf } = await import("./pdf-export");
      await downloadNotebookPdf(book, filename);
    } catch (error) {
      setWarning(error instanceof Error ? error.message : "تعذر تصدير ملف PDF.");
    } finally { setExporting(false); }
  };

  const controlCls = (active: boolean) => "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors " +
    (active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-accent");
  return (
    <section className="space-y-3" aria-label="دفتر المذكرة متعدد الصفحات">
      <header className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">دفتر المذاكرة</h2>
            <p className="text-xs text-muted-foreground">{book.pages.length} صفحة · {SIZE_LABELS[page.size]} · {PAPER_LABELS[page.paper]}</p>
          </div>
          <button type="button" disabled={exporting} onClick={() => { void exportPdf(); }}
            className={controlCls(false)} aria-label="تصدير صفحات الدفتر PDF">
            <FileDown className="size-4" /> {exporting ? "تصدير..." : "تصدير PDF"}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1" role="tablist" aria-label="مجموعات أدوات الدفتر">
          {([
            ["text", "كتابة", PenLine],
            ["draw", "أقلام", Brush],
            ["stickers", "ملصقات", Sticker],
            ["paper", "ورق", Layers],
          ] as const).map(([key, label, Icon]) => (
            <button type="button" role="tab" key={key} aria-selected={group === key}
              onClick={() => { setGroup(key); setLive(null); liveRef.current = null; }}
              className={controlCls(group === key) + " px-1"}>
              <Icon className="size-4 shrink-0" /><span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </header>

      {group === "draw" && (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="أدوات الرسم">
            <button type="button" className={controlCls(inkMode === "pen")}
              aria-pressed={inkMode === "pen"} onClick={() => setInkMode("pen")}><PenLine className="size-4"/>قلم</button>
            <button type="button" className={controlCls(inkMode === "highlighter")}
              aria-pressed={inkMode === "highlighter"} onClick={() => setInkMode("highlighter")}><Highlighter className="size-4"/>مظلل</button>
            <button type="button" className={controlCls(inkMode === "eraser")}
              aria-pressed={inkMode === "eraser"} onClick={() => setInkMode("eraser")}><Eraser className="size-4"/>ممحاة</button>
            <button type="button" className={controlCls(false)} aria-label="تراجع عن آخر ضربة قلم"
              onClick={() => updatePage((p) => ({ ...p, strokes: p.strokes.slice(0, -1) }))}>
              <Undo2 className="size-4"/>تراجع الرسم
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">لون القلم
              <input type="color" aria-label="لون قلم الدفتر" value={penColor} onChange={(e) => setPenColor(e.target.value)} />
            </label>
            <label className="flex items-center gap-2">السمك
              <input type="range" aria-label="سمك قلم الدفتر" min={1} max={10} value={penWidth}
                onChange={(e) => setPenWidth(Number(e.target.value))} />
              <span>{penWidth}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} />
              تنعيم ضربات القلم
            </label>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            يدعم القلم الإلكتروني واللمس والماوس. تنعيم المسار يُحسّن الانحناءات، وليس تعرّفًا على الحروف أو تحويلها إلى خط مطبوع.
            للمسح اضغط على الخط بعد اختيار الممحاة.
          </p>
        </div>
      )}
      {group === "stickers" && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
          <div className="flex flex-wrap gap-2">
            {STICKER_GROUPS.map((pack) => (
              <button type="button" key={pack.id} aria-pressed={stickerGroup === pack.id}
                onClick={() => setStickerGroup(pack.id)}
                className={controlCls(stickerGroup === pack.id)}>{pack.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" aria-label="مكتبة الملصقات">
            {STICKER_GROUPS.filter((pack) => pack.id === stickerGroup).flatMap((pack) =>
              pack.items.map(([kind, label]) => {
                const Icon = stickerIcon(kind);
                return (
                  <button type="button" key={kind} title={label} aria-label={"إضافة ملصق " + label}
                    onClick={() => addSticker(kind)}
                    className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-secondary/60 p-2 hover:border-primary">
                    <span className="grid size-9 place-items-center rounded-xl bg-[#e3efff] text-[#2564ad]">
                      <Icon size={22} strokeWidth={1.9} />
                    </span>
                    <span className="text-center text-[10px] leading-4">{label}</span>
                  </button>
                );
              }),
            )}
          </div>
          {selected && (
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
              <span className="text-xs">الملصق المحدد:</span>
              <label className="flex items-center gap-2 text-xs">الحجم
                <input type="range" min={5} max={24} value={Math.round(selected.scale * 100)}
                  aria-label="حجم الملصق" onChange={(e) => updatePage((p) => ({
                    ...p, stickers: p.stickers.map((s) => s.id === selected.id
                      ? { ...s, scale: Number(e.target.value) / 100 } : s),
                  }))} />
              </label>
              <input type="color" aria-label="لون الملصق" value={selected.color}
                onChange={(e) => updatePage((p) => ({
                  ...p, stickers: p.stickers.map((s) => s.id === selected.id ? { ...s, color: e.target.value } : s),
                }))} />
              <button type="button" className={controlCls(false)} onClick={() => {
                updatePage((p) => ({ ...p, stickers: p.stickers.filter((s) => s.id !== selected.id) }));
                setSelectedSticker(null);
              }}><Trash2 className="size-4"/>حذف الملصق</button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">اضغط لإضافة الملصق، واسحبه على الصفحة لتحريك موضعه.</p>
        </div>
      )}
      {group === "paper" && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="خلفيات الورق">
            {PAPER_TYPES.map((p) => (
              <button type="button" key={p} aria-pressed={page.paper === p}
                onClick={() => updatePage((old) => ({ ...old, paper: p }))}
                className={controlCls(page.paper === p)}>{PAPER_LABELS[p]}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="text-sm">حجم الورقة
              <select aria-label="مقاس الصفحة" value={page.size}
                onChange={(e) => updatePage((p) => ({ ...p, size: e.target.value as NotebookPage["size"] }))}
                className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-2">
                {PAPER_SIZES.map((p) => <option key={p} value={p}>{SIZE_LABELS[p]}</option>)}
              </select>
            </label>
            <label className="text-sm">الاتجاه
              <select aria-label="اتجاه الصفحة" value={page.orientation}
                onChange={(e) => updatePage((p) => ({ ...p, orientation: e.target.value as NotebookPage["orientation"] }))}
                className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-2">
                <option value="portrait">رأسي</option><option value="landscape">أفقي</option>
              </select>
            </label>
            <label className="text-sm">لون الخامة
              <select aria-label="خامة الورقة" value={page.tint}
                onChange={(e) => updatePage((p) => ({ ...p, tint: e.target.value as NotebookPage["tint"] }))}
                className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-2">
                {PAPER_TINTS.map((p) => <option key={p} value={p}>{TINT_LABELS[p]}</option>)}
              </select>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">تُحفظ أبعاد الورقة وخلفيتها مع كل صفحة على حدة.</p>
        </div>
      )}

      {group === "text" && activeTextEditor && (
        <CompactToolbar editor={activeTextEditor} onAddAttachment={onAddAttachment} />
      )}
      <div className="mx-auto w-full" style={{ maxWidth: Math.min(pageW / 210 * 780, 980) }}>
        <div data-notebook-paper={page.paper}
          className="relative isolate w-full overflow-hidden rounded-sm border border-[#d2d8dc] shadow-[0_12px_45px_-22px_rgba(0,0,0,.4)]"
          style={{
            ...paperStyle(page), aspectRatio: String(pageW) + " / " + String(pageH),
            minHeight: "min(58vh, 450px)",
          }}>
          {(page.paper === "cornell") && (
            <>
              <div className="pointer-events-none absolute bottom-[15%] right-[28%] top-[8%] z-0 w-px bg-[#c8aeb5]" />
              <div className="pointer-events-none absolute bottom-[15%] inset-x-0 z-0 h-px bg-[#c8aeb5]" />
            </>
          )}
          <div className="relative z-10 mx-[6%] mt-[7%] mb-[6%] min-h-[70%]">
            <RichEditor key={page.id} value={page.html}
              onChange={(html) => updatePage((p) => ({ ...p, html }))}
              onAddAttachment={onAddAttachment} toolbarMode="none"
              onEditorReady={handleEditor}
              paperMode placeholder="ابدأ الكتابة في هذه الصفحة..." />
          </div>
          {isDrawing && (
            <svg viewBox="0 0 1000 1000" preserveAspectRatio="none"
              role="img" aria-label="مساحة الرسم بالقلم"
              onPointerDown={startInk}
              onPointerMove={moveInk}
              onPointerUp={finish}
              onPointerCancel={() => { liveRef.current = null; setLive(null); }}
              className="absolute inset-0 z-20 size-full cursor-crosshair"
              style={{ touchAction: "none" }}>
              {page.strokes.map((stroke) => (
                <path key={stroke.id} data-stroke-id={stroke.id} d={inkPath(stroke.points, smooth)}
                  stroke={stroke.color} strokeWidth={stroke.width} fill="none"
                  strokeLinecap="round" strokeLinejoin="round"
                  opacity={stroke.tool === "highlighter" ? 0.34 : 1}
                  style={{ pointerEvents: inkMode === "eraser" ? "stroke" : "none" }} />
              ))}
              {live && <path d={inkPath(live.points, smooth)} fill="none" stroke={live.color}
                strokeWidth={live.width} strokeLinecap="round" strokeLinejoin="round"
                opacity={live.tool === "highlighter" ? 0.34 : 1} />}
            </svg>
          )}
          {!isDrawing && page.strokes.length > 0 && (
            <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-20 size-full">
              {page.strokes.map((stroke) => (
                <path key={stroke.id} d={inkPath(stroke.points, smooth)} stroke={stroke.color}
                  strokeWidth={stroke.width} fill="none" strokeLinecap="round" strokeLinejoin="round"
                  opacity={stroke.tool === "highlighter" ? 0.34 : 1} />
              ))}
            </svg>
          )}
          {page.stickers.map((sticker) => {
            const Icon = stickerIcon(sticker.kind);
            const position = moving?.id === sticker.id ? moving : sticker;
            return (
              <button type="button" key={sticker.id} aria-label={"ملصق " + sticker.kind}
                disabled={group !== "stickers"}
                onClick={() => setSelectedSticker(sticker.id)}
                onPointerDown={(e) => {
                  if (group !== "stickers") return;
                  e.preventDefault(); e.stopPropagation();
                  dragging.current = sticker.id;
                  setSelectedSticker(sticker.id);
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (dragging.current !== sticker.id) return;
                  const bounds = e.currentTarget.parentElement?.getBoundingClientRect();
                  if (!bounds) return;
                  setMoving({ id: sticker.id,
                    x: Math.max(0.05, Math.min(.95, (e.clientX - bounds.left) / bounds.width)),
                    y: Math.max(0.05, Math.min(.95, (e.clientY - bounds.top) / bounds.height)),
                  });
                }}
                onPointerUp={() => {
                  if (dragging.current !== sticker.id) return;
                  dragging.current = null;
                  if (moving?.id === sticker.id) updatePage((p) => ({
                    ...p, stickers: p.stickers.map((s) => s.id === sticker.id
                      ? { ...s, x: moving.x, y: moving.y } : s),
                  }));
                  setMoving(null);
                }}
                className={"absolute z-30 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white shadow-md " +
                  (group === "stickers" ? "cursor-grab touch-none active:cursor-grabbing " : "pointer-events-none ") +
                  (selectedSticker === sticker.id ? "ring-2 ring-primary" : "")}
                style={{
                  left: String(position.x * 100) + "%", top: String(position.y * 100) + "%",
                  width: String(sticker.scale * 100) + "%", aspectRatio: "1 / 1",
                  backgroundColor: sticker.color, color: "#fff",
                }}>
                <Icon size="67%" strokeWidth={2.2}/>
              </button>
            );
          })}
        </div>
      </div>
      {warning && <p role="alert" className="rounded-xl bg-warning/15 p-3 text-sm">{warning}</p>}
      <nav className="sticky bottom-2 z-40 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur"
        aria-label="شريط صفحات المذكرة">
        <div className="mb-2 flex items-center justify-between gap-2">
          <strong className="text-sm">الصفحات ({book.pages.length})</strong>
          <div className="flex gap-1">
            <button type="button" aria-label="تكرار الصفحة" title="تكرار الصفحة"
              onClick={duplicatePage} className="grid size-10 place-items-center rounded-xl bg-secondary"><Copy className="size-4" /></button>
            <button type="button" aria-label="حذف الصفحة" title="حذف الصفحة"
              onClick={removePage} disabled={book.pages.length === 1}
              className="grid size-10 place-items-center rounded-xl bg-secondary text-destructive disabled:opacity-40">
              <Trash2 className="size-4"/>
            </button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="صفحات المذكرة">
          {book.pages.map((p, n) => (
            <button type="button" role="tab" key={p.id} aria-selected={index === n}
              aria-label={"صفحة " + (n + 1)}
              onClick={() => { finish(); setIndex(n); setSelectedSticker(null); }}
              className={"flex min-w-20 flex-col items-center gap-1 rounded-xl border-2 p-1.5 " +
                (index === n ? "border-primary bg-primary-soft" : "border-border bg-background")}>
              <span className="block h-12 w-9 rounded-sm border border-border shadow-sm"
                style={{ ...paperStyle(p), backgroundSize: "10px 10px" }}/>
              <span className="text-xs">صفحة {n + 1}</span>
            </button>
          ))}
          <button type="button" onClick={addPage} aria-label="إضافة صفحة" title="إضافة صفحة"
            className="flex min-w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary/35 text-primary">
            <Plus className="size-6"/><span className="text-xs">صفحة جديدة</span>
          </button>
        </div>
      </nav>
    </section>
  );
}
