import { describe, expect, test } from "bun:test";
import { MAX_SUBITEM_DEPTH, parseOutline, buildTree, type SubItem } from "../src/lib/subitems";

describe("sub-item outlines", () => {
  test("preserves hierarchy for item types that support it", () => {
    expect(parseOutline("رئيسي\n  فرعي\n\tأعمق")).toEqual([
      { depth: 0, title: "رئيسي" },
      { depth: 1, title: "فرعي" },
      { depth: 1, title: "أعمق" },
    ]);
    expect(parseOutline(`${" ".repeat(30)}نهاية`)[0]?.depth).toBe(MAX_SUBITEM_DEPTH);
  });

  test("flattens task checklists and removes common checklist markers", () => {
    expect(parseOutline("- الأول\n  • الثاني\n\t[x] الثالث", true)).toEqual([
      { depth: 0, title: "الأول" },
      { depth: 0, title: "الثاني" },
      { depth: 0, title: "الثالث" },
    ]);
  });
});

describe("task checklist order", () => {
  const item = (
    id: string,
    priority: string,
    done: boolean,
    position: number,
    parent: string | null = null,
  ) =>
    ({
      id,
      priority,
      done,
      position,
      parent_item_id: parent,
      created_at: "2026-10-18T00:00:00Z",
    }) as SubItem;
  test("keeps incomplete items above completed items and orders each by priority", () => {
    const rows = [
      item("done-high", "high", true, 0),
      item("low", "low", false, 1),
      item("med", "med", false, 2),
      item("high", "high", false, 3),
      item("same-high", "high", false, 4),
    ];
    expect(buildTree(rows, true).map((row) => row.id)).toEqual([
      "high",
      "same-high",
      "med",
      "low",
      "done-high",
    ]);
    expect(rows.map((row) => row.id)).toEqual(["done-high", "low", "med", "high", "same-high"]);
    expect(
      buildTree(
        rows.map((row) => (row.id === "high" ? { ...row, done: true } : row)),
        true,
      ).map((row) => row.id),
    ).toEqual(["same-high", "med", "low", "done-high", "high"]);
  });
  test("preserves parent-child relationships and other modules' manual order", () => {
    const rows = [
      item("parent", "med", false, 0),
      item("child-done", "high", true, 0, "parent"),
      item("child-open", "low", false, 1, "parent"),
    ];
    expect(buildTree(rows, true)[0].children.map((row) => row.id)).toEqual([
      "child-open",
      "child-done",
    ]);
    expect(buildTree(rows)[0].children.map((row) => row.id)).toEqual(["child-done", "child-open"]);
  });
});
