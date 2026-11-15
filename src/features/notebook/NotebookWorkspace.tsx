import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import type { Editor } from "@tiptap/react";
import {
  BookOpen, Brush, Eraser, FileDown, Layers, PenLine, Plus,
  Copy, Trash2, Highlighter, Undo2, Redo2, Sticker, MousePointer2, ScanLine, ZoomIn,
} from "lucide-react";
import { RichEditor, CompactToolbar } from "@/components/RichEditor";
import {
  createPage, dimensionsMm, fromLegacyNote, notebookPlainText, parseNotebook,
  serializeNotebook, PAPER_SIZES, PAPER_TINTS, PAPER_TYPES,
  type Notebook, type NotebookPage, type InkStroke, type PageSticker,
} from "./model";
import { STICKER_GROUPS, stickerIcon } from "./sticker-packs";
import { InkMark } from "./InkMark";
import { hitStroke, inkBounds, InkHistory, moveInk as translateInk, type Point, type InkBounds } from "./ink";
import { pageLayout, paperStyle } from "./page-layout";

const PAPER_LABELS = {
  plain: "سادة", lined: "مسطرة", grid: "مربعات", dots: "منقّطة",
  cornell: "كورنيل", ledger: "جدول محاسبي",
} as const;
const SIZE_LABELS = { a4: "A4", a5: "A5", letter: "Letter", square: "مربعة" };
const TINT_LABELS = { white: "أبيض", ivory: "كريمي", mint: "نعناعي", blue: "أزرق هادئ", rose: "وردي" };
type PaletteGroup = "text" | "draw" | "stickers" | "paper";
type InkMode = "pen" | "highlighter" | "eraser" | "select";
type InkGesture = { pointerId: number; pageId: string; mode: InkMode; start: Point; last: Point; erased: Set<string>; moving: boolean };

function PageMiniature({ page }: { page: NotebookPage }) {
  // The real page's initial lines and ink marks, not a generic blank rectangle.
  const preview = notebookPlainText({ version: 1, pages: [{ ...page, html: page.html.slice(0, 240) }] }).slice(0, 65);
  const { aspect } = pageLayout(page);
  return (
    <span className="relative block h-16 w-12 overflow-hidden rounded border border-[#d1d8df] shadow-sm"
      style={{ ...paperStyle(page), backgroundSize: "10px 10px" }}>
      <span dir="rtl" className="absolute inset-x-1 top-1 line-clamp-4 break-words text-right text-[5px] leading-[7px] text-[#263b53]">
        {preview}
      </span>
      {!!page.strokes.length && (
        <svg viewBox={`0 0 1000 ${1000 * aspect}`} preserveAspectRatio="none" aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full">
          {page.strokes.slice(0, 35).map((stroke) => (
            <InkMark key={stroke.id} stroke={stroke} aspect={aspect}/>
          ))}
        </svg>
      )}
      {page.stickers.slice(0, 6).map((sticker) => (
        <span key={sticker.id} className="absolute size-1.5 rounded-full border border-white"
          style={{ left: String(sticker.x * 100) + "%", top: String(sticker.y * 100) + "%",
            backgroundColor: sticker.color }} />
      ))}
    </span>
  );
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
  const history = useRef(new InkHistory());
  const gesture = useRef<InkGesture | null>(null);
  const [penOnly, setPenOnly] = useState(false);
  const [pressureEnabled, setPressureEnabled] = useState(true);
  const [sensitivity, setSensitivity] = useState(1);
  const [eraserWidth, setEraserWidth] = useState(16);
  const [erased, setErased] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [selectionBox, setSelectionBox] = useState<InkBounds | null>(null);
  const [offset, setOffset] = useState<Point | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(780);
  const [zoom, setZoom] = useState<number | null>(null);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, [!!book]);
  const lastPen = useRef(0);
  const [stickerGroup, setStickerGroup] = useState<string>("medical");
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragging = useRef<{ id: string; pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null);
  const movingRef = useRef<{ id: string; x: number; y: number } | null>(null);
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
    history.current.clear();
    gesture.current = null; liveRef.current = null;
    setLive(null); setErased(new Set()); setSelection(new Set()); setSelectionBox(null); setOffset(null);
    setIndex((prev) => Math.min(prev, Math.max(0, (next.book?.pages.length ?? 1) - 1)));
  }, [content]);

  const commit = (next: Notebook, remember = true) => {
    try {
      const html = serializeNotebook(next);
      if (remember) for (const p of next.pages) {
        const before = bookRef.current?.pages.find((old) => old.id === p.id);
        if (before) history.current.record(p.id, before, p);
      }
      bookRef.current = next;
      lastContent.current = html;
      setBook(next);
      setWarning("");
      onChange(html); // Existing synchronous draft recovery + server CAS remain in charge.
      return true;
    } catch (error) {
      setWarning(error instanceof Error ? error.message : "تعذر حفظ الصفحة.");
      return false;
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
        placeholder="اكتب محتوى المذكرة..." toolbarMode="compact" showCount />
    </div>
  );
  const page = book.pages[index];
  if (!page) return null;
  const [pageW, pageH] = dimensionsMm(page.size, page.orientation);
  const layout = pageLayout(page);
  const aspect = pageH / pageW;
  const displayScale = zoom ?? Math.min(1, Math.max(1, viewportWidth) / layout.width);
  const shownStrokes = offset ? translateInk(page.strokes, selection, offset[0], offset[1]) : page.strokes;
  const selectedBounds = inkBounds(shownStrokes.filter((s) => selection.has(s.id)));
  const isDrawing = group === "draw";
  const selected = page.stickers.find((s) => s.id === selectedSticker) ?? null;
  const coords = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1000, (event.clientX - rect.left) * 1000 / rect.width)),
      Math.max(0, Math.min(1000, (event.clientY - rect.top) * 1000 / rect.height)),
    ] as [number, number];
  };
  const clearGesture = () => {
    gesture.current = null;
    liveRef.current = null; setLive(null); setErased(new Set()); setSelectionBox(null); setOffset(null);
  };
  const finish = () => {
    const activeGesture = gesture.current;
    const stroke = liveRef.current;
    if (!activeGesture) return;
    const current = bookRef.current;
    if (!current) { clearGesture(); return; }
    const next = { ...current, pages: current.pages.map((p) => {
      if (p.id !== activeGesture.pageId) return p;
      if (stroke?.points.length) return { ...p, strokes: [...p.strokes, stroke] };
      if (activeGesture.mode === "eraser" && activeGesture.erased.size)
        return { ...p, strokes: p.strokes.filter((s) => !activeGesture.erased.has(s.id)) };
      if (activeGesture.mode === "select" && activeGesture.moving)
        return { ...p, strokes: translateInk(p.strokes, selection, activeGesture.last[0] - activeGesture.start[0], activeGesture.last[1] - activeGesture.start[1]) };
      return p;
    }) };
    if (next.pages.some((p, i) => p !== current.pages[i]) && !commit(next)) return;
    clearGesture();
  };
  const eraseAt = (from: Point, to: Point, active: InkGesture) => {
    for (const stroke of page.strokes)
      if (hitStroke(stroke, from, to, eraserWidth / 2, aspect)) active.erased.add(stroke.id);
    setErased(new Set(active.erased));
  };
  const startInk = (event: PointerEvent<SVGSVGElement>) => {
    if (!isDrawing || !event.isPrimary || (event.button !== 0 && event.button !== 5) || gesture.current) return;
    if (event.pointerType === "pen") lastPen.current = Date.now();
    if (event.pointerType === "touch" && (penOnly || Date.now() - lastPen.current < 800)) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    const mode = event.button === 5 || (event.buttons & 32) ? "eraser" : inkMode;
    if ((mode === "pen" || mode === "highlighter") && page.strokes.length >= 350) {
      setWarning("وصلت هذه الصفحة إلى حد 350 مسارًا. أضف صفحة أخرى للحفاظ على سرعة الدفتر."); return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = coords(event);
    const active: InkGesture = { pointerId: event.pointerId, pageId: page.id, mode, start: position, last: position, erased: new Set(), moving: false };
    gesture.current = active;
    if (mode === "eraser") { eraseAt(position, position, active); return; }
    if (mode === "select") {
      const hit = [...page.strokes].reverse().find((s) => hitStroke(s, position, position, 10, aspect));
      if (hit) {
        if (!selection.has(hit.id)) setSelection(new Set([hit.id]));
        active.moving = true;
      } else { setSelection(new Set()); setSelectionBox({ x: position[0], y: position[1], width: 0, height: 0 }); }
      return;
    }
    setSelection(new Set());
    const pressured = mode === "pen" && pressureEnabled && event.pointerType === "pen";
    liveRef.current = {
      id: crypto.randomUUID(),
      tool: mode, color: mode === "highlighter" ? "#f2c94c" : penColor,
      width: mode === "highlighter" ? penWidth * 4 : penWidth,
      points: [position], smoothing: smooth,
      ...(pressured ? { pressures: [Math.pow(Math.max(.05, event.pressure), sensitivity)] } : {}),
    };
    setLive(liveRef.current);
  };
  const moveInk = (event: PointerEvent<SVGSVGElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const sample of [...events, event.nativeEvent]) {
      const next = coords({ ...event, clientX: sample.clientX, clientY: sample.clientY } as PointerEvent<SVGSVGElement>);
      if (active.mode === "eraser") eraseAt(active.last, next, active);
      else if (active.mode === "select") {
        if (active.moving) setOffset([next[0] - active.start[0], next[1] - active.start[1]]);
        else {
          const box = { x: Math.min(active.start[0], next[0]), y: Math.min(active.start[1], next[1]), width: Math.abs(next[0] - active.start[0]), height: Math.abs(next[1] - active.start[1]) };
          setSelectionBox(box);
          setSelection(new Set(page.strokes.filter((s) => {
            const b = inkBounds([s])!;
            return b.x >= box.x && b.y >= box.y && b.x + b.width <= box.x + box.width && b.y + b.height <= box.y + box.height;
          }).map((s) => s.id)));
        }
      } else if (liveRef.current) {
        const prev = liveRef.current.points[liveRef.current.points.length - 1];
        if (Math.hypot(next[0] - prev[0], (next[1] - prev[1]) * aspect) >= .35) {
          if (liveRef.current.points.length >= 4000) {
            finish(); setWarning("تم حفظ المسار الطويل. ارفع القلم لبدء مسار جديد."); return;
          }
          const stroke = liveRef.current;
          liveRef.current = { ...stroke, points: [...stroke.points, next],
            ...(stroke.pressures ? { pressures: [...stroke.pressures, Math.pow(Math.max(.05, sample.pressure), sensitivity)] } : {}) };
        }
      }
      active.last = next;
    }
    setLive(liveRef.current);
  };
  const historyStep = (redo: boolean) => {
    finish();
    const marks = redo ? history.current.redo(page.id) : history.current.undo(page.id);
    if (!marks) return;
    const current = bookRef.current!;
    if (!commit({ ...current, pages: current.pages.map((p) => p.id === page.id ? { ...p, ...marks } : p) }, false)) {
      if (redo) history.current.undo(page.id); else history.current.redo(page.id);
    }
    setSelection(new Set());
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
    finish();
    const current = bookRef.current;
    if (!current || current.pages.length >= 36) { setWarning("الحد الأقصى 36 صفحة لكل دفتر."); return; }
    const next = createPage({ paper: page.paper, size: page.size, orientation: page.orientation, tint: page.tint });
    if (!commit({ ...current, pages: [...current.pages, next] })) return;
    setIndex(current.pages.length);
    setGroup("text"); setSelectedSticker(null);
  };
  const duplicatePage = () => {
    finish();
    const current = bookRef.current;
    if (!current || current.pages.length >= 36) { setWarning("الحد الأقصى 36 صفحة."); return; }
    const copy: NotebookPage = {
      ...current.pages[index], id: crypto.randomUUID(),
      strokes: current.pages[index].strokes.map((s) => ({ ...s, id: crypto.randomUUID() })),
      stickers: current.pages[index].stickers.map((s) => ({ ...s, id: crypto.randomUUID() })),
    };
    if (!commit({ ...current, pages: [...current.pages.slice(0, index + 1), copy, ...current.pages.slice(index + 1)] })) return;
    setIndex(index + 1);
  };
  const removePage = () => {
    const current = bookRef.current;
    if (!current || current.pages.length === 1) { setWarning("لا يمكن حذف آخر صفحة."); return; }
    if (!window.confirm("حذف هذه الصفحة بكل النصوص والرسومات والملصقات؟")) return;
    if (!commit({ ...current, pages: current.pages.filter((p) => p.id !== page.id) })) return;
    setIndex(Math.max(0, index - 1));
  };
  const exportPdf = async () => {
    finish();
    if (exporting) return;
    setExporting(true); setWarning("");
    try {
      const { downloadNotebookPdf } = await import("./pdf-export");
      await downloadNotebookPdf(bookRef.current!, filename);
    } catch (error) {
      setWarning(error instanceof Error ? error.message : "تعذر تصدير ملف PDF.");
    } finally { setExporting(false); }
  };

  const controlCls = (active: boolean) => "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed " +
    (active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-accent");
  return (
    <section className="space-y-3" aria-label="دفتر المذكرة متعدد الصفحات"
      onKeyDown={(event) => {
        if (group !== "draw" || !(event.ctrlKey || event.metaKey) ||
          (event.target as Element).closest("input,textarea,[contenteditable=true]")) return;
        const key = event.key.toLowerCase();
        if (key === "z" || key === "y") {
          event.preventDefault(); historyStep(key === "y" || event.shiftKey);
        }
      }}>
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
              onClick={() => { finish(); setGroup(key); setSelectedSticker(null); }}
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
              aria-pressed={inkMode === "pen"} onClick={() => { finish(); setInkMode("pen"); }}><PenLine className="size-4"/>قلم</button>
            <button type="button" className={controlCls(inkMode === "highlighter")}
              aria-pressed={inkMode === "highlighter"} onClick={() => { finish(); setInkMode("highlighter"); }}><Highlighter className="size-4"/>مظلل</button>
            <button type="button" className={controlCls(inkMode === "eraser")}
              aria-pressed={inkMode === "eraser"} onClick={() => { finish(); setInkMode("eraser"); }}><Eraser className="size-4"/>ممحاة</button>
            <button type="button" className={controlCls(inkMode === "select")}
              aria-pressed={inkMode === "select"} onClick={() => { finish(); setInkMode("select"); }}><MousePointer2 className="size-4"/>تحديد وتحريك</button>
            <button type="button" className={controlCls(false)} aria-label="تراجع الرسم"
              disabled={!history.current.canUndo(page.id)} onClick={() => historyStep(false)}><Undo2 className="size-4"/>تراجع</button>
            <button type="button" className={controlCls(false)} aria-label="إعادة الرسم"
              disabled={!history.current.canRedo(page.id)} onClick={() => historyStep(true)}><Redo2 className="size-4"/>إعادة</button>
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
              تنعيم المسارات الجديدة
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-2 text-sm">
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={penOnly}
              aria-label="الكتابة بالقلم فقط" onChange={(e) => setPenOnly(e.target.checked)} />القلم فقط · اللمس للتمرير</label>
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={pressureEnabled}
              aria-label="حساسية ضغط القلم" onChange={(e) => setPressureEnabled(e.target.checked)} />ضغط القلم</label>
            <label className="flex items-center gap-2">استجابة الضغط
              <input type="range" aria-label="استجابة ضغط القلم" min={.5} max={1.5} step={.1} value={sensitivity}
                disabled={!pressureEnabled} onChange={(e) => setSensitivity(Number(e.target.value))} />
            </label>
            {inkMode === "eraser" && <label className="flex items-center gap-2">عرض الممحاة
              <input type="range" aria-label="عرض ممحاة المسارات" min={6} max={60} value={eraserWidth}
                onChange={(e) => setEraserWidth(Number(e.target.value))}/>
            </label>}
          </div>
          {inkMode === "select" && <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={controlCls(false)} onClick={() => setSelection(new Set(page.strokes.map((s) => s.id)))}><ScanLine className="size-4"/>تحديد كل الرسم</button>
            <button type="button" className={controlCls(false)} disabled={!selection.size} onClick={() => {
              updatePage((p) => ({ ...p, strokes: p.strokes.filter((s) => !selection.has(s.id)) })); setSelection(new Set());
            }}><Trash2 className="size-4"/>حذف المحدد ({selection.size})</button>
          </div>}
          <p className="text-xs leading-6 text-muted-foreground">
            الضغط يعمل مع الأقلام التي ترسل بيانات ضغط. الممحاة تمسح المسار كاملًا بالسحب ويمكن التراجع عنها.
            للتحديد اسحب إطارًا حول الرسم، ثم اسحب أي خط محدد لتحريكه. تنعيم المسار لا يتعرف على الحروف العربية.
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
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2 text-xs">
        <span>صفحة {index + 1} · {pageW} × {pageH} مم</span>
        <div className="flex items-center gap-1" role="group" aria-label="تكبير صفحة الدفتر">
          <ZoomIn className="mx-1 size-4"/>
          <button type="button" className={controlCls(zoom === null)} onClick={() => setZoom(null)}>ملاءمة</button>
          <button type="button" className={controlCls(zoom === 1)} onClick={() => setZoom(1)}>100%</button>
          <button type="button" className={controlCls(zoom === 1.5)} onClick={() => setZoom(1.5)}>150%</button>
        </div>
      </div>
      <div ref={viewport} className="w-full overflow-auto rounded-xl bg-secondary/40" dir="ltr" aria-label="منطقة عرض الورقة">
        <div className="relative mx-auto" style={{ width: layout.width * displayScale, height: layout.height * displayScale }}>
        <div data-notebook-paper={page.paper} dir="rtl"
          className="notebook-sheet absolute left-0 top-0 isolate overflow-hidden shadow-md"
          style={{ ...paperStyle(page), width: layout.width, height: layout.height,
            transform: `scale(${displayScale})`, transformOrigin: "top left" }}>
          {(page.paper === "cornell") && (
            <>
              <div className="pointer-events-none absolute bottom-[15%] right-[28%] top-[8%] z-0 w-px bg-[#c8aeb5]" />
              <div className="pointer-events-none absolute bottom-[15%] inset-x-0 z-0 h-px bg-[#c8aeb5]" />
            </>
          )}
          <div className="notebook-content absolute z-10">
            <RichEditor key={page.id} value={page.html}
              onChange={(html) => updatePage((p) => ({ ...p, html }))}
              onAddAttachment={onAddAttachment} toolbarMode="none"
              onEditorReady={handleEditor}
              paperMode placeholder="ابدأ الكتابة في هذه الصفحة..." />
          </div>
          {(isDrawing || page.strokes.length > 0) && (
            <svg viewBox={`0 0 1000 ${1000 * aspect}`} preserveAspectRatio="none"
              role={isDrawing ? "img" : undefined} aria-label={isDrawing ? "مساحة الرسم بالقلم" : undefined}
              tabIndex={isDrawing ? 0 : -1}
              aria-hidden={!isDrawing || undefined}
              onPointerDown={startInk} onPointerMove={moveInk}
              onPointerUp={(e) => { if (gesture.current?.pointerId === e.pointerId) { moveInk(e); finish(); } }}
              onPointerCancel={(e) => { if (gesture.current?.pointerId === e.pointerId) clearGesture(); }}
              onLostPointerCapture={(e) => { if (gesture.current?.pointerId === e.pointerId) finish(); }}
              className={"absolute inset-0 z-20 size-full " + (isDrawing ? "cursor-crosshair" : "pointer-events-none")}
              style={{ touchAction: isDrawing && !penOnly ? "none" : "pan-x pan-y" }}>
              {shownStrokes.filter((s) => !erased.has(s.id)).map((stroke) => (
                <InkMark key={stroke.id} stroke={stroke} aspect={aspect} selected={isDrawing && selection.has(stroke.id)} />
              ))}
              {live && <InkMark stroke={live} aspect={aspect} />}
              {isDrawing && inkMode === "select" && (selectionBox || selectedBounds) && (() => {
                const b = selectionBox || selectedBounds!;
                return <rect x={b.x - 5} y={(b.y - 5) * aspect} width={b.width + 10} height={(b.height + 10) * aspect}
                  fill="#4488ff15" stroke="#3275ba" strokeWidth={2} strokeDasharray="8 5" pointerEvents="none"/>;
              })()}
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
                  dragging.current = { id: sticker.id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: sticker.x, y: sticker.y };
                  setSelectedSticker(sticker.id);
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const drag = dragging.current;
                  if (drag?.id !== sticker.id || drag.pointerId !== e.pointerId) return;
                  const bounds = e.currentTarget.parentElement?.getBoundingClientRect();
                  if (!bounds) return;
                  const halfX = sticker.scale / 2, halfY = halfX / aspect;
                  movingRef.current = { id: sticker.id,
                    x: Math.max(halfX, Math.min(1 - halfX, drag.x + (e.clientX - drag.startX) / bounds.width)),
                    y: Math.max(halfY, Math.min(1 - halfY, drag.y + (e.clientY - drag.startY) / bounds.height)),
                  };
                  setMoving(movingRef.current);
                }}
                onPointerUp={(e) => {
                  if (dragging.current?.id !== sticker.id || dragging.current.pointerId !== e.pointerId) return;
                  dragging.current = null;
                  const moved = movingRef.current;
                  if (moved?.id === sticker.id) updatePage((p) => ({
                    ...p, stickers: p.stickers.map((s) => s.id === sticker.id
                      ? { ...s, x: moved.x, y: moved.y } : s),
                  }));
                  movingRef.current = null; setMoving(null);
                }}
                onPointerCancel={() => { dragging.current = null; movingRef.current = null; setMoving(null); }}
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
      </div>
      {warning && <p role="alert" className="rounded-xl bg-warning/15 p-3 text-sm">{warning}</p>}
      <nav className="sticky bottom-2 z-40 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur"
        aria-label="شريط صفحات المذكرة">
        {isDrawing && <div className="mb-2 flex gap-1 overflow-x-auto border-b border-border pb-2" role="group" aria-label="أدوات القلم السريعة">
          <button type="button" className={controlCls(inkMode === "pen")} aria-label="القلم السريع" onClick={() => { finish(); setInkMode("pen"); }}><PenLine className="size-4"/></button>
          <button type="button" className={controlCls(inkMode === "eraser")} aria-label="الممحاة السريعة" onClick={() => { finish(); setInkMode("eraser"); }}><Eraser className="size-4"/></button>
          <button type="button" className={controlCls(inkMode === "select")} aria-label="التحديد السريع" onClick={() => { finish(); setInkMode("select"); }}><MousePointer2 className="size-4"/></button>
          <button type="button" className={controlCls(false)} aria-label="تراجع سريع" disabled={!history.current.canUndo(page.id)} onClick={() => historyStep(false)}><Undo2 className="size-4"/></button>
          <button type="button" className={controlCls(false)} aria-label="إعادة سريعة" disabled={!history.current.canRedo(page.id)} onClick={() => historyStep(true)}><Redo2 className="size-4"/></button>
        </div>}
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
              onClick={() => { finish(); setIndex(n); setSelectedSticker(null); setSelection(new Set()); }}
              className={"flex min-w-20 flex-col items-center gap-1 rounded-xl border-2 p-1.5 " +
                (index === n ? "border-primary bg-primary-soft" : "border-border bg-background")}>
              <PageMiniature page={p} />
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
