import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const {
  floatingOwner,
  floatingNote,
  floatingCard,
  floatingCardKey,
  floatingPoint,
  containsPoint,
  visibleBounds,
  floatingAssetPath,
} = require("../electron/floating-security.cjs");
const owner = "11111111-1111-4111-8111-111111111111";
const note = {
  id: "note-1",
  userId: owner,
  title: "مذكرة",
  text: "نص",
  updatedAt: "2026-10-19",
  dark: false,
};
const root = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("desktop floating note boundaries", () => {
  test("accepts only bounded plain note fields and an account", () => {
    expect(
      floatingNote({ ...note, access_token: "must-not-leak", html: "<script>bad()</script>" }),
    ).toEqual(note);
    expect(floatingOwner(null)).toBe(null);
    expect(() => floatingOwner("-".repeat(36))).toThrow();
    expect(() => floatingNote({ ...note, userId: null })).toThrow();
    expect(() => floatingNote({ ...note, id: "../private" })).toThrow();
    expect(() => floatingNote({ ...note, text: "x".repeat(200001) })).toThrow();
  });
  test("distinguishes dropping inside the app and rejects invalid coordinates", () => {
    const bounds = { x: 10, y: 20, width: 100, height: 200 };
    expect(containsPoint(bounds, { x: 10, y: 20 })).toBe(true);
    expect(containsPoint(bounds, { x: 110, y: 40 })).toBe(false);
    expect(floatingPoint({ x: -100.4, y: 50.9 })).toEqual({ x: -100, y: 51 });
    expect(() => floatingPoint({ x: Infinity, y: 1 })).toThrow();
    expect(() => floatingPoint({ x: "1", y: 1 })).toThrow();
  });
  test("isolates task and note identities and rejects malformed checklist payloads", () => {
    const task = {
      ...note,
      kind: "task",
      done: false,
      items: [{ id: "item", title: "بند", done: false, access_token: "private" }],
    };
    const safe = floatingCard(task);
    expect(safe.items).toEqual([{ id: "item", title: "بند", done: false }]);
    expect(floatingCardKey(safe)).not.toBe(
      floatingCardKey(floatingCard({ ...note, kind: "note" })),
    );
    expect(() => floatingCard({ ...task, kind: "vault" })).toThrow();
    expect(() => floatingCard({ ...task, items: [{ ...task.items[0], done: "false" }] })).toThrow();
    expect(() => floatingCard({ ...task, items: [task.items[0], task.items[0]] })).toThrow();
    expect(() =>
      floatingCard({ ...task, items: [{ ...task.items[0], title: "x".repeat(4001) }] }),
    ).toThrow();
    expect(() => floatingCard({ ...task, items: Array(1001).fill(task.items[0]) })).toThrow();
  });
  test("keeps the card visible on small screens and negative-coordinate monitors", () => {
    expect(visibleBounds({ x: 500, y: -100 }, { x: 0, y: 0, width: 320, height: 600 })).toEqual({
      x: 0,
      y: 0,
      width: 320,
      height: 400,
    });
    expect(
      visibleBounds({ x: -3000, y: 2000 }, { x: -1920, y: 0, width: 1920, height: 1080 }),
    ).toEqual({ x: -1920, y: 680, width: 360, height: 400 });
  });
  test("serves only the detached renderer and bundled fonts", () => {
    expect(floatingAssetPath("/bundle", "memoflow://floating/index.html")).toBe(
      resolve("/bundle/index.html"),
    );
    expect(
      floatingAssetPath(
        "/bundle",
        "memoflow://floating/fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2",
      ),
    ).toBeTruthy();
    for (const url of [
      "memoflow://app/index.html",
      "memoflow://floating/../preload.cjs",
      "memoflow://floating/auth",
      "memoflow://floating/%2f..%2fprivate",
      "https://floating/index.html",
    ])
      expect(floatingAssetPath("/bundle", url)).toBe(null);
  });
  test("ships matching developer identity and version information", () => {
    const pkg = JSON.parse(read("electron/package.json"));
    expect(pkg.author.name).toBe("أحمد محمد المدني");
    expect(pkg.author.url).toBe("https://ahmedelmadni.com");
    expect(read("src/lib/app-info.ts")).toContain(pkg.author.url);
    expect(read("src/lib/app-info.ts")).toContain(pkg.author.name);
    expect(read("src/lib/app-info.ts")).toContain(pkg.version);
    expect(read("electron/preload.cjs")).toContain(`version: "${pkg.version}"`);
  });
});
