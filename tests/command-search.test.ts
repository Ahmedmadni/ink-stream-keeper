import { describe, expect, test } from "bun:test";
import { filterCommandItems } from "../src/lib/command-search";

describe("command palette search coverage", () => {
  const rows = Array.from({ length: 65 }, (_, index) => ({
    id: index + 1,
    title: `مهمة ${index + 1}`,
    notes: index === 64 ? "ملاحظات إضافية" : "",
  }));

  test("limits the initial list without hiding older search results", () => {
    expect(filterCommandItems(rows, "", (row) => row.title)).toHaveLength(20);
    expect(filterCommandItems(rows, "مهمة 65", (row) => row.title).map((row) => row.id)).toEqual([65]);
  });

  test("searches notes, not just titles, and ignores surrounding whitespace", () => {
    const found = filterCommandItems(rows, "  إضافية  ", (row) => `${row.title} ${row.notes}`);
    expect(found.map((row) => row.id)).toEqual([65]);
  });

  test("never renders more than the requested number of matches", () => {
    expect(filterCommandItems(rows, "مهمة", (row) => row.title, 3)).toHaveLength(3);
    expect(filterCommandItems(rows, "مهمة", (row) => row.title, 0)).toEqual([]);
  });
});
