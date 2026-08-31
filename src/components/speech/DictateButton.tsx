import { Loader2, Mic, Square } from "lucide-react";
import { formatDuration, useDictation } from "@/lib/speech/dictation";

/**
 * Universal dictation button — press to talk, press again to insert text.
 * Usable next to any input, textarea or editor across the app.
 */
export function DictateButton({
  onText,
  className = "",
  size = "md",
  label = "إملاء صوتي",
  live = false,
}: {
  onText: (text: string) => void;
  className?: string;
  size?: "sm" | "md";
  label?: string;
  /** transcribe every ~10s while recording (long dictation) */
  live?: boolean;
}) {
  const d = useDictation({ onText, chunkSeconds: live ? 10 : 0 });
  const dim = size === "sm" ? "size-8" : "size-10";
  const icon = size === "sm" ? "size-3.5" : "size-4";

  if (d.state === "recording") {
    return (
      <button
        type="button"
        onClick={() => void d.stop()}
        aria-label="إيقاف الإملاء"
        title={`جارٍ التسجيل ${formatDuration(d.elapsed)}`}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-destructive px-3 text-xs font-bold text-destructive-foreground ${size === "sm" ? "h-8" : "h-10"} ${className}`}
      >
        <Square className={icon} /> {formatDuration(d.elapsed)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void d.start()}
      disabled={d.state === "processing"}
      aria-label={label}
      title={d.error ?? label}
      className={`grid ${dim} shrink-0 place-items-center rounded-full bg-card shadow-card disabled:opacity-70 ${className}`}
    >
      {d.state === "processing" ? (
        <Loader2 className={`${icon} animate-spin`} />
      ) : (
        <Mic className={`${icon} ${d.state === "error" ? "text-destructive" : "text-primary"}`} />
      )}
    </button>
  );
}
