import { describe, expect, test } from "bun:test";
import { getBlockEntry, type BlockType } from "../src/lib/engine/blocks";
import { ensureBlockRegistry } from "../src/components/blocks/registry";

const builtInBlockTypes: BlockType[] = [
  "header",
  "statistics",
  "progress",
  "timeline",
  "checklist",
  "sub_items",
  "gallery",
  "rich_text",
  "attachments",
  "comments",
  "recent_activity",
  "related_items",
  "properties",
  "calendar",
  "budget",
  "tags",
  "links",
  "custom",
];

describe("block renderer registry", () => {
  test("registers every built-in renderer and remains idempotent", () => {
    ensureBlockRegistry();
    ensureBlockRegistry();

    for (const type of builtInBlockTypes) {
      expect(typeof getBlockEntry(type)?.component).toBe("function");
    }
  });
});
