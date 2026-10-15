/**
 * Speech-to-text engine (Lovable AI).
 * Captures mic PCM via Web Audio, encodes complete WAV windows and sends
 * them to /api/transcribe. Works for short dictation and long lectures.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getDialect } from "./dialect";
import { resolveAppEndpoint } from "@/lib/native-url";

const TARGET_RATE = 16000;

export type DictationState = "idle" | "recording" | "processing" | "error";

export function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let o = 0;
  for (const c of chunks) { merged.set(c, o); o += c.length; }
  const down = downsample(merged, sampleRate, TARGET_RATE);
  const buffer = new ArrayBuffer(44 + down.length * 2);
  const view = new DataView(buffer);
  const w = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  w(0, "RIFF");
  view.setUint32(4, 36 + down.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_RATE, true);
  view.setUint32(28, TARGET_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, "data");
  view.setUint32(40, down.length * 2, true);
  let off = 44;
  for (let i = 0; i < down.length; i++) {
    const s = Math.max(-1, Math.min(1, down[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (to >= from) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export async function transcribeBlob(blob: Blob, language?: string): Promise<string> {
  const fd = new FormData();
  const ext = blob.type.includes("webm") ? "webm" : blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : blob.type.includes("mpeg") ? "mp3" : "wav";
  fd.append("file", blob, `recording.${ext}`);
  fd.append("language", language || "ar");
  fd.append("dialect", getDialect());
  const res = await fetch(resolveAppEndpoint("/api/transcribe"), { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok) throw new Error(data.error || "تعذّر تفريغ الصوت.");
  return (data.text ?? "").trim();
}

export type UseDictationOptions = {
  /** Called with each transcribed segment as it arrives. */
  onText: (text: string) => void;
  /** Seconds per transcription window for live mode (0 = only on stop). */
  chunkSeconds?: number;
  language?: string;
  /** Also hand the full recording back as a file (for attachments). */
  onAudioFile?: (file: File) => void;
};

export function useDictation({ onText, chunkSeconds = 0, language, onAudioFile }: UseDictationOptions) {
  const [state, setState] = useState<DictationState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pending, setPending] = useState(0);

  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const node = useRef<ScriptProcessorNode | null>(null);
  const source = useRef<MediaStreamAudioSourceNode | null>(null);
  const window_ = useRef<Float32Array[]>([]);
  const all = useRef<Float32Array[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const rate = useRef(TARGET_RATE);
  const cbs = useRef({ onText, onAudioFile });
  cbs.current = { onText, onAudioFile };

  const send = useCallback(async (chunks: Float32Array[]) => {
    if (!chunks.length) return;
    const blob = encodeWav(chunks, rate.current);
    if (blob.size < 4096) return;
    setPending((p) => p + 1);
    try {
      const text = await transcribeBlob(blob, language);
      if (text) cbs.current.onText(text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending((p) => Math.max(0, p - 1));
    }
  }, [language]);

  const cleanup = useCallback(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (chunkTimer.current) { clearInterval(chunkTimer.current); chunkTimer.current = null; }
    try { node.current?.disconnect(); source.current?.disconnect(); } catch { /* noop */ }
    stream.current?.getTracks().forEach((t) => t.stop());
    void ctx.current?.close().catch(() => undefined);
    node.current = null; source.current = null; stream.current = null; ctx.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("التسجيل غير مدعوم في هذا المتصفح."); setState("error"); return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      stream.current = s;
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AC();
      ctx.current = audioCtx;
      rate.current = audioCtx.sampleRate;
      const src = audioCtx.createMediaStreamSource(s);
      source.current = src;
      const proc = audioCtx.createScriptProcessor(4096, 1, 1);
      node.current = proc;
      window_.current = [];
      all.current = [];
      proc.onaudioprocess = (e) => {
        const data = new Float32Array(e.inputBuffer.getChannelData(0));
        window_.current.push(data);
        all.current.push(data);
      };
      src.connect(proc);
      proc.connect(audioCtx.destination);

      setElapsed(0);
      const started = Date.now();
      timer.current = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
      if (chunkSeconds > 0) {
        chunkTimer.current = setInterval(() => {
          const chunk = window_.current;
          window_.current = [];
          void send(chunk);
        }, chunkSeconds * 1000);
      }
      setState("recording");
    } catch {
      setError("تعذّر الوصول إلى الميكروفون.");
      setState("error");
    }
  }, [chunkSeconds, send]);

  const stop = useCallback(async () => {
    if (state !== "recording") return;
    const tail = window_.current;
    const full = all.current;
    window_.current = [];
    cleanup();
    setState("processing");
    if (cbs.current.onAudioFile && full.length) {
      const blob = encodeWav(full, rate.current);
      cbs.current.onAudioFile(new File([blob], `تسجيل-${new Date().toISOString().replace(/[:.]/g, "-")}.wav`, { type: "audio/wav" }));
    }
    await send(tail);
    setState("idle");
    setElapsed(0);
  }, [cleanup, send, state]);

  const cancel = useCallback(() => {
    window_.current = []; all.current = [];
    cleanup();
    setState("idle");
    setElapsed(0);
  }, [cleanup]);

  return { state, error, elapsed, pending, start, stop, cancel, setError };
}

export function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(r).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
