import { describe, expect, test } from "bun:test";

import config from "../capacitor.config";

describe("Android hosted app configuration", () => {
  test("uses the public MemoFlow deployment instead of a protected Lovable preview", () => {
    const hostedUrl = config.server?.url;

    expect(hostedUrl).toBe("https://ink-stream-keeper.lovable.app");
    expect(hostedUrl).not.toContain("id-preview--");
  });

  test("keeps hosted traffic on HTTPS", () => {
    expect(config.server?.cleartext).toBe(false);
    expect(new URL(config.server?.url ?? "").protocol).toBe("https:");
  });
});
