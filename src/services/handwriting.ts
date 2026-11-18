import { Capacitor, registerPlugin } from "@capacitor/core";
import type { recognitionInput } from "@/features/notebook/handwriting";

type Input = ReturnType<typeof recognitionInput>;
type Status = { supported: boolean; ready: boolean; language?: "ar"; experimental?: boolean };
type Plugin = {
  getStatus(): Promise<Status>; downloadModel(): Promise<void>; deleteModel(): Promise<void>;
  recognize(input: Input): Promise<{ candidates: string[]; language: "ar" }>;
  cancel(): Promise<void>;
};
const plugin = registerPlugin<Plugin>("MemoFlowHandwriting");
async function deadline<T>(promise: Promise<T>, ms: number, message: string, cancel = false): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { if (cancel) void plugin.cancel().catch(() => {}); reject(new Error(message)); }, ms);
    })]);
  } finally { clearTimeout(timer); }
}
function available() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android" &&
    Capacitor.isPluginAvailable("MemoFlowHandwriting");
}
export const handwriting = {
  async status(): Promise<Status> {
    if (!available()) return { supported: false, ready: false };
    return deadline(plugin.getStatus(), 15000, "لم يستجب محرك التعرف. أغلق التجربة وافتحها مجددًا.");
  },
  async download() { if (!available()) throw new Error("التعرف المحلي متاح في نسخة أندرويد التي تتضمن المحرك فقط."); await plugin.downloadModel(); },
  async remove() { if (available()) await plugin.deleteModel(); },
  async recognize(input: Input) {
    if (!available()) throw new Error("محرك التعرف المحلي غير متاح في هذه النسخة.");
    const result = await deadline(plugin.recognize(input), 30000, "استغرق التعرف وقتًا طويلًا. حدد سطرًا أصغر وحاول مجددًا.", true);
    if (!Array.isArray(result.candidates)) throw new Error("لم تصل نتيجة صالحة من محرك التعرف.");
    return result.candidates.filter((value) => typeof value === "string" && value.trim() && value.length <= 5000).slice(0, 5);
  },
  async cancel() { if (available()) await plugin.cancel(); },
};
