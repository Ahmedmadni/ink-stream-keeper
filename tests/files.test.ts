import { describe, expect, test } from "bun:test";
import { blobToBase64, bytesToBase64, files, safeFileName } from "../src/services/files";

describe("backup file delivery", () => {
  test("file names cannot escape the app folder and preserve useful Arabic text", () => {
    expect(safeFileName("../../نسخة أكتوبر.memoflow")).toBe("نسخة أكتوبر.memoflow");
    expect(safeFileName("..\\..\\backup?.memoflow")).toBe("backup-.memoflow");
    expect(safeFileName("... ")).toBe("MemoFlow-backup.memoflow");
    expect(safeFileName('report<2026>:"final".memoflow')).toBe("report-2026---final-.memoflow");
  });

  test("large binary files encode without argument or stack overflow", async () => {
    const bytes = Uint8Array.from({ length: 200_000 }, (_, index) => index % 251);
    const expected = Buffer.from(bytes).toString("base64");
    expect(bytesToBase64(bytes)).toBe(expected);
    expect(await blobToBase64(new Blob([bytes]))).toBe(expected);
  });

  test("server-side rendering never advertises browser file sharing", () => {
    expect(files.canShare(new Blob(["encrypted"]), "backup.memoflow")).toBe(false);
  });
});
