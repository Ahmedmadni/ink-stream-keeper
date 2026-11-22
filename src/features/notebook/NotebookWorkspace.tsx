import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import type { Editor } from "@tiptap/react";
import {
  BookOpen, Brush, Eraser, FileDown, Layers, PenLine, Plus,
  ChevronLeft, ChevronRight, Copy, Trash2, Highlighter, Undo2, Redo2, Sticker, MousePointer2, ScanLine, ZoomIn, Shapes, Minus, Square, Circle, ArrowUpRight, Search, ScanText, Scissors, Waypoints, Check, RotateCw, X,
} from "lucide-react";
import { RichEditor, CompactToolbar } from "@/components/RichEditor";
import { ToolButton } from "@/components/ToolButton";
import {
  createPage, dimensionsMm, fromLegacyNote, notebookPlainText, parseNotebook,
  serializeNotebook, PAPER_SIZES, PAPER_TINTS, PAPER_TYPES, PAPER_TEXTURES, MAX_NOTEBOOK_BYTES,
  type Notebook, type NotebookPage, type InkStroke, type PageSticker,
} from "./model";
import { STICKER_GROUPS, stickerIcon, searchStickers } from "./sticker-packs";
import { stabilizePen } from "./pen-stabilizer";
import { PenResponsePreview } from "./PenResponsePreview";
import { PenFavorites } from "./PenFavorites";
import { InkStyleDialog,type InkStyleSession } from "./InkStyleDialog";
import type { InkStylePreview } from "./ink-style";
import {shouldCaptureInkSample} from "./ink-capture";
import { InkMark, InkLayer } from "./InkMark";
import { StickerArtwork, stickerStyle, ScienceAttribution } from "./StickerArtwork";
import { shapePoints, type ShapeTool, hitStroke, inkBounds, InkHistory, moveInk as translateInk, type Point, type InkBounds } from "./ink";
import { eraseInkSegments, inkWorldPoint, inkPoints, visibleRanges } from "./ink-segments";
import { splitInk, editInkPoint, canInsertInkPoint, insertInkPoint, deleteInkPoint, resetInkGeometry, editableInkNodes, nearestInkNode } from "./ink-edit";
import { InkPointPanel, InkPointOverlay } from "./InkPoints";
import { InkTransformPanel } from "./InkTransform";
import { InkTransformHandles } from "./InkTransformHandles";
import type { InkTransformPreview } from "./ink-transform";
import type { InkTransformDraft } from "./transform-handles";
import { pageLayout, paperStyle } from "./page-layout";
import { PaperGuides, PAPER_LABELS, TEXTURE_LABELS, paperTextStyle } from "./PaperGuides";
import { HandwritingPanel } from "./HandwritingPanel";
import { recognizedTextPage } from "./handwriting";

const SIZE_LABELS = { a4: "A4", a5: "A5", letter: "Letter", square: "مربعة" };
const TINT_LABELS = { white: "أبيض", ivory: "كريمي", mint: "نعناعي", blue: "أزرق هادئ", rose: "وردي" };
type PaletteGroup = "text" | "draw" | "shapes" | "stickers" | "paper";
type InkMode = "pen" | "highlighter" | "eraser" | "select" | "nodes";
type EraserKind = "segment" | "stroke";
type InkGesture = { pointerId: number; pageId: string; mode: InkMode; start: Point; last: Point; erased: Set<string>; moving: boolean;
  eraserKind: EraserKind; partialStrokes?: InkStroke[]; error?: string;
  nodeSource?: InkStroke; nodeIndex?: number; nodeDraft?: InkStroke };
type PaperFineSettings = Pick<NotebookPage, "lineSpacing" | "fontSize" | "texture">;
function PaperFineControls({ value, onChange }: { value: PaperFineSettings; onChange: (value: Partial<PaperFineSettings>) => void }) {
  return <div className="grid grid-cols-1 gap-3 rounded-xl bg-secondary/40 p-3 text-sm sm:grid-cols-3">
    <label className="space-y-2">تباعد السطور · {value.lineSpacing ?? 32}
      <input type="range" className="block w-full" aria-label="تباعد سطور الورقة" min={24} max={56} step={4}
        value={value.lineSpacing ?? 32} onChange={(e) => onChange({ lineSpacing: Number(e.target.value) })}/>
    </label>
    <label>حجم النص الأساسي
      <select aria-label="حجم نص الورقة" value={value.fontSize ?? 16} onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
        className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-2">
        {[12, 14, 16, 18, 20, 22, 24].map((size) => <option key={size} value={size}>{size}</option>)}
      </select>
    </label>
    <label>ملمس الورقة
      <select aria-label="ملمس الورقة" value={value.texture ?? "smooth"}
        onChange={(e) => onChange({ texture: e.target.value as NotebookPage["texture"] })}
        className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-2">
        {PAPER_TEXTURES.map((texture) => <option key={texture} value={texture}>{TEXTURE_LABELS[texture]}</option>)}
      </select>
    </label>
  </div>;
}
function SetupPreview({ page }: { page: NotebookPage }) {
  const [w, h] = dimensionsMm(page.size, page.orientation);
  return <div className="mt-4 flex items-center gap-4 rounded-xl bg-secondary/40 p-3">
    <div className="relative shrink-0 overflow-hidden rounded-sm border border-[#d2d8dc] shadow-sm"
      style={{ ...paperStyle(page), width: w > h ? 170 : 100, aspectRatio: w + " / " + h }}><PaperGuides page={page} preview/></div>
    <div className="text-sm"><strong>معاينة الورقة</strong><p className="mt-1 text-xs leading-6 text-muted-foreground">{PAPER_LABELS[page.paper]} · {w} × {h} مم<br/>{TEXTURE_LABELS[page.texture ?? "smooth"]} · تباعد {page.lineSpacing}</p></div>
  </div>;
}

function PageMiniature({ page }: { page: NotebookPage }) {
  // The real page's initial lines and ink marks, not a generic blank rectangle.
  const preview = notebookPlainText({ version: 1, pages: [{ ...page, html: page.html.slice(0, 240) }] }).slice(0, 65);
  const { aspect } = pageLayout(page);
  return (
    <span className="relative block h-12 w-9 overflow-hidden rounded border border-[#d1d8df] shadow-sm"
      style={{ ...paperStyle(page), backgroundSize: "10px 10px" }}>
      <PaperGuides page={page} preview/>
      <span dir="rtl" className="absolute inset-x-1 top-1 line-clamp-4 break-words text-right text-[5px] leading-[7px] text-[#263b53]">
        {preview}
      </span>
      {!!page.strokes.length && (
        <svg viewBox={`0 0 1000 ${1000 * aspect}`} preserveAspectRatio="none" aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full">
          <InkLayer strokes={page.strokes.slice(0, 35)} aspect={aspect}/>
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
  content, onChange, onAddAttachment, filename, preferenceScope,
}: {
  content: string;
  onChange: (html: string) => void;
  onAddAttachment?: (file: File) => void;
  filename: string;
  preferenceScope?: string;
}) {
  const [initial] = useState(() => readInitial(content));
  const [book, setBook] = useState<Notebook | null>(initial.book);
  const bookRef = useRef<Notebook | null>(initial.book);
  const lastContent = useRef(content);
  const [fatal, setFatal] = useState(initial.error);
  const [warning, setWarning] = useState("");
  const [recognitionSource, setRecognitionSource] = useState<{ page: NotebookPage; selection: Set<string> } | null>(null);
  const closeRecognition = useCallback(() => setRecognitionSource(null), []);
  const [index, setIndex] = useState(0);
  const [group, setGroup] = useState<PaletteGroup>("text");
  const [shapeTool, setShapeTool] = useState<ShapeTool>("line");
  const [inkMode, setInkMode] = useState<InkMode>("pen");
  const [penColor, setPenColor] = useState("#293648");
  const [penWidth, setPenWidth] = useState(4);
  const [penBrush, setPenBrush] = useState<InkStroke["brush"]>(undefined);
  const [smooth, setSmooth] = useState(true);
  const [stabilization, setStabilization] = useState(0);
  const [focusMode, setFocusMode] = useState(true);
  const [pagePreviews, setPagePreviews] = useState(false);
  const [live, setLive] = useState<InkStroke | null>(null);
  const liveRef = useRef<InkStroke | null>(null);
  const history = useRef(new InkHistory());
  const gesture = useRef<InkGesture | null>(null);
  const [penOnly, setPenOnly] = useState(false);
  const [pressureEnabled, setPressureEnabled] = useState(true);
  const [sensitivity, setSensitivity] = useState(1);
  const [eraserWidth, setEraserWidth] = useState(16);
  const [eraserKind, setEraserKind] = useState<EraserKind>("segment");
  const [erasePreview, setErasePreview] = useState<InkStroke[] | null>(null);
  const [eraserPoint, setEraserPoint] = useState<Point | null>(null);
  const [erased, setErased] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [styleSession,setStyleSession]=useState<InkStyleSession|null>(null);
  const [selectionBox, setSelectionBox] = useState<InkBounds | null>(null);
  const [offset, setOffset] = useState<Point | null>(null);
  const [nodePreview, setNodePreview] = useState<InkStroke | null>(null);
  const [activeNode, setActiveNode] = useState(0);
  const [transformSession, setTransformSession] = useState<{ pageId: string; source: InkStroke[]; ids: Set<string>; remainingBytes: number } | null>(null);
  const [transformPreview, setTransformPreview] = useState<InkTransformPreview | null>(null);
  const [transformDraft, setTransformDraft] = useState<InkTransformDraft>({ size: "100", rotation: "0" });
  const [transformDragging, setTransformDragging] = useState(false);
  const transformCancelDrag = useRef<(() => void) | null>(null);
  const handleTransformPreview = useCallback((preview: InkTransformPreview) => setTransformPreview(preview), []);
  const handleTransformGesture = useCallback((cancel: (() => void) | null) => { transformCancelDrag.current = cancel; setTransformDragging(!!cancel); }, []);
  const cancelTransform = useCallback(() => {
    transformCancelDrag.current = null; setTransformDragging(false); setTransformSession(null); setTransformPreview(null);
  }, []);
  useEffect(() => {
    setNodePreview(null); setActiveNode(0);
    setStyleSession(null);
    cancelTransform();
    setInkMode((mode) => mode === "nodes" ? "select" : mode);
  }, [index, group, cancelTransform]);
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
  const [stickerQuery, setStickerQuery] = useState("");
  const [stickerGroup, setStickerGroup] = useState<string>("medical");
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragging = useRef<{ id: string; pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null);
  const movingRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const [startingPaper, setStartingPaper] = useState<NotebookPage["paper"]>("lined");
  const [startingSize, setStartingSize] = useState<NotebookPage["size"]>("a4");
  const [startingOrientation, setStartingOrientation] = useState<NotebookPage["orientation"]>("portrait");
  const [startingTint, setStartingTint] = useState<NotebookPage["tint"]>("ivory");
  const [startingSpacing, setStartingSpacing] = useState(32);
  const [startingFontSize, setStartingFontSize] = useState(16);
  const [startingTexture, setStartingTexture] = useState<NotebookPage["texture"]>("smooth");
  const [exporting, setExporting] = useState(false);
  const [searchablePdf, setSearchablePdf] = useState(false);
  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null);
  const [textOverflow, setTextOverflow] = useState(false);
  const handleEditor = useCallback((editor: Editor | null) => setActiveTextEditor(editor), []);
  useEffect(() => {
    if (!activeTextEditor || activeTextEditor.isDestroyed) { setTextOverflow(false); return; }
    const node = activeTextEditor.view.dom;
    const area = node.closest<HTMLElement>(".notebook-content");
    if (!area) return;
    const check = () => setTextOverflow(node.scrollHeight > area.clientHeight - 8 || node.scrollWidth > area.clientWidth - 8);
    const observer = new ResizeObserver(check);
    observer.observe(node); observer.observe(area);
    activeTextEditor.on("update", check); check();
    return () => { observer.disconnect(); activeTextEditor.off("update", check); };
  }, [activeTextEditor]);

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
    setLive(null); setErased(new Set()); setErasePreview(null); setEraserPoint(null); setSelection(new Set()); setSelectionBox(null); setOffset(null);
    setNodePreview(null); setActiveNode(0); setInkMode((mode) => mode === "nodes" ? "select" : mode);
    setStyleSession(null);
    cancelTransform();
    setIndex((prev) => Math.min(prev, Math.max(0, (next.book?.pages.length ?? 1) - 1)));
  }, [content, cancelTransform]);

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
        <PaperFineControls value={{ lineSpacing: startingSpacing, fontSize: startingFontSize, texture: startingTexture }}
          onChange={(value) => {
            if (value.lineSpacing !== undefined) setStartingSpacing(value.lineSpacing);
            if (value.fontSize !== undefined) setStartingFontSize(value.fontSize);
            if (value.texture !== undefined) setStartingTexture(value.texture);
          }}/>
        <SetupPreview page={{ id: "preview", html: "", paper: startingPaper, size: startingSize, orientation: startingOrientation,
          tint: startingTint, texture: startingTexture, fontSize: startingFontSize, lineSpacing: startingSpacing, strokes: [], stickers: [] }}/>
        <button type="button"
          onClick={() => { commit(fromLegacyNote(content, {
            paper: startingPaper, size: startingSize,
            orientation: startingOrientation, tint: startingTint, lineSpacing: startingSpacing, texture: startingTexture, fontSize: startingFontSize,
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
  const activeTransform = group === "draw" && transformSession?.pageId === page.id && transformSession.source === page.strokes ? transformSession : null;
  const baseStrokes = activeTransform
    ? (transformPreview?.source === activeTransform.source ? transformPreview.strokes : activeTransform.source)
    : nodePreview ? page.strokes.map((s) => s.id === nodePreview.id ? nodePreview : s) : page.strokes;
  const shownStrokes = erasePreview ?? (offset ? translateInk(baseStrokes, selection, offset[0], offset[1], aspect) : baseStrokes);
  const selectedBounds = inkBounds(shownStrokes.filter((s) => selection.has(s.id)), aspect);
  const selectedStroke = selection.size === 1 ? shownStrokes.find((s) => selection.has(s.id)) : undefined;
  const nodeIndices = selectedStroke ? editableInkNodes(selectedStroke) : [];
  const nodeIndex = nodeIndices.includes(activeNode) ? activeNode : nodeIndices.find((i) => {
    const [x, y] = inkWorldPoint(selectedStroke!, i); return x >= 0 && y >= 0 && x <= 1000 && y <= 1000;
  }) ?? nodeIndices[0] ?? 0;
  const insertionAfter = selectedStroke ? Math.min(nodeIndex, nodeIndices[nodeIndices.length - 1] - 1, inkPoints(selectedStroke).length - 2) : -1;
  const canSplit = page.strokes.some((s) => selection.has(s.id) && visibleRanges(s).length > 1);
  const isDrawing = group === "draw" || group === "shapes";
  const selected = page.stickers.find((s) => s.id === selectedSticker) ?? null;
  const coords = (event: PointerEvent<SVGElement>) => {
    const svg = event.currentTarget instanceof SVGSVGElement ? event.currentTarget : event.currentTarget.ownerSVGElement!;
    const rect = svg.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1000, (event.clientX - rect.left) * 1000 / rect.width)),
      Math.max(0, Math.min(1000, (event.clientY - rect.top) * 1000 / rect.height)),
    ] as [number, number];
  };
  const clearGesture = () => {
    gesture.current = null;
    liveRef.current = null; setLive(null); setErased(new Set()); setErasePreview(null); setEraserPoint(null); setSelectionBox(null); setOffset(null);
    setNodePreview(null);
  };
  const finish = () => {
    const activeGesture = gesture.current;
    const stroke = liveRef.current;
    if (!activeGesture) return;
    if (activeGesture.error) { clearGesture(); return; }
    const current = bookRef.current;
    if (!current) { clearGesture(); return; }
    const next = { ...current, pages: current.pages.map((p) => {
      if (p.id !== activeGesture.pageId) return p;
      if (activeGesture.mode === "nodes" && activeGesture.nodeDraft && activeGesture.nodeDraft !== activeGesture.nodeSource)
        return { ...p, strokes: p.strokes.map((s) => s.id === activeGesture.nodeDraft!.id ? activeGesture.nodeDraft! : s) };
      if (stroke?.points.length) return { ...p, strokes: [...p.strokes, group === "draw" ? stabilizePen(stroke, stabilization, aspect) : stroke] };
      if (activeGesture.mode === "eraser" && activeGesture.partialStrokes && activeGesture.partialStrokes !== p.strokes)
        return { ...p, strokes: activeGesture.partialStrokes };
      if (activeGesture.mode === "eraser" && activeGesture.erased.size)
        return { ...p, strokes: p.strokes.filter((s) => !activeGesture.erased.has(s.id)) };
      if (activeGesture.mode === "select" && activeGesture.moving)
        return { ...p, strokes: translateInk(p.strokes, selection, activeGesture.last[0] - activeGesture.start[0], activeGesture.last[1] - activeGesture.start[1], aspect) };
      return p;
    }) };
    if (next.pages.some((p, i) => p !== current.pages[i]) && !commit(next)) { clearGesture(); return; }
    clearGesture();
  };
  const eraseAt = (from: Point, to: Point, active: InkGesture) => {
    if (active.error) return;
    if (active.eraserKind === "segment") {
      try {
        const current = active.partialStrokes ?? page.strokes;
        const next = eraseInkSegments(current, from, to, eraserWidth / 2, aspect);
        if (next !== current) { active.partialStrokes = next; setErasePreview(next); }
      } catch (error) {
        active.error = error instanceof Error ? error.message : "تعذر حفظ حركة الممحاة؛ بقي الحبر الأصلي كما هو.";
        active.partialStrokes = undefined; setErasePreview(null); setWarning(active.error);
      }
      return;
    }
    for (const stroke of page.strokes)
      if (hitStroke(stroke, from, to, eraserWidth / 2, aspect)) active.erased.add(stroke.id);
    setErased(new Set(active.erased));
  };
  const startInk = (event: PointerEvent<SVGSVGElement>) => {
    if (transformSession || !isDrawing || !event.isPrimary || (event.button !== 0 && event.button !== 5) || gesture.current) return;
    if (event.pointerType === "pen") lastPen.current = Date.now();
    if (event.pointerType === "touch" && (penOnly || Date.now() - lastPen.current < 800)) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    const mode = event.button === 5 || (event.buttons & 32) ? "eraser" : group === "shapes" ? "pen" : inkMode;
    const position = coords(event);
    if (mode === "nodes") {
      const hit = [...page.strokes].reverse().find((s) => hitStroke(s, position, position, 12, aspect));
      if (hit) { setSelection(new Set([hit.id])); setActiveNode(nearestInkNode(hit, position, aspect)); }
      else { setInkMode("select"); setSelection(new Set()); }
      return;
    }
    if ((mode === "pen" || mode === "highlighter") && page.strokes.length >= 350) {
      setWarning("وصلت هذه الصفحة إلى حد 350 مسارًا. أضف صفحة أخرى للحفاظ على سرعة الدفتر."); return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const active: InkGesture = { pointerId: event.pointerId, pageId: page.id, mode, start: position, last: position,
      erased: new Set(), moving: false, eraserKind };
    gesture.current = active;
    if (mode === "eraser") { setEraserPoint(position); eraseAt(position, position, active); return; }
    if (mode === "select") {
      const hit = [...page.strokes].reverse().find((s) => hitStroke(s, position, position, 10, aspect));
      if (hit) {
        if (!selection.has(hit.id)) setSelection(new Set([hit.id]));
        active.moving = true;
      } else { setSelection(new Set()); setSelectionBox({ x: position[0], y: position[1], width: 0, height: 0 }); }
      return;
    }
    setSelection(new Set());
    const pressured = group === "draw" && mode === "pen" && pressureEnabled && event.pointerType === "pen";
    liveRef.current = {
      id: crypto.randomUUID(),
      tool: mode, color: mode === "highlighter" ? "#f2c94c" : penColor,
      width: mode === "highlighter" ? penWidth * 4 : penWidth,
      points: [position], smoothing: group === "shapes" ? false : smooth,
      ...(group === "draw" && mode === "pen" && penBrush ? { brush: penBrush } : {}),
      ...(group === "draw" ? { times: [Math.round(performance.timeOrigin + event.nativeEvent.timeStamp)] } : {}),
      ...(pressured ? { pressures: [event.pressure], ...(sensitivity !== 1 ? { pressureResponse: sensitivity } : {}) } : {}),
    };
    setLive(liveRef.current);
  };
  const moveInk = (event: PointerEvent<SVGSVGElement>) => {
    if (isDrawing && (inkMode === "eraser" || (event.buttons & 32))) setEraserPoint(coords(event));
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (active.mode === "nodes" && active.nodeSource && active.nodeIndex !== undefined) {
      const next = coords(event), point = inkWorldPoint(active.nodeSource, active.nodeIndex);
      active.nodeDraft = editInkPoint(active.nodeSource, active.nodeIndex,
        [point[0] + next[0] - active.start[0], point[1] + next[1] - active.start[1]]);
      active.last = next; setNodePreview(active.nodeDraft); return;
    }
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
            const b = inkBounds([s], aspect);
            return !!b && b.x >= box.x && b.y >= box.y && b.x + b.width <= box.x + box.width && b.y + b.height <= box.y + box.height;
          }).map((s) => s.id)));
        }
      } else if (liveRef.current && group === "shapes") {
        liveRef.current = { ...liveRef.current, points: shapePoints(active.start, next, shapeTool, aspect) };
      } else if (liveRef.current) {
        if (shouldCaptureInkSample(liveRef.current,next,aspect,sample)) {
          if (liveRef.current.points.length >= 4000) {
            finish(); setWarning("تم حفظ المسار الطويل. ارفع القلم لبدء مسار جديد."); return;
          }
          const stroke = liveRef.current;
          liveRef.current = { ...stroke, points: [...stroke.points, next],
            ...(stroke.times ? { times: [...stroke.times, Math.max(stroke.times[stroke.times.length - 1], Math.round(performance.timeOrigin + sample.timeStamp))] } : {}),
            ...(stroke.pressures ? { pressures: [...stroke.pressures, sample.pressure] } : {}) };
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
    if (inkMode === "nodes") {
      const retained = new Set([...selection].filter((id) => marks.strokes.some((s) => s.id === id)));
      setSelection(retained);
      if (retained.size !== 1) setInkMode("select");
    } else setSelection(new Set());
  };
  const enterNodes = () => {
    finish();
    if (!selectedStroke || !nodeIndices.length) return;
    const visible = nodeIndices.find((i) => { const [x, y] = inkWorldPoint(selectedStroke, i); return x >= 0 && x <= 1000 && y >= 0 && y <= 1000; });
    setActiveNode(visible ?? nodeIndex); setInkMode("nodes");
  };
  const applySelectedEdit = (edit: (stroke: InkStroke) => InkStroke): boolean => {
    finish();
    const current = bookRef.current, id = selection.size === 1 ? [...selection][0] : null;
    const source = current?.pages[index]?.strokes.find((s) => s.id === id);
    if (!current || !source) return false;
    try {
      const result = edit(source);
      if (result === source) return true;
      return commit({ ...current, pages: current.pages.map((p, i) => i === index
        ? { ...p, strokes: p.strokes.map((s) => s.id === source.id ? result : s) } : p) });
    } catch (error) { setWarning(error instanceof Error ? error.message : "تعذر تعديل النقطة؛ بقي الأصل محفوظًا."); return false; }
  };
  const nudgeNode = (key: string, shift: boolean) => {
    if (!selectedStroke || !nodeIndices.length) return;
    const p = inkWorldPoint(selectedStroke, nodeIndex), step = shift ? 10 : 1;
    applySelectedEdit((s) => editInkPoint(s, nodeIndex,
      [p[0] + (key === "ArrowRight" ? step : key === "ArrowLeft" ? -step : 0),
        p[1] + (key === "ArrowDown" ? step : key === "ArrowUp" ? -step : 0)]));
  };
  const removeNode = () => {
    if (applySelectedEdit((s) => deleteInkPoint(s, nodeIndex))) setActiveNode(Math.max(0, nodeIndex - 1));
  };
  const insertNode = (after: number) => {
    if (applySelectedEdit((s) => insertInkPoint(s, after))) setActiveNode(after + 1);
  };
  const startNode = (event: PointerEvent<SVGCircleElement>) => {
    if (!event.isPrimary || event.button !== 0 || gesture.current || !selectedStroke) return;
    if (event.pointerType === "pen") lastPen.current = Date.now();
    if (event.pointerType === "touch" && (penOnly || Date.now() - lastPen.current < 800)) return;
    const source = bookRef.current?.pages[index]?.strokes.find((s) => s.id === selectedStroke.id);
    if (!source) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true });
    const position = coords(event);
    gesture.current = { pointerId: event.pointerId, pageId: page.id, mode: "nodes", start: position, last: position,
      erased: new Set(), moving: false, eraserKind, nodeSource: source, nodeIndex };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const separateSelection = () => {
    finish(); const current = bookRef.current;
    if (!current) return;
    try {
      const room = MAX_NOTEBOOK_BYTES - new TextEncoder().encode(JSON.stringify(current)).byteLength;
      const result = splitInk(current.pages[index].strokes, selection, room);
      if (!result.created.length) return;
      if (!commit({ ...current, pages: current.pages.map((p, i) => i === index ? { ...p, strokes: result.strokes } : p) })) return;
      setSelection(new Set([result.created[0]])); setInkMode("select"); setActiveNode(0);
    } catch (error) { setWarning(error instanceof Error ? error.message : "تعذر فصل الأجزاء؛ بقي الأصل محفوظًا."); }
  };
  const beginStyle = () => {
    finish();const current=bookRef.current,active=current?.pages[index];
    if(!current||!active||!selection.size)return;
    setStyleSession({pageId:active.id,source:active.strokes,ids:new Set(selection),aspect,
      remainingBytes:Math.max(0,MAX_NOTEBOOK_BYTES-new TextEncoder().encode(JSON.stringify(current)).byteLength)});
  };
  const applyStyle = (preview:InkStylePreview) => {
    const current=bookRef.current,active=current?.pages[index];
    if(!styleSession||!preview.changed||preview.error)return false;
    if(!current||!active||active.id!==styleSession.pageId||active.strokes!==styleSession.source||preview.source!==styleSession.source){
      setStyleSession(null);setWarning("تغير الحبر أثناء المعاينة؛ أعد تحديده لتعديل النمط.");return false;
    }
    const saved=commit({...current,pages:current.pages.map(p=>p.id===active.id?{...p,strokes:preview.strokes}:p)});
    if(saved)setStyleSession(null);return saved;
  };
  const beginTransform = () => {
    finish(); const current = bookRef.current, active = current?.pages[index];
    if (!current || !active || !selection.size) return;
    setTransformDraft({ size: "100", rotation: "0" }); transformCancelDrag.current = null; setTransformDragging(false);
    setTransformPreview(null); setInkMode("select"); setWarning("");
    setTransformSession({ pageId: active.id, source: active.strokes, ids: new Set(selection),
      remainingBytes: Math.max(0, MAX_NOTEBOOK_BYTES - new TextEncoder().encode(JSON.stringify(current)).byteLength) });
  };
  const applyTransform = (preview: InkTransformPreview) => {
    const current = bookRef.current, active = current?.pages[index];
    if (!transformSession || transformCancelDrag.current || transformDragging || !preview.changed || preview.error) return;
    if (!current || !active || active.id !== transformSession.pageId || active.strokes !== transformSession.source || preview.source !== transformSession.source) {
      cancelTransform(); setWarning("تغير الرسم أثناء المعاينة؛ بقي التعديل الأحدث محفوظًا. أعد تحديد الرسم وتحويله."); return;
    }
    if (commit({ ...current, pages: current.pages.map((p) => p.id === active.id ? { ...p, strokes: preview.strokes } : p) })) cancelTransform();
  };
  const addSticker = (kind: PageSticker["kind"]) => {
    updatePage((p) => {
      if (p.stickers.length >= 120) { setWarning("الصفحة تحتوي الحد الأقصى من الملصقات."); return p; }
      const stamp: PageSticker = {
        id: crypto.randomUUID(), kind, color: "#3275ba",
        presentation: (kind.startsWith("sci-") || kind.startsWith("fl-")) ? "cutout" : "badge", rotation: 0,
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
    const next = createPage({ paper: page.paper, size: page.size, orientation: page.orientation, tint: page.tint, texture: page.texture, lineSpacing: page.lineSpacing, fontSize: page.fontSize });
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
      await downloadNotebookPdf(bookRef.current!, filename, { searchable: searchablePdf });
    } catch (error) {
      setWarning(error instanceof Error ? error.message : "تعذر تصدير ملف PDF.");
    } finally { setExporting(false); }
  };

  const controlCls = (active: boolean) => "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed " +
    (active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-accent");
  return (
    <section className="space-y-3" aria-label="دفتر المذكرة متعدد الصفحات"
      onKeyDown={(event) => {
        if(styleSession)return;
        const inCanvas = (event.target as Element).closest("svg[data-ink-editor]");
        if (transformSession) {
          if (event.key === "Escape" && transformCancelDrag.current) {
            event.preventDefault(); event.stopPropagation(); transformCancelDrag.current(); return;
          }
          if (event.key === "Escape" || ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase()) &&
              !(event.target as Element).closest("input,textarea,[contenteditable=true]"))) {
            event.preventDefault(); cancelTransform();
          }
          return;
        }
        if (inCanvas && event.key === "Escape") {
          event.preventDefault();
          if (gesture.current) clearGesture(); else if (inkMode === "nodes") setInkMode("select");
          return;
        }
        if (inCanvas && inkMode === "nodes" && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault(); nudgeNode(event.key, event.shiftKey); return;
        }
        if (inCanvas && inkMode === "nodes" && ["Delete", "Backspace"].includes(event.key)) {
          event.preventDefault(); removeNode(); return;
        }
        if (inCanvas && !gesture.current && !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat) {
          const tool=({KeyP:"pen",KeyE:"eraser",KeyV:"select",KeyH:"highlighter"} as const)[event.code as "KeyP"|"KeyE"|"KeyV"|"KeyH"];
          if(tool){event.preventDefault();setGroup("draw");setInkMode(tool);return;}
        }
        if (!isDrawing || !(event.ctrlKey || event.metaKey) ||
          (event.target as Element).closest("input,textarea,[contenteditable=true]")) return;
        const key = event.key.toLowerCase();
        if (key === "z" || key === "y") {
          event.preventDefault(); historyStep(key === "y" || event.shiftKey);
        }
      }}>
      <header className="sticky top-2 z-40 rounded-2xl border border-border bg-card/95 p-2 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <div className="min-w-0 flex-1 sm:flex-none">
            <h2 className="truncate text-sm font-bold">دفتر المذاكرة</h2>
            <p className="truncate text-[11px] text-muted-foreground">{book.pages.length} صفحة · {SIZE_LABELS[page.size]} · {PAPER_LABELS[page.paper]}</p>
          </div>
          <div className="order-3 grid w-full grid-cols-5 gap-1 sm:order-none sm:mx-auto sm:flex sm:w-auto" role="tablist" aria-label="مجموعات أدوات الدفتر">
          {([
            ["text", "كتابة", PenLine],
            ["draw", "أقلام", Brush],
            ["shapes", "رسم", Shapes],
            ["stickers", "ملصقات", Sticker],
            ["paper", "ورق", Layers],
          ] as const).map(([key, label, Icon]) => (
            <ToolButton role="tab" key={key} label={label} active={group === key} aria-selected={group === key}
              onClick={() => { finish(); if (key !== group) cancelTransform(); setFocusMode(false); setGroup(key); setSelectedSticker(null); }}
              className="min-w-0 rounded-xl">
              <Icon className="size-5" />
            </ToolButton>
          ))}
          </div>
          <div className="flex shrink-0 gap-1">
            <ToolButton label="وضع التركيز" active={focusMode} aria-pressed={focusMode} onClick={() => { finish(); setFocusMode(!focusMode); }}><ScanLine className="size-4"/></ToolButton>
            <ToolButton label={exporting ? "تصدير..." : "تصدير صفحات الدفتر PDF"} disabled={exporting || !!transformSession} onClick={() => { void exportPdf(); }}>
              <FileDown className="size-4" />
            </ToolButton>
          </div>
        </div>
      </header>

      {!focusMode && group === "draw" && (
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-border bg-card p-3">
          {activeTransform ? <InkTransformPanel source={activeTransform.source} ids={activeTransform.ids} aspect={aspect}
            remainingBytes={activeTransform.remainingBytes} draft={transformDraft} onDraft={setTransformDraft} dragging={transformDragging}
            onPreview={handleTransformPreview} onApply={applyTransform} onCancel={cancelTransform}/> : <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="أدوات الرسم">
            <button type="button" className={controlCls(false)} aria-label="تحسين الخط والتعرف العربي"
              onClick={() => { finish(); setRecognitionSource({ page: bookRef.current!.pages[index], selection: new Set(selection) }); }}>
              <ScanText className="size-4"/>تعرف عربي · تجريبي
            </button>
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
          {preferenceScope && <PenFavorites key={preferenceScope} scope={preferenceScope}
            value={{color:penColor,width:penWidth,brush:penBrush??"solid",smooth,stabilization,pressureEnabled,sensitivity}}
            onUse={(pen)=>{finish();setInkMode("pen");setPenColor(pen.color);setPenWidth(pen.width);setPenBrush(pen.brush==="solid"?undefined:pen.brush);
              setSmooth(pen.smooth);setStabilization(pen.stabilization);setPressureEnabled(pen.pressureEnabled);setSensitivity(pen.sensitivity);}}/>}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><PenLine className="size-4"/>أقلام الكتابة</h3>
              <div className="flex flex-wrap gap-2" role="group" aria-label="أنواع أقلام الكتابة">
                <button type="button" className={controlCls(!penBrush && stabilization === 0 && inkMode === "pen")} onClick={() => { finish(); setPenBrush(undefined); setInkMode("pen"); setStabilization(0); setPenWidth(3); }}>قلم دقيق</button>
                <button type="button" className={controlCls(!penBrush && stabilization === .55 && inkMode === "pen")} onClick={() => { finish(); setPenBrush(undefined); setInkMode("pen"); setStabilization(.55); setPenWidth(4); setSmooth(true); }}>قلم سلس</button>
                <button type="button" className={controlCls(!penBrush && stabilization === .75 && inkMode === "pen")} onClick={() => { finish(); setPenBrush(undefined); setInkMode("pen"); setStabilization(.75); setPenWidth(8); setSmooth(true); setPressureEnabled(true); }}>قلم رسم ناعم</button>
              </div>
            </div>
            <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Brush className="size-4"/>خامات الرسم</h3>
              <div className="flex flex-wrap gap-2" role="group" aria-label="خامات الرسم">
                <button type="button" className={controlCls(!penBrush && inkMode === "pen")} aria-pressed={!penBrush && inkMode === "pen"}
                  onClick={() => { finish(); setPenBrush(undefined); setInkMode("pen"); }}>حبر مصمت</button>
                <button type="button" className={controlCls(penBrush === "pencil" && inkMode === "pen")} aria-pressed={penBrush === "pencil" && inkMode === "pen"}
                  onClick={() => { finish(); setPenBrush("pencil"); setInkMode("pen"); setPenWidth(8); setPenColor("#4b5563"); setStabilization(.55); setSmooth(true); }}>قلم رصاص</button>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">قلم الرصاص بخامة حبيبية ثابتة على الورق. التنعيم يحسن المسار، ولا يتعرف على الحروف. الإعدادات للرسم الجديد.</p>
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
              <output>{sensitivity.toFixed(1)}</output>
            </label>
            {inkMode === "eraser" && <label className="flex items-center gap-2">عرض الممحاة
              <input type="range" aria-label="عرض ممحاة المسارات" min={6} max={60} value={eraserWidth}
                onChange={(e) => setEraserWidth(Number(e.target.value))}/>
            </label>}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="إعدادات استجابة الضغط">
            {([{ value: .6, label: "ضغط خفيف" }, { value: 1, label: "ضغط متوازن" }, { value: 1.4, label: "ضغط قوي" }]).map(({ value, label }) => (
              <button key={value} type="button" className={controlCls(sensitivity === value)} aria-pressed={sensitivity === value}
                disabled={!pressureEnabled} onClick={() => { finish(); setSensitivity(value); }}>{label}</button>
            ))}
          </div>
          <PenResponsePreview response={sensitivity} width={penWidth} color={penColor} enabled={pressureEnabled} brush={penBrush}/>
          {inkMode === "eraser" && <div className="space-y-2 rounded-xl bg-secondary/50 p-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="نوع ممحاة الحبر">
              <button type="button" aria-label="مسح جزء من المسار" aria-pressed={eraserKind === "segment"}
                className={controlCls(eraserKind === "segment")} onClick={() => { finish(); setEraserKind("segment"); }}>جزء من المسار</button>
              <button type="button" aria-label="مسح المسار كاملًا" aria-pressed={eraserKind === "stroke"}
                className={controlCls(eraserKind === "stroke")} onClick={() => { finish(); setEraserKind("stroke"); }}>المسار كاملًا</button>
            </div>
            <p className="text-xs leading-6 text-muted-foreground">المسح الجزئي يزيل مقاطع من الضربة بعرضها الكامل. تتحرك الأجزاء المتبقية معًا عند تحديد الضربة، ويمكن التراجع عن حركة المسح كاملة بخطوة واحدة.</p>
          </div>}
          {inkMode === "select" && <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={controlCls(false)} onClick={() => setSelection(new Set(page.strokes.map((s) => s.id)))}><ScanLine className="size-4"/>تحديد كل الرسم</button>
            <button type="button" className={controlCls(false)} disabled={!canSplit} onClick={separateSelection}><Scissors className="size-4"/>فصل الأجزاء الممسوحة</button>
            <button type="button" className={controlCls(false)} disabled={!selectedStroke || !nodeIndices.length} onClick={enterNodes}><Waypoints className="size-4"/>تحرير نقاط المسار</button>
            <button type="button" className={controlCls(false)} disabled={!selection.size} onClick={beginTransform}><RotateCw className="size-4"/>تغيير الحجم والتدوير</button>
            <button type="button" className={controlCls(false)} disabled={!selection.size} onClick={beginStyle}><Brush className="size-4"/>تعديل نمط الحبر</button>
            <button type="button" className={controlCls(false)} disabled={!selection.size} onClick={() => {
              updatePage((p) => ({ ...p, strokes: p.strokes.filter((s) => !selection.has(s.id)) })); setSelection(new Set());
            }}><Trash2 className="size-4"/>حذف المحدد ({selection.size})</button>
          </div>}
          {inkMode === "nodes" && selectedStroke && nodeIndices.length > 0 && <InkPointPanel stroke={selectedStroke}
            indices={nodeIndices} active={nodeIndex} onSelect={setActiveNode}
            onPosition={(position) => applySelectedEdit((s) => editInkPoint(s, nodeIndex, position))}
            onInsert={insertNode}
            onDelete={removeNode}
            onReset={() => { applySelectedEdit(resetInkGeometry); }} onDone={() => { finish(); setInkMode("select"); }}/>}
          <p className="text-xs leading-6 text-muted-foreground">
            عند تركيز مساحة الرسم: P قلم، E ممحاة، V تحديد، H مظلل.
            الضغط يعمل مع الأقلام التي ترسل بيانات ضغط. اختر للممحاة مسح مقطع أو ضربة كاملة، وكلاهما قابل للتراجع.
            للتحديد اسحب إطارًا حول الرسم، ثم اسحب أي خط محدد لتحريكه. تنعيم المسار لا يتعرف على الحروف العربية.
          </p>
          </>}
        </div>
      )}
      {!focusMode && group === "shapes" && <div className="max-h-64 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="أشكال الرسم الهندسي">
          {([["line", "خط", Minus], ["arrow", "سهم", ArrowUpRight], ["rectangle", "مستطيل", Square], ["ellipse", "دائرة وبيضاوي", Circle]] as const).map(([key, label, Icon]) =>
            <button type="button" key={key} className={controlCls(shapeTool === key)} aria-pressed={shapeTool === key}
              onClick={() => { finish(); setShapeTool(key); }}><Icon className="size-4"/>{label}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">لون الرسم<input type="color" aria-label="لون الرسم الهندسي" value={penColor} onChange={(e) => setPenColor(e.target.value)}/></label>
          <label className="flex items-center gap-2">السمك<input type="range" aria-label="سمك الرسم الهندسي" min={1} max={10} value={penWidth} onChange={(e) => setPenWidth(Number(e.target.value))}/></label>
          <button type="button" className={controlCls(false)} disabled={!history.current.canUndo(page.id)} onClick={() => historyStep(false)}><Undo2 className="size-4"/>تراجع الشكل</button>
          <button type="button" className={controlCls(false)} disabled={!history.current.canRedo(page.id)} onClick={() => historyStep(true)}><Redo2 className="size-4"/>إعادة الشكل</button>
        </div>
        <p className="text-xs text-muted-foreground">اسحب على الورقة لرسم الشكل. يمكنك تحديده وتحريكه أو مسحه من مجموعة الأقلام.</p>
      </div>}
      {!focusMode && group === "stickers" && (
        <div className="max-h-56 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-3 sm:max-h-[22rem]">
          <div className="sticky top-0 z-10 -mt-3 space-y-2 bg-card pb-2 pt-3 before:absolute before:-top-4 before:inset-x-0 before:h-4 before:bg-card before:content-['']">
            <div className="flex items-center justify-between gap-2 text-xs">
              <strong className="font-semibold">مكتبة الملصقات</strong>
              <span className="text-muted-foreground">{searchStickers(stickerQuery, stickerGroup).length} ملصق</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="مجموعات الملصقات">
              {STICKER_GROUPS.map((pack) => (
                <button type="button" key={pack.id} aria-pressed={stickerGroup === pack.id}
                  onClick={() => { setStickerGroup(pack.id); setStickerQuery(""); }}
                  className={controlCls(stickerGroup === pack.id) + " shrink-0 whitespace-nowrap"}>{pack.label}</button>
              ))}
            </div>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3">
              <Search className="size-4 text-muted-foreground"/>
              <input type="search" aria-label="بحث الملصقات" value={stickerQuery} onChange={(e) => setStickerQuery(e.target.value)}
                placeholder="ابحث: عظام، محاسبة، neuron..." className="min-h-11 w-full bg-transparent text-sm outline-none"/>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2 min-[375px]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-7" aria-label="نتائج الملصقات">
            {searchStickers(stickerQuery, stickerGroup).map(([kind, label]) => {
              const Icon = stickerIcon(kind);
              return <button type="button" key={kind} title={label} aria-label={"إضافة ملصق " + label}
                onClick={() => addSticker(kind)}
                className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-secondary/60 p-2 hover:border-primary">
                <span className="grid size-12 place-items-center rounded-xl bg-[#f6faff] text-[#2564ad]"><Icon size={(kind.startsWith("sci-") || kind.startsWith("fl-")) ? 42 : 25} strokeWidth={1.9}/></span>
                <span className="text-center text-[10px] leading-4">{label}</span>
              </button>;
            })}
          </div>
          {searchStickers(stickerQuery, stickerGroup).length === 0 && <p role="status" className="text-sm text-muted-foreground">لا توجد ملصقات مطابقة. جرّب كلمة أخرى.</p>}
          <details className="text-xs leading-6 text-muted-foreground"><summary className="cursor-pointer">مصادر الملصقات وترخيص استخدامها</summary>
            <p>Lucide: ISC/MIT. الرسومات العلمية: SciSVG — Saveena Solanki، بترخيص CC BY 4.0. تظهر نسبة الرسومات لمصدرها في الصفحات وملفات PDF التي تستخدمها.</p>
            <a href="https://github.com/SaveenaSolanki/SciSVG" target="_blank" rel="noopener noreferrer" className="underline">مصدر SciSVG</a>
          </details>
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
                disabled={(selected.kind.startsWith("sci-") || selected.kind.startsWith("fl-")) && (selected.presentation ?? "cutout") === "cutout"}
                title={(selected.kind.startsWith("sci-") || selected.kind.startsWith("fl-")) ? "لتغيير لون خلفية الرسم فعّل خلفية الختم أولًا" : "لون الملصق"}
                onChange={(e) => updatePage((p) => ({
                  ...p, stickers: p.stickers.map((s) => s.id === selected.id ? { ...s, color: e.target.value } : s),
                }))} />
              <label className="flex items-center gap-2 text-xs">الدوران
                <input type="range" aria-label="دوران الملصق" min={-180} max={180} step={5} value={selected.rotation ?? 0}
                  onChange={(e) => updatePage((p) => ({ ...p, stickers: p.stickers.map((s) => s.id === selected.id ? { ...s, rotation: Number(e.target.value) } : s) }))}/>
                <span dir="ltr">{selected.rotation ?? 0}°</span>
              </label>
              <button type="button" className={controlCls(false)} onClick={() => updatePage((p) => ({ ...p,
                stickers: p.stickers.map((s) => s.id === selected.id ? { ...s, presentation: (s.presentation ?? ((s.kind.startsWith("sci-") || s.kind.startsWith("fl-")) ? "cutout" : "badge")) === "badge" ? "cutout" : "badge" } : s),
              }))}>تبديل خلفية الملصق</button>
              <button type="button" className={controlCls(false)} onClick={() => {
                updatePage((p) => ({ ...p, stickers: p.stickers.filter((s) => s.id !== selected.id) }));
                setSelectedSticker(null);
              }}><Trash2 className="size-4"/>حذف الملصق</button>
              {(selected.kind.startsWith("sci-") || selected.kind.startsWith("fl-")) && <p className="w-full text-xs text-muted-foreground">ألوان الملصق الأصلية محفوظة. يمكنك تلوين خلفيته بعد تفعيل الختم.</p>}
            </div>
          )}
          <p className="text-xs text-muted-foreground">اضغط لإضافة الملصق، واسحبه على الصفحة لتحريك موضعه.</p>
        </div>
      )}
      {!focusMode && group === "paper" && (
        <div className="max-h-56 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-3 sm:max-h-[22rem]">
          <div className="flex items-center justify-between gap-2 text-xs">
            <strong className="font-semibold">خلفية الورقة</strong>
            <span className="text-muted-foreground">اسحب المعاينات لعرض بقية الأشكال</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="خلفيات الورق">
            {PAPER_TYPES.map((p) => (
              <button type="button" key={p} aria-pressed={page.paper === p}
                onClick={() => updatePage((old) => ({ ...old, paper: p, lineSpacing: old.lineSpacing ?? 32, fontSize: old.fontSize ?? 16, texture: old.texture ?? "smooth" }))}
                className={"flex min-h-24 min-w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 p-1.5 text-xs " + (page.paper === p ? "border-primary bg-primary/10" : "border-border bg-background")}>
                <span className="relative block h-12 w-9 overflow-hidden rounded border border-[#d2d8dc]" style={paperStyle({ ...page, paper: p })}>
                  <PaperGuides page={{ ...page, paper: p, lineSpacing: page.lineSpacing ?? 32 }} preview/>
                </span>
                {PAPER_LABELS[p]}
              </button>
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
          <PaperFineControls value={page} onChange={(value) => updatePage((p) => ({ ...p, lineSpacing: p.lineSpacing ?? 32, fontSize: p.fontSize ?? 16, texture: p.texture ?? "smooth", ...value }))}/>
          <p className="text-xs leading-6 text-muted-foreground">تُحفظ إعدادات كل صفحة. تباعد السطور يضبط ارتفاع سطور النص الأساسي أيضًا. التقسيمات خلفيات للكتابة والرسم، ويمكن وضع النص والملصقات فوقها.</p>
          <fieldset className="space-y-2 rounded-xl border border-border p-3">
            <legend className="px-1 text-sm font-semibold">تصدير PDF</legend>
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={searchablePdf} disabled={exporting}
              aria-label="تضمين نص الكيبورد للبحث والنسخ في PDF" onChange={(event) => setSearchablePdf(event.target.checked)}/>طبقة بحث نصية · تجريبية</label>
            <p className="text-xs leading-6 text-muted-foreground">تخص كلمات الكيبورد فقط؛ لا تتعرف على الحبر أو الصور والملصقات. قد تختلف المسافات وترتيب العربية والتشكيل عند النسخ أو البحث بجملة كاملة بين قارئات PDF؛ راجع الناتج قبل مشاركته. التصدير المصور هو الافتراضي، ولا يتغير محتوى المذكرة.</p>
          </fieldset>
        </div>
      )}

      {!focusMode && group === "text" && activeTextEditor && (
        <CompactToolbar editor={activeTextEditor} onAddAttachment={onAddAttachment} workspace />
      )}
      <div className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-0.5 text-xs">
        <div className="flex min-w-0 items-center gap-1">
          <div className="flex shrink-0 items-center gap-1" role="group" aria-label="التنقل السريع بين الصفحات">
            <ToolButton label="الصفحة السابقة" disabled={index === 0 || !!transformSession}
              onClick={() => { finish(); setIndex(index - 1); setSelectedSticker(null); setSelection(new Set()); }}><ChevronRight className="size-4"/></ToolButton>
            <span dir="ltr" aria-label={`الصفحة ${index + 1} من ${book.pages.length}`} aria-live="polite" className="min-w-10 text-center tabular-nums">{index + 1} / {book.pages.length}</span>
            <ToolButton label="الصفحة التالية" disabled={index === book.pages.length - 1 || !!transformSession}
              onClick={() => { finish(); setIndex(index + 1); setSelectedSticker(null); setSelection(new Set()); }}><ChevronLeft className="size-4"/></ToolButton>
          </div>
          <span className="hidden min-w-0 truncate text-muted-foreground md:inline">{pageW} × {pageH} مم</span>
        </div>
        <label className="flex shrink-0 items-center gap-1 sm:hidden"><ZoomIn className="size-4"/>
          <span className="sr-only">تكبير صفحة الدفتر</span>
          <select aria-label="مستوى تكبير صفحة الدفتر" value={zoom === null ? "fit" : String(zoom)}
            disabled={transformDragging} onChange={(event) => setZoom(event.target.value === "fit" ? null : Number(event.target.value))}
            className="min-h-11 rounded-xl border border-border bg-background px-2 font-semibold">
            <option value="fit">ملاءمة</option><option value="1">100%</option><option value="1.5">150%</option>
          </select>
        </label>
        <div className="hidden items-center gap-1 sm:flex" role="group" aria-label="تكبير صفحة الدفتر">
          <ZoomIn className="mx-1 size-4"/>
          <button type="button" className={controlCls(zoom === null)} disabled={transformDragging} onClick={() => setZoom(null)}>ملاءمة</button>
          <button type="button" className={controlCls(zoom === 1)} disabled={transformDragging} onClick={() => setZoom(1)}>100%</button>
          <button type="button" className={controlCls(zoom === 1.5)} disabled={transformDragging} onClick={() => setZoom(1.5)}>150%</button>
        </div>
      </div>
      <div ref={viewport} className="w-full overflow-auto rounded-xl bg-secondary/40" dir="ltr" aria-label="منطقة عرض الورقة">
        <div className="relative mx-auto" style={{ width: layout.width * displayScale, height: layout.height * displayScale }}>
        <div data-notebook-paper={page.paper} dir="rtl"
          className="notebook-sheet absolute left-0 top-0 isolate overflow-hidden shadow-md"
          style={{ ...paperStyle(page), ...paperTextStyle(page), width: layout.width, height: layout.height,
            transform: `scale(${displayScale})`, transformOrigin: "top left" }}>
          <PaperGuides page={page}/>
          <div className="notebook-content absolute z-10">
            <RichEditor key={page.id} value={page.html}
              onChange={(html) => updatePage((p) => ({ ...p, html }))}
              onAddAttachment={onAddAttachment} toolbarMode="none"
              onEditorReady={handleEditor}
              paperMode placeholder="ابدأ الكتابة في هذه الصفحة..." />
          </div>
          {(isDrawing || page.strokes.length > 0) && (
            <svg viewBox={`0 0 1000 ${1000 * aspect}`} preserveAspectRatio="none"
              data-ink-editor="canvas"
              role={isDrawing ? "img" : undefined} aria-label={isDrawing ? "مساحة الرسم بالقلم" : undefined}
              tabIndex={isDrawing ? 0 : -1}
              aria-hidden={!isDrawing || undefined}
              onPointerDown={startInk} onPointerMove={moveInk}
              onPointerUp={(e) => { if (gesture.current?.pointerId === e.pointerId) { moveInk(e); finish(); } }}
              onPointerCancel={(e) => { if (gesture.current?.pointerId === e.pointerId) clearGesture(); }}
              onLostPointerCapture={(e) => { if (gesture.current?.pointerId === e.pointerId) finish(); }}
              onPointerLeave={() => { if (!gesture.current) setEraserPoint(null); }}
              className={"absolute inset-0 z-20 size-full " + (isDrawing ? transformSession ? "cursor-default" : "cursor-crosshair" : "pointer-events-none")}
              style={{ touchAction: isDrawing && !transformSession && !penOnly ? "none" : "pan-x pan-y" }}>
              <InkLayer strokes={shownStrokes.filter((s) => !erased.has(s.id))} aspect={aspect} selected={isDrawing ? selection : undefined}/>
              {live && <InkMark stroke={group === "draw" ? stabilizePen(live, stabilization, aspect) : live} aspect={aspect} />}
              {isDrawing && eraserPoint && <circle cx={eraserPoint[0]} cy={eraserPoint[1] * aspect} r={eraserWidth / 2}
                fill="#4488ff12" stroke="#3275ba" strokeWidth={1.5} strokeDasharray="3 3" pointerEvents="none"/>}
              {isDrawing && !activeTransform && inkMode === "select" && (selectionBox || selectedBounds) && (() => {
                const b = selectionBox || selectedBounds!;
                return <rect x={b.x - 5} y={(b.y - 5) * aspect} width={b.width + 10} height={(b.height + 10) * aspect}
                  fill="#4488ff15" stroke="#3275ba" strokeWidth={2} strokeDasharray="8 5" pointerEvents="none"/>;
              })()}
            </svg>
          )}
          {activeTransform && <InkTransformHandles source={activeTransform.source} ids={activeTransform.ids} aspect={aspect}
            unitsPerPixel={1000 / (layout.width * displayScale)} draft={transformDraft} error={!!transformPreview?.error}
            onChange={setTransformDraft} onGesture={handleTransformGesture} allowPointer={(event) => {
              if (event.pointerType === "pen") lastPen.current = Date.now();
              return !(event.pointerType === "touch" && (penOnly || Date.now() - lastPen.current < 800));
            }}/>}
          {isDrawing && inkMode === "nodes" && selectedStroke && nodeIndices.length > 0 && <svg
            viewBox={`0 0 1000 ${1000 * aspect}`} preserveAspectRatio="none" data-ink-editor="nodes"
            role="group" aria-label="نقاط التحكم في المسار" className="pointer-events-none absolute inset-0 z-[35] size-full"
            onPointerMove={moveInk} onPointerUp={(e) => { if (gesture.current?.pointerId === e.pointerId) { moveInk(e); finish(); } }}
            onPointerCancel={(e) => { if (gesture.current?.pointerId === e.pointerId) clearGesture(); }}
            onLostPointerCapture={(e) => { if (gesture.current?.pointerId === e.pointerId) finish(); }}>
            <InkPointOverlay stroke={selectedStroke} indices={nodeIndices} active={nodeIndex} aspect={aspect}
              unitsPerPixel={1000 / (layout.width * displayScale)} onStart={startNode}
              onKey={(event) => {
                if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
                  event.preventDefault(); event.stopPropagation(); nudgeNode(event.key, event.shiftKey);
                } else if (event.key === "Escape") {
                  event.preventDefault(); event.stopPropagation();
                  if (gesture.current) clearGesture(); else setInkMode("select");
                }
              }}/>
          </svg>}
          <ScienceAttribution page={page}/>
          {page.stickers.map((sticker) => {
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
                  const radians = (sticker.rotation ?? 0) * Math.PI / 180;
                  const halfX = sticker.scale * (Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians))) / 2, halfY = halfX / aspect;
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
                  ...stickerStyle(sticker),
                  left: String(position.x * 100) + "%", top: String(position.y * 100) + "%",
                }}>
                <StickerArtwork sticker={sticker}/>
              </button>
            );
          })}
        </div>
        </div>
      </div>
      {textOverflow && <p role="status" className="rounded-xl bg-warning/15 p-3 text-sm">
        النص يتجاوز مساحة هذه الورقة. محتواك محفوظ داخل المذكرة؛ انقل الجزء الزائد إلى صفحة إضافية ليظهر كاملًا ويُصدّر إلى PDF.
      </p>}
      {warning && <p role="alert" className="rounded-xl bg-warning/15 p-3 text-sm">{warning}</p>}
      {recognitionSource && <HandwritingPanel page={recognitionSource.page} selection={recognitionSource.selection}
        onClose={closeRecognition} onAddPage={(text, font) => {
          const current = bookRef.current;
          if (!current || current.pages.length >= 36 || !current.pages.some((p) => p.id === recognitionSource.page.id)) return false;
          const added = recognizedTextPage(recognitionSource.page, text, font);
          if (!commit({ ...current, pages: [...current.pages, added] })) return false;
          setIndex(current.pages.length); setGroup("text"); setSelection(new Set());
          return true;
        }}/>}
      <nav className="rounded-2xl border border-border bg-card/95 p-2 shadow-sm"
        aria-label="شريط صفحات المذكرة">
        {!focusMode && group === "draw" && <div className="mb-2 flex gap-1 overflow-x-auto border-b border-border pb-2" role="group" aria-label="أدوات القلم السريعة">
          {transformSession ? <>
            <button type="button" className={controlCls(true)} aria-label="تطبيق التحويل السريع" disabled={transformDragging || !transformPreview?.changed || !!transformPreview.error}
              onClick={() => { if (transformPreview) applyTransform(transformPreview); }}><Check className="size-4"/>تطبيق</button>
            <button type="button" className={controlCls(false)} aria-label="إلغاء التحويل السريع" onClick={cancelTransform}><X className="size-4"/>إلغاء</button>
            {transformPreview?.error && <span role="status" className="self-center px-2 text-xs text-destructive">معاينة غير صالحة</span>}
          </> : <>
          {inkMode !== "nodes" && <>
            <button type="button" className={controlCls(inkMode === "pen")} aria-label="القلم السريع" onClick={() => { finish(); setInkMode("pen"); }}><PenLine className="size-4"/></button>
            <button type="button" className={controlCls(inkMode === "eraser")} aria-label="الممحاة السريعة" onClick={() => { finish(); setInkMode("eraser"); }}><Eraser className="size-4"/></button>
          </>}
          {inkMode === "eraser" && <select aria-label="نوع الممحاة السريعة" value={eraserKind}
            onChange={(e) => { finish(); setEraserKind(e.target.value as EraserKind); }}
            className="min-h-11 shrink-0 rounded-xl border border-border bg-background px-2 text-xs">
            <option value="segment">مسح جزء</option><option value="stroke">مسار كامل</option>
          </select>}
          {inkMode !== "nodes" && <button type="button" className={controlCls(inkMode === "select")} aria-label="التحديد السريع" onClick={() => { finish(); setInkMode("select"); }}><MousePointer2 className="size-4"/></button>}
          {inkMode === "nodes" && selectedStroke && <>
            <button type="button" className={controlCls(false)} aria-label="إضافة نقطة سريعة" title="إضافة نقطة للمسار"
              disabled={!canInsertInkPoint(selectedStroke, insertionAfter)} onClick={() => insertNode(insertionAfter)}><Plus className="size-4"/></button>
            <button type="button" className={controlCls(false) + " text-destructive"} aria-label="حذف نقطة سريع" title="حذف نقطة التحكم"
              disabled={inkPoints(selectedStroke).length <= 2} onClick={removeNode}><Trash2 className="size-4"/></button>
          </>}
          {selectedStroke && <button type="button" className={controlCls(inkMode === "nodes")} aria-label={inkMode === "nodes" ? "إنهاء تحرير النقاط السريع" : "تحرير النقاط السريع"}
            disabled={!nodeIndices.length} onClick={() => { if (inkMode === "nodes") { finish(); setInkMode("select"); } else enterNodes(); }}>
            {inkMode === "nodes" ? <Check className="size-4"/> : <Waypoints className="size-4"/>}
          </button>}
          {inkMode === "select" && selection.size > 0 && <button type="button" className={controlCls(false)} aria-label="تحويل الرسم السريع" title="تغيير الحجم والتدوير"
            onClick={beginTransform}><RotateCw className="size-4"/></button>}
          <button type="button" className={controlCls(false)} aria-label="تراجع سريع" disabled={!history.current.canUndo(page.id)} onClick={() => historyStep(false)}><Undo2 className="size-4"/></button>
          <button type="button" className={controlCls(false)} aria-label="إعادة سريعة" disabled={!history.current.canRedo(page.id)} onClick={() => historyStep(true)}><Redo2 className="size-4"/></button>
          </>}
        </div>}
        <div className="flex items-center gap-2">
        <div className="order-2 flex shrink-0 items-center gap-1">
          <strong className="sr-only">الصفحات ({book.pages.length})</strong>
          <ToolButton label="عرض مصغرات الصفحات" active={pagePreviews} aria-pressed={pagePreviews} onClick={() => setPagePreviews(!pagePreviews)}><Layers className="size-4"/></ToolButton>
          <div className="flex gap-1">
            <ToolButton label="تكرار الصفحة"
              onClick={duplicatePage} disabled={!!transformSession}><Copy className="size-4" /></ToolButton>
            <ToolButton label="حذف الصفحة"
              onClick={removePage} disabled={book.pages.length === 1 || !!transformSession}
              className="text-destructive">
              <Trash2 className="size-4"/>
            </ToolButton>
          </div>
        </div>
        <div className="order-1 flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="صفحات المذكرة">
          {book.pages.map((p, n) => (
            <button type="button" role="tab" key={p.id} aria-selected={index === n}
              disabled={!!transformSession}
              aria-label={"صفحة " + (n + 1)}
              onClick={() => { finish(); setIndex(n); setSelectedSticker(null); setSelection(new Set()); }}
              className={"flex min-h-11 min-w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border-2 p-1 " +
                (index === n ? "border-primary bg-primary-soft" : "border-border bg-background")}>
              {pagePreviews && <PageMiniature page={p} />}
              <span className="whitespace-nowrap text-[11px]">{n + 1}</span>
            </button>
          ))}
          <button type="button" onClick={addPage} disabled={!!transformSession} aria-label="إضافة صفحة" title="إضافة صفحة"
            className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border-2 border-dashed border-primary/35 text-primary disabled:opacity-40">
            <Plus className="size-5"/>
          </button>
        </div>
        </div>
      </nav>
      {styleSession&&<InkStyleDialog session={styleSession} onApply={applyStyle} onCancel={()=>setStyleSession(null)}/>}
    </section>
  );
}
