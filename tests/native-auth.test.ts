import { describe, expect, test } from "bun:test";
import {
  nativeRecoveryHandoffUrl,
  parseNativeOAuthCallback,
  parseNativeRecoveryCallback,
} from "../src/services/native-auth";

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

describe("native password recovery callback", () => {
  const recovery = "app.lovable.c357f296dbad4d33991e76d86c92e6d0://auth/recovery";

  test("accepts only recovery tokens on the exact app path", () => {
    expect(
      parseNativeRecoveryCallback(
        `${recovery}#type=recovery&access_token=access&refresh_token=refresh`,
      ),
    ).toEqual({ accessToken: "access", refreshToken: "refresh", error: null });
    expect(() =>
      parseNativeRecoveryCallback(`${recovery}#type=signup&access_token=a&refresh_token=r`),
    ).toThrow();
    expect(() =>
      parseNativeRecoveryCallback(
        "app.lovable.c357f296dbad4d33991e76d86c92e6d0://auth/callback#type=recovery&access_token=a&refresh_token=r",
      ),
    ).toThrow();
  });

  test("builds a token handoff that never uses an https origin", () => {
    const url = nativeRecoveryHandoffUrl("access", "refresh");
    expect(url.startsWith(`${recovery}#`)).toBe(true);
    expect(url).toContain("type=recovery");
  });
});
