import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

/**
 * Small audio recorder button. Records via MediaRecorder and calls
 * onRecorded(file) with an audio file. The parent decides what to do
 * with the file (upload as attachment, insert into editor, etc.).
 */
export function AudioRecorder({
  onRecorded,
  className = "",
}: {
  onRecorded: (file: File) => void;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "recording" | "saving">("idle");
  const [elapsed, setElapsed] = useState(0);
  const chunks = useRef<Blob[]>([]);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => stop(true), []);

  const stop = (silent = false) => {
    if (timer.current) { window.clearInterval(timer.current); timer.current = null; }
    setElapsed(0);
    try { rec.current?.state === "recording" && rec.current.stop(); } catch { /* noop */ }
    stream.current?.getTracks().forEach((t) => t.stop());
    rec.current = null;
    stream.current = null;
    if (silent) setState("idle");
  };

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      alert("التسجيل غير مدعوم في هذا المتصفح.");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const mime = pickMime();
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      rec.current = r;
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => {
        setState("saving");
        const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        const ext = (r.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `تسجيل-${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`, { type: blob.type });
        onRecorded(file);
        setState("idle");
      };
      r.start(250);
      setState("recording");
      const started = Date.now();
      timer.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    } catch {
      alert("تعذّر الوصول إلى الميكروفون.");
      setState("idle");
    }
  };

  if (state === "recording") {
    return (
      <button
        type="button"
        onClick={() => stop()}
        aria-label="إيقاف التسجيل"
        className={`grid h-10 shrink-0 place-items-center gap-1.5 rounded-full bg-destructive px-3 text-xs font-bold text-destructive-foreground shadow-fab ${className}`}
      >
        <span className="flex items-center gap-1.5"><Square className="size-3.5" /> {formatTime(elapsed)}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={state === "saving"}
      aria-label="تسجيل صوتي"
      className={`grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-card ${className}`}
    >
      {state === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4 text-primary" />}
    </button>
  );
}

function pickMime(): string | undefined {
  const list = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  if (typeof MediaRecorder === "undefined") return undefined;
  return list.find((m) => MediaRecorder.isTypeSupported?.(m));
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}