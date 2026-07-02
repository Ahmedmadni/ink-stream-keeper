/**
 * Share service — Web Share API with clipboard fallback.
 */
export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
}

export interface ShareService {
  canShare(): boolean;
  share(data: ShareData): Promise<{ ok: boolean; fallback?: "clipboard" }>;
  copyText(text: string): Promise<boolean>;
}

export const share: ShareService = {
  canShare() {
    return typeof navigator !== "undefined" && typeof navigator.share === "function";
  },
  async share(data) {
    if (this.canShare()) {
      try { await navigator.share(data); return { ok: true }; }
      catch { /* fallthrough */ }
    }
    const text = [data.title, data.text, data.url].filter(Boolean).join("\n");
    const ok = await this.copyText(text);
    return { ok, fallback: "clipboard" };
  },
  async copyText(text) {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* noop */ }
    return false;
  },
};