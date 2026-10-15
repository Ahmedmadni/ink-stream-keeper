import { describe, expect, test } from "bun:test";

import { resolveAppEndpoint } from "../src/lib/native-url";

describe("native backend URLs", () => {
  test("keeps server routes relative on the web", () => {
    expect(resolveAppEndpoint("/api/transcribe", false)).toBe("/api/transcribe");
  });

  test("uses the public HTTPS backend from the bundled Android UI", () => {
    expect(resolveAppEndpoint("/api/transcribe", true)).toBe(
      "https://ink-stream-keeper.lovable.app/api/transcribe",
    );
  });
});
