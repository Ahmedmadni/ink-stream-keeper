import { describe, expect, test } from "bun:test";
import { validAppPin } from "../src/services/app-lock";
import {
  AUTO_BACKUP_INTERVAL_MS,
  autoBackupDue,
  automaticBackupName,
} from "../src/services/native-backup";

describe("native app lock and backup rules", () => {
  test("accepts exactly six numeric PIN digits", () => {
    expect(validAppPin("123456")).toBe(true);
    expect(validAppPin("12345")).toBe(false);
    expect(validAppPin("1234567")).toBe(false);
    expect(validAppPin("abcdef")).toBe(false);
  });

  test("automatic backup is due every 24 hours", () => {
    const now = Date.UTC(2026, 9, 15, 6);
    expect(autoBackupDue(0, now)).toBe(true);
    expect(autoBackupDue(now - AUTO_BACKUP_INTERVAL_MS + 1, now)).toBe(false);
    expect(autoBackupDue(now - AUTO_BACKUP_INTERVAL_MS, now)).toBe(true);
  });

  test("uses a stable daily MemoFlow filename", () => {
    expect(automaticBackupName(new Date("2026-10-15T23:59:00Z"))).toBe(
      "MemoFlow-auto-2026-10-15.memoflow",
    );
  });
});
