import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import config from "../capacitor.config";

describe("Android bundled app configuration", () => {
  test("uses the permanent MemoFlow package identity", () => {
    expect(config.appId).toBe("com.ahmedmadni.memoflow");
  });

  test("loads the UI bundled in the APK", () => {
    expect(config.webDir).toBe(".output/public");
    expect(config.server?.url).toBeUndefined();
  });

  test("does not allow mixed HTTP content", () => {
    expect(config.android?.allowMixedContent).toBe(false);
  });

  test("never logs sensitive native plugin arguments", () => {
    expect(config.loggingBehavior).toBe("none");
  });

  test("uses native HTTP for explicit remote backend calls", () => {
    expect(config.plugins?.CapacitorHttp?.enabled).toBe(true);
  });
});

describe("Android security and recovery wiring", () => {
  const mainActivity = readFileSync(
    new URL(
      "../android/app/src/main/java/com/ahmedmadni/memoflow/MainActivity.java",
      import.meta.url,
    ),
    "utf8",
  );
  const manifest = readFileSync(
    new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url),
    "utf8",
  );

  test("registers app lock and automatic backup plugins", () => {
    expect(mainActivity).toContain("package com.ahmedmadni.memoflow;");
    expect(mainActivity).toContain("registerPlugin(MemoFlowAppLockPlugin.class)");
    expect(mainActivity).toContain("registerPlugin(MemoFlowBackupPlugin.class)");
    expect(mainActivity).toContain("FLAG_SECURE");
    expect(mainActivity).toContain("setWebContentsDebuggingEnabled(false)");
  });

  test("returns password recovery links to the exact native path", () => {
    expect(manifest).toContain('android:path="/recovery"');
    expect(manifest).toContain('android:host="auth"');
  });
});
