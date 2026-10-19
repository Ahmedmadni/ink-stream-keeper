import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const { isAppUrl, isAuthCallback, isOAuthUrl, externalUrl, bundledPath } = createRequire(
  import.meta.url,
)("../electron/security.cjs");

describe("desktop trust boundaries", () => {
  test("only the bundled origin can access the desktop bridge", () => {
    expect(isAppUrl("memoflow://app/tasks/123")).toBe(true);
    for (const url of [
      "https://app/tasks",
      "memoflow://app.evil/",
      "memoflow://app:8080/",
      "memoflow://user@app/",
    ])
      expect(isAppUrl(url)).toBe(false);
  });
  test("external browser only opens the known OAuth broker with a state", () => {
    const url = new URL("https://ink-stream-keeper.lovable.app/~oauth/initiate");
    url.search = new URLSearchParams({
      provider: "google",
      redirect_uri: "lovable://oauth-callback",
      state: "a".repeat(32),
    }).toString();
    expect(isOAuthUrl(url.toString())).toBe(true);
    const unsafe = new URL(url);
    unsafe.hostname = "evil.example";
    expect(isOAuthUrl(unsafe.toString())).toBe(false);
    url.searchParams.delete("state");
    expect(isOAuthUrl(url.toString())).toBe(false);
    expect(externalUrl("javascript:alert(1)")).toBe(false);
    expect(externalUrl("file:///secret")).toBe(false);
  });
  test("callbacks must have the exact supported scheme and path", () => {
    expect(isAuthCallback("lovable://oauth-callback#state=fixture")).toBe(true);
    expect(
      isAuthCallback("app.lovable.c357f296dbad4d33991e76d86c92e6d0://auth/recovery#type=recovery"),
    ).toBe(true);
    expect(isAuthCallback("lovable://oauth-callback/extra")).toBe(false);
    expect(isAuthCallback("https://oauth-callback")).toBe(false);
  });
  test("SPA navigation resolves locally without serving files outside the bundle", () => {
    const root = resolve("/bundle/web");
    expect(bundledPath(root, "memoflow://app/tasks/123")).toBe(resolve(root, "index.html"));
    expect(bundledPath(root, "memoflow://app/assets/app.js")).toBe(resolve(root, "assets/app.js"));
    for (const url of [
      "memoflow://app/%2f..%2fsecret.txt",
      "memoflow://app/%5c..%5csecret.txt",
      "memoflow://app/%00.txt",
      "memoflow://app/api/private",
      "memoflow://other/assets/app.js",
    ])
      expect(bundledPath(root, url)).toBeNull();
  });
});
