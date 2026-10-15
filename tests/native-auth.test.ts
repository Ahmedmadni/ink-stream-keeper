import { describe, expect, test } from "bun:test";
import { parseNativeOAuthCallback } from "../src/services/native-auth";

const callback = "app.lovable.c357f296dbad4d33991e76d86c92e6d0://auth/callback";

describe("native OAuth callback", () => {
  test("accepts matching state and tokens from query parameters", () => {
    expect(
      parseNativeOAuthCallback(
        `${callback}?state=safe&access_token=access&refresh_token=refresh`,
        "safe",
      ),
    ).toEqual({ accessToken: "access", refreshToken: "refresh", error: null });
  });

  test("accepts token fragments used by implicit OAuth callbacks", () => {
    expect(
      parseNativeOAuthCallback(
        `${callback}#state=safe&access_token=access&refresh_token=refresh`,
        "safe",
      ),
    ).toEqual({ accessToken: "access", refreshToken: "refresh", error: null });
  });

  test("rejects another scheme, path, or state", () => {
    expect(() => parseNativeOAuthCallback("https://auth/callback?state=safe", "safe")).toThrow();
    expect(() => parseNativeOAuthCallback(`${callback}/extra?state=safe`, "safe")).toThrow();
    expect(() => parseNativeOAuthCallback(`${callback}?state=other`, "safe")).toThrow();
  });

  test("returns provider errors without exposing tokens", () => {
    expect(parseNativeOAuthCallback(`${callback}?state=safe&error=access_denied`, "safe")).toEqual({
      accessToken: null,
      refreshToken: null,
      error: "access_denied",
    });
  });
});
