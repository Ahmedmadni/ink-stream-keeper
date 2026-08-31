import { useState } from "react";
import { Copy, Loader2, Mic, Square, Trash2, Wand2, X } from "lucide-react";
import { formatDuration, transcribeBlob, useDictation } from "@/lib/speech/dictation";

/**
 * Lecture / meeting recorder — records long audio and streams the
 * transcription back in ~12s windows so text appears while speaking.
 */
export function LectureRecorder({
  onInsert,
  onAudioFile,
  className = "",
}: {
  /** insert the final transcript wherever the host wants it */
  onInsert: (text: string) => void;
  /** optionally keep the audio (e.g. as an attachment) */
  onAudioFile?: (file: File) => void;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const d = useDictation({
    chunkSeconds: 12,
    onAudioFile,
    onText: (t) => setText((prev) => (prev ? `${prev} ${t}` : t)),
  });

  const uploadFile = async (file: File) => {
    setFileBusy(true); setFileErr(null);
    try {
      const t = await transcribeBlob(file);
      setText((prev) => (prev ? `${prev}\n\n${t}` : t));
    } catch (e) {
      setFileErr((e as Error).message);
    } finally {
      setFileBusy(false);
    }
  };

  return (
    <section className={`rounded-2xl bg-card p-4 shadow-card ${className}`} aria-label="تسجيل وتفريغ صوتي">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="me-auto text-sm font-bold">تسجيل محاضرة / اجتماع وتحويله إلى نص</h3>
        {d.state === "recording" ? (
          <>
            <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">
              <span className="size-2 animate-pulse rounded-full bg-destructive" />
              {formatDuration(d.elapsed)}
            </span>
            <button type="button" onClick={() => void d.stop()} className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground">
              <Square className="size-3.5" /> إيقاف
            </button>
            <button type="button" onClick={d.cancel} aria-label="إلغاء" className="grid size-9 place-items-center rounded-full bg-muted">
              <X className="size-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void d.start()}
            disabled={d.state === "processing"}
            className="inline-flex items-center gap-1.5 rounded-full gradient-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-fab disabled:opacity-70"
          >
            {d.state === "processing" ? <Loader2 className="size-3.5 animate-spin" /> : <Mic className="size-3.5" />}
            بدء التسجيل
          </button>
        )}
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-xs font-bold">
          {fileBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
          تفريغ ملف صوتي
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadFile(f); }}
          />
        </label>
      </div>

      {(d.error || fileErr) && (
        <p className="mt-2 text-xs font-semibold text-destructive">{d.error ?? fileErr}</p>
      )}
      {d.pending > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> جارٍ تفريغ المقاطع...</p>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        dir="rtl"
        rows={6}
        placeholder="سيظهر النص هنا أثناء التسجيل — يمكنك تحريره قبل الإدراج."
        className="mt-3 w-full resize-y rounded-xl bg-muted/40 p-3 text-sm leading-relaxed outline-none"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => { onInsert(text.trim()); setText(""); }}
          className="rounded-xl gradient-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          إدراج النص
        </button>
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => void navigator.clipboard?.writeText(text)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-xs font-bold disabled:opacity-50"
        >
          <Copy className="size-3.5" /> نسخ
        </button>
        <button
          type="button"
          disabled={!text}
          onClick={() => setText("")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-xs font-bold text-destructive disabled:opacity-50"
        >
          <Trash2 className="size-3.5" /> مسح
        </button>
      </div>
    </section>
  );
}
