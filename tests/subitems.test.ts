import { describe, expect, test } from "bun:test";
import { MAX_SUBITEM_DEPTH, parseOutline } from "../src/lib/subitems";

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
