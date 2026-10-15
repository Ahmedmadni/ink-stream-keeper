import { describe, expect, test } from "bun:test";

import config from "../capacitor.config";

describe("Android bundled app configuration", () => {
  test("loads the UI bundled in the APK", () => {
    expect(config.webDir).toBe(".output/public");
    expect(config.server?.url).toBeUndefined();
  });

  test("does not allow mixed HTTP content", () => {
    expect(config.android?.allowMixedContent).toBe(false);
  });

  test("uses native HTTP for explicit remote backend calls", () => {
    expect(config.plugins?.CapacitorHttp?.enabled).toBe(true);
  });
});
