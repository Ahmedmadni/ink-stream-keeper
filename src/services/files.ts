import { isNative } from "./platform";

const SHARE_FOLDER = "memoflow-share";
const DEFAULT_NAME = "MemoFlow-backup.memoflow";

export type FileSaveResult =
  | { mode: "native"; path: string; uri: string }
  | { mode: "cancelled"; path: string; uri: null }
  | { mode: "browser"; path: string; uri: null };

export type FileShareResult = "shared" | "cancelled" | "unavailable";

export interface FilesService {
  save(blob: Blob, filename: string): Promise<FileSaveResult>;
  share(blob: Blob, filename: string, title?: string): Promise<FileShareResult>;
  canShare(blob: Blob, filename: string): boolean;
  downloadUrl(url: string, filename: string): void;
}

/** Keep generated file names inside the app-owned folder on every platform. */
export function safeFileName(filename: string): string {
  const leaf = filename.normalize("NFKC").split(/[\\/]/).pop()?.trim() ?? "";
  const printable = [...leaf]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 32 || code === 127 ? "-" : character;
    })
    .join("");
  const safe = printable
    .replace(/[<>:"|?*]/g, "-")
    .replace(/^\.+/, "")
    .replace(/\s+/g, " ")
    .slice(0, 180);
  return safe || DEFAULT_NAME;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  return btoa(binary);
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}

function asFile(blob: Blob, filename: string): File {
  return new File([blob], safeFileName(filename), {
    type: blob.type || "application/octet-stream",
    lastModified: Date.now(),
  });
}

function cancelled(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  const value = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /abort|cancel/i.test(value);
}

function browserDownload(blob: Blob, filename: string) {
  if (typeof document === "undefined") throw new Error("FILE_DOWNLOAD_UNAVAILABLE");
  const url = URL.createObjectURL(blob);
  files.downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const files: FilesService = {
  async save(blob, filename) {
    const name = safeFileName(filename);
    if (!isNative()) {
      browserDownload(blob, name);
      return { mode: "browser", path: name, uri: null };
    }

    const { nativeBackup } = await import("./native-backup");
    const result = await nativeBackup.saveLocalFile(await blob.text(), name);
    if (result.cancelled) return { mode: "cancelled", path: "", uri: null };
    if (!result.uri) throw new Error("FILE_SAVE_FAILED");
    return { mode: "native", path: name, uri: result.uri };
  },

  canShare(blob, filename) {
    if (isNative()) return true;
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
    try {
      return navigator.canShare?.({ files: [asFile(blob, filename)] }) ?? false;
    } catch {
      return false;
    }
  },

  async share(blob, filename, title = "نسخة MemoFlow المشفّرة") {
    const name = safeFileName(filename);
    if (isNative()) {
      try {
        const [{ Directory, Filesystem }, { Share }] = await Promise.all([
          import("@capacitor/filesystem"),
          import("@capacitor/share"),
        ]);
        if (!(await Share.canShare()).value) return "unavailable";
        await Filesystem.rmdir({
          path: SHARE_FOLDER,
          directory: Directory.Cache,
          recursive: true,
        }).catch(() => undefined);
        const result = await Filesystem.writeFile({
          path: `${SHARE_FOLDER}/${name}`,
          data: await blobToBase64(blob),
          directory: Directory.Cache,
          recursive: true,
        });
        await Share.share({
          title,
          text: "نسخة احتياطية مشفّرة من MemoFlow",
          files: [result.uri],
          dialogTitle: "حفظ النسخة أو مشاركتها",
        });
        return "shared";
      } catch (error) {
        if (cancelled(error)) return "cancelled";
        throw error;
      }
    }

    if (!this.canShare(blob, name)) return "unavailable";
    try {
      await navigator.share({ title, files: [asFile(blob, name)] });
      return "shared";
    } catch (error) {
      if (cancelled(error)) return "cancelled";
      throw error;
    }
  },

  downloadUrl(url, filename) {
    if (typeof document === "undefined") throw new Error("FILE_DOWNLOAD_UNAVAILABLE");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeFileName(filename);
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  },
};
