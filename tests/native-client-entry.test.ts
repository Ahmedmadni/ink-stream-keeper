import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/client.tsx", import.meta.url), "utf8");
const builder = readFileSync(new URL("../scripts/build-native.mjs", import.meta.url), "utf8");

describe("local SPA bootstrap", () => {
  test("installed bundles use a client router instead of hydrating the prerendered pending shell", () => {
    expect(builder).toContain('process.env.VITE_MEMOFLOW_LOCAL_SPA = "1"');
    expect(source).toContain('import.meta.env.VITE_MEMOFLOW_LOCAL_SPA === "1"');
    expect(source).toContain("createRoot(document)");
    expect(source).toContain("<RouterProvider router={router} />");
  });

  test("web builds preserve the TanStack Start server hydration path", () => {
    expect(source).toContain("hydrateRoot(");
    expect(source).toContain("<StartClient />");
  });
});
