/**
 * Files service — download blob to disk with a browser-friendly fallback.
 */
export interface FilesService {
  download(blob: Blob, filename: string): void;
  downloadUrl(url: string, filename: string): void;
}

export const files: FilesService = {
  download(blob, filename) {
    if (typeof document === "undefined") return;
    const url = URL.createObjectURL(blob);
    this.downloadUrl(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },
  downloadUrl(url, filename) {
    if (typeof document === "undefined") return;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
};