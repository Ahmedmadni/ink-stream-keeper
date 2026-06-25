import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, NotebookPen, CheckSquare, ShoppingCart, Pencil,
  Image as ImageIcon, Mic, Loader2, Eraser, Trash, Camera,
  Play, Pause, Square, RotateCcw,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAddNote, useAddTask, useCategories, useUploadAttachment } from "@/lib/data";
import { RichEditor } from "@/components/RichEditor";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({
    meta: [
      { title: "MemoFlow — إنشاء" },
      { name: "description", content: "أنشئ ملاحظة، مهمة، قائمة مشتريات أو رسم حر." },
    ],
  }),
  component: CreatePage,
});

type Mode = "menu" | "note" | "task" | "image" | "draw" | "voice";

function CreatePage() {
  const [mode, setMode] = useState<Mode>("menu");
  const router = useRouter();
  const { data: categories = [] } = useCategories();
  const addNote = useAddNote();
  const uploadAtt = useUploadAttachment();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");

  if (mode === "menu") {
    const items = [
      { icon: NotebookPen, label: "ملاحظة جديدة", desc: "نص حر مع تنسيق", onClick: () => setMode("note") },
      { icon: CheckSquare, label: "مهمة جديدة", desc: "مع وقت وأولوية", onClick: () => setMode("task") },
      { icon: ShoppingCart, label: "قائمة مشتريات", desc: "تجميع سريع", onClick: () => {
          const shop = categories.find((c) => c.name === "مشتريات");
          if (shop) setCategoryId(shop.id);
          setMode("note");
      } },
      { icon: Pencil, label: "رسم حر", desc: "لوحة رسم بالأصابع", onClick: () => setMode("draw"), disabled: false },
      { icon: ImageIcon, label: "إدراج صورة", desc: "من المعرض أو الكاميرا", onClick: () => setMode("image"), disabled: false },
      { icon: Mic, label: "تسجيل صوتي", desc: "ملاحظة صوتية", onClick: () => setMode("voice"), disabled: false },
    ];
    return (
      <AppShell>
        <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-5 pb-2 pt-6">
          <button onClick={() => router.history.back()} className="grid size-10 place-items-center rounded-full bg-card shadow-card" aria-label="رجوع">
            <ArrowRight className="size-5" />
          </button>
          <h1 className="text-2xl font-extrabold">إنشاء جديد</h1>
        </header>
        <p className="px-5 pt-1 text-sm text-muted-foreground">اختر نوع العنصر الذي تريد إنشاءه.</p>

        <div className="mt-6 grid grid-cols-2 gap-3 px-5">
          {items.map((it) => (
            <button key={it.label} onClick={it.onClick} disabled={it.disabled} className="flex flex-col items-start gap-3 rounded-2xl bg-card p-4 text-right shadow-card transition-transform active:scale-[0.98] disabled:opacity-50">
              <div className="grid size-12 place-items-center rounded-xl gradient-primary text-primary-foreground">
                <it.icon className="size-6" />
              </div>
              <div>
                <p className="text-sm font-bold">{it.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{it.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </AppShell>
    );
  }

  if (mode === "note") {
    return (
      <AppShell>
        <FormHeader title="ملاحظة جديدة" onBack={() => setMode("menu")} />
        <div className="space-y-3 px-5 pt-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="العنوان..." className="w-full rounded-2xl bg-card px-4 py-3 text-lg font-bold outline-none shadow-card placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary" />
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-2xl bg-card px-4 py-3 text-sm font-semibold outline-none shadow-card">
            <option value="">بدون تصنيف</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <RichEditor
            value={content}
            onChange={setContent}
            placeholder="ابدأ الكتابة... استخدم الشريط لتنسيق النص وإضافة قوائم وصور."
            onAddAttachment={(file) => setPendingFiles((p) => [...p, file])}
          />
          {pendingFiles.length > 0 && (
            <p className="text-xs text-muted-foreground">📎 {pendingFiles.length} مرفق سيُرفع بعد الحفظ</p>
          )}
          {addNote.error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{(addNote.error as Error).message}</p>}
          <button
            disabled={addNote.isPending}
            onClick={async () => {
              if (!title.trim()) return;
              const note = await addNote.mutateAsync({
                title: title.trim(),
                content: content.trim(),
                categoryId: categoryId || null,
                emoji: "📝",
              });
              for (const file of pendingFiles) {
                await uploadAtt.mutateAsync({ noteId: note.id, file });
              }
              router.navigate({ to: "/notes/$id", params: { id: note.id } });
            }}
            className="grid w-full place-items-center rounded-2xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-fab disabled:opacity-70"
          >
            {addNote.isPending ? <Loader2 className="size-5 animate-spin" /> : "حفظ الملاحظة"}
          </button>
        </div>
      </AppShell>
    );
  }

  if (mode === "image") {
    return (
      <AppShell>
        <FormHeader title="ملاحظة صورة" onBack={() => setMode("menu")} />
        <ImageNoteForm onDone={(id) => router.navigate({ to: "/notes/$id", params: { id } })} />
      </AppShell>
    );
  }

  if (mode === "draw") {
    return (
      <AppShell>
        <FormHeader title="رسم حر" onBack={() => setMode("menu")} />
        <DrawForm onDone={(id) => router.navigate({ to: "/notes/$id", params: { id } })} />
      </AppShell>
    );
  }

  if (mode === "voice") {
    return (
      <AppShell>
        <FormHeader title="تسجيل صوتي" onBack={() => setMode("menu")} />
        <VoiceForm onDone={(id) => router.navigate({ to: "/notes/$id", params: { id } })} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <FormHeader title="مهمة جديدة" onBack={() => setMode("menu")} />
      <TaskForm onDone={() => router.navigate({ to: "/tasks" })} />
    </AppShell>
  );
}

function FormHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-5 pb-2 pt-6">
      <button onClick={onBack} className="grid size-10 place-items-center rounded-full bg-card shadow-card" aria-label="رجوع">
        <ArrowRight className="size-5" />
      </button>
      <h1 className="truncate text-2xl font-extrabold">{title}</h1>
    </header>
  );
}

function TaskForm({ onDone }: { onDone: () => void }) {
  const addTask = useAddTask();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState<"low" | "med" | "high">("med");
  const [reminderOffset, setReminderOffset] = useState<string>("none");
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">("none");

  return (
    <div className="space-y-3 px-5 pt-4">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المهمة..." className="w-full rounded-2xl bg-card px-4 py-3 text-lg font-bold outline-none shadow-card placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary" />
      <div className="grid grid-cols-2 gap-3">
        <label className="rounded-2xl bg-card px-4 py-3 text-xs shadow-card">
          <span className="block text-[10px] font-bold text-muted-foreground">التاريخ</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent text-sm outline-none" />
        </label>
        <label className="rounded-2xl bg-card px-4 py-3 text-xs shadow-card">
          <span className="block text-[10px] font-bold text-muted-foreground">الوقت</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-transparent text-sm outline-none" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <select value={priority} onChange={(e) => setPriority(e.target.value as "low" | "med" | "high")} className="rounded-2xl bg-card px-4 py-3 text-sm font-semibold outline-none shadow-card">
          <option value="low">أولوية منخفضة</option>
          <option value="med">أولوية متوسطة</option>
          <option value="high">أولوية عالية</option>
        </select>
        <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as typeof recurrence)} className="rounded-2xl bg-card px-4 py-3 text-sm font-semibold outline-none shadow-card">
          <option value="none">بدون تكرار</option>
          <option value="daily">يوميًا</option>
          <option value="weekly">أسبوعيًا</option>
          <option value="monthly">شهريًا</option>
        </select>
      </div>
      <select
        value={reminderOffset}
        onChange={(e) => setReminderOffset(e.target.value)}
        disabled={!time}
        className="w-full rounded-2xl bg-card px-4 py-3 text-sm font-semibold outline-none shadow-card disabled:opacity-60"
      >
        <option value="none">بدون تذكير</option>
        <option value="0">عند الموعد</option>
        <option value="5">قبل 5 دقائق</option>
        <option value="15">قبل 15 دقيقة</option>
        <option value="30">قبل 30 دقيقة</option>
        <option value="60">قبل ساعة</option>
        <option value="1440">قبل يوم</option>
      </select>
      {addTask.error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{(addTask.error as Error).message}</p>}
      <button
        disabled={addTask.isPending}
        onClick={async () => {
          if (!title.trim()) return;
          let due_at: string | null = null;
          let reminder_at: string | null = null;
          if (time) {
            const [h, m] = time.split(":").map(Number);
            const [y, mo, dd] = date.split("-").map(Number);
            const d = new Date(y, mo - 1, dd, h, m, 0, 0);
            due_at = d.toISOString();
            if (reminderOffset !== "none") {
              reminder_at = new Date(d.getTime() - Number(reminderOffset) * 60_000).toISOString();
              if (typeof Notification !== "undefined" && Notification.permission === "default") {
                Notification.requestPermission().catch(() => {});
              }
            }
          }
          await addTask.mutateAsync({ title: title.trim(), due_at, reminder_at, priority, recurrence });
          onDone();
        }}
        className="grid w-full place-items-center rounded-2xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-fab disabled:opacity-70"
      >
        {addTask.isPending ? <Loader2 className="size-5 animate-spin" /> : "حفظ المهمة"}
      </button>
    </div>
  );
}

// ---------------- Image note ----------------
function ImageNoteForm({ onDone }: { onDone: (id: string) => void }) {
  const addNote = useAddNote();
  const upload = useUploadAttachment();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pending = addNote.isPending || upload.isPending;

  const submit = async () => {
    if (!file) return;
    const note = await addNote.mutateAsync({
      title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
      content: caption.trim() ? `<p>${escapeHtml(caption.trim())}</p>` : "",
      categoryId: null,
      emoji: "🖼️",
    });
    await upload.mutateAsync({ noteId: note.id, file });
    onDone(note.id);
  };

  return (
    <div className="space-y-3 px-5 pt-4">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

      {preview ? (
        <div className="overflow-hidden rounded-2xl bg-card shadow-card">
          <img src={preview} alt="معاينة" className="max-h-[400px] w-full object-contain" />
          <button onClick={() => setFile(null)} className="grid w-full place-items-center bg-secondary py-2 text-xs font-bold text-muted-foreground">
            إزالة الصورة
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => inputRef.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl bg-card p-6 shadow-card transition-transform active:scale-95">
            <div className="grid size-12 place-items-center rounded-xl gradient-primary text-primary-foreground"><ImageIcon className="size-6" /></div>
            <span className="text-sm font-bold">من المعرض</span>
          </button>
          <button onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl bg-card p-6 shadow-card transition-transform active:scale-95">
            <div className="grid size-12 place-items-center rounded-xl gradient-primary text-primary-foreground"><Camera className="size-6" /></div>
            <span className="text-sm font-bold">الكاميرا</span>
          </button>
        </div>
      )}

      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الملاحظة (اختياري)" className="w-full rounded-2xl bg-card px-4 py-3 text-sm font-bold outline-none shadow-card placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary" />
      <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="وصف الصورة (اختياري)" rows={3} className="w-full rounded-2xl bg-card px-4 py-3 text-sm outline-none shadow-card placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary resize-none" />

      <button disabled={!file || pending} onClick={submit} className="grid w-full place-items-center rounded-2xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-fab disabled:opacity-50">
        {pending ? <Loader2 className="size-5 animate-spin" /> : "حفظ الملاحظة"}
      </button>
    </div>
  );
}

// ---------------- Drawing canvas ----------------
function DrawForm({ onDone }: { onDone: (id: string) => void }) {
  const addNote = useAddNote();
  const upload = useUploadAttachment();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState("#1e40af");
  const [size, setSize] = useState(4);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [title, setTitle] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = 380;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    last.current = point(e);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = point(e);
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.lineWidth = tool === "eraser" ? size * 3 : size;
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const end = () => { drawing.current = false; last.current = null; };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const pending = addNote.isPending || upload.isPending;
  const submit = async () => {
    const canvas = canvasRef.current!;
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
    const file = new File([blob], `drawing-${Date.now()}.png`, { type: "image/png" });
    const note = await addNote.mutateAsync({
      title: title.trim() || "رسم حر",
      content: "",
      categoryId: null,
      emoji: "🎨",
    });
    await upload.mutateAsync({ noteId: note.id, file });
    onDone(note.id);
  };

  const colors = ["#1e40af", "#0ea5e9", "#ef4444", "#f59e0b", "#10b981", "#111827"];

  return (
    <div className="space-y-3 px-5 pt-4">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الرسم (اختياري)" className="w-full rounded-2xl bg-card px-4 py-3 text-sm font-bold outline-none shadow-card placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary" />

      <div ref={wrapRef} className="overflow-hidden rounded-2xl bg-white shadow-card">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="block touch-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-3 shadow-card">
        <button onClick={() => setTool("pen")} className={`grid size-9 place-items-center rounded-lg ${tool === "pen" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`} aria-label="قلم">
          <Pencil className="size-4" />
        </button>
        <button onClick={() => setTool("eraser")} className={`grid size-9 place-items-center rounded-lg ${tool === "eraser" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`} aria-label="ممحاة">
          <Eraser className="size-4" />
        </button>
        <span className="mx-1 h-6 w-px bg-border" />
        {colors.map((c) => (
          <button key={c} onClick={() => { setColor(c); setTool("pen"); }} className={`size-7 rounded-full border-2 ${color === c && tool === "pen" ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} aria-label={c} />
        ))}
        <span className="mx-1 h-6 w-px bg-border" />
        <input type="range" min={1} max={20} value={size} onChange={(e) => setSize(Number(e.target.value))} className="flex-1 accent-primary" aria-label="حجم القلم" />
        <button onClick={clear} className="grid size-9 place-items-center rounded-lg bg-destructive/10 text-destructive" aria-label="مسح الكل">
          <Trash className="size-4" />
        </button>
      </div>

      <button disabled={pending} onClick={submit} className="grid w-full place-items-center rounded-2xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-fab disabled:opacity-50">
        {pending ? <Loader2 className="size-5 animate-spin" /> : "حفظ الرسم"}
      </button>
    </div>
  );
}

// ---------------- Voice recorder ----------------
function VoiceForm({ onDone }: { onDone: (id: string) => void }) {
  const addNote = useAddNote();
  const upload = useUploadAttachment();
  const [state, setState] = useState<"idle" | "recording" | "paused" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [title, setTitle] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        setState("done");
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recRef.current = rec;
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      setState("recording");
    } catch (e) {
      setErr("لم نتمكن من الوصول للميكروفون. تحقق من الأذونات.");
    }
  };

  const stop = () => {
    recRef.current?.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(""); setBlob(null); setSeconds(0); setState("idle");
  };

  const pending = addNote.isPending || upload.isPending;
  const submit = async () => {
    if (!blob) return;
    const ext = blob.type.includes("mp4") ? "m4a" : "webm";
    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
    const note = await addNote.mutateAsync({
      title: title.trim() || `تسجيل صوتي (${fmtTime(seconds)})`,
      content: "",
      categoryId: null,
      emoji: "🎙️",
    });
    await upload.mutateAsync({ noteId: note.id, file });
    onDone(note.id);
  };

  return (
    <div className="space-y-3 px-5 pt-4">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان التسجيل (اختياري)" className="w-full rounded-2xl bg-card px-4 py-3 text-sm font-bold outline-none shadow-card placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary" />

      <div className="rounded-2xl bg-card p-6 text-center shadow-card">
        <div className={`mx-auto grid size-24 place-items-center rounded-full ${state === "recording" ? "gradient-primary text-primary-foreground animate-pulse" : "bg-primary-soft text-primary"}`}>
          <Mic className="size-10" />
        </div>
        <p className="mt-4 font-mono text-2xl font-bold tabular-nums">{fmtTime(seconds)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {state === "idle" && "اضغط للبدء بالتسجيل"}
          {state === "recording" && "يجري التسجيل..."}
          {state === "done" && "تم التسجيل — استمع قبل الحفظ"}
        </p>

        <div className="mt-5 flex items-center justify-center gap-3">
          {state === "idle" && (
            <button onClick={start} className="flex items-center gap-2 rounded-full gradient-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-fab">
              <Play className="size-4" /> بدء التسجيل
            </button>
          )}
          {state === "recording" && (
            <button onClick={stop} className="flex items-center gap-2 rounded-full bg-destructive px-6 py-3 text-sm font-bold text-destructive-foreground shadow-fab">
              <Square className="size-4" /> إيقاف
            </button>
          )}
          {state === "done" && (
            <button onClick={reset} className="flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-xs font-bold text-muted-foreground">
              <RotateCcw className="size-4" /> إعادة التسجيل
            </button>
          )}
        </div>

        {previewUrl && (
          <audio src={previewUrl} controls className="mt-4 w-full" />
        )}

        {err && <p className="mt-3 text-xs font-semibold text-destructive">{err}</p>}
      </div>

      <button disabled={!blob || pending} onClick={submit} className="grid w-full place-items-center rounded-2xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-fab disabled:opacity-50">
        {pending ? <Loader2 className="size-5 animate-spin" /> : "حفظ التسجيل"}
      </button>
    </div>
  );
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const r = (s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}