/**
 * Block Engine — Page Composition
 * -------------------------------------------------------------
 * Every detail page in MemoFlow is composed from an ordered list of
 * `BlockInstance`s. A registry maps `type` → renderer component.
 * Adding a new item type = declare its block list, no JSX required.
 */
import type { ComponentType, ReactNode } from "react";

export type BlockType =
  | "header"
  | "statistics"
  | "progress"
  | "timeline"
  | "checklist"
  | "gallery"
  | "rich_text"
  | "attachments"
  | "comments"
  | "recent_activity"
  | "related_items"
  | "properties"
  | "calendar"
  | "budget"
  | "tags"
  | "links"
  | "custom";

export type BlockPermission = "read" | "edit" | "admin";

export type BlockVisibleWhen<Ctx = unknown> = (ctx: Ctx) => boolean;

export type BlockLayout = {
  /** column span 1..4 (defaults to 4 = full width) */
  span?: 1 | 2 | 3 | 4;
  /** stick to top on scroll */
  sticky?: boolean;
  /** hide chrome (bg card, padding) — render bare */
  bare?: boolean;
};

export type BlockInstance<Props = Record<string, unknown>, Ctx = unknown> = {
  id: string;
  type: BlockType;
  /** lower priority renders first */
  priority?: number;
  /** collapsed by default (still lazy-mounted) */
  collapsed?: boolean;
  /** predicate against a runtime context (usually the resource + stats) */
  visibleWhen?: BlockVisibleWhen<Ctx>;
  layout?: BlockLayout;
  permissions?: BlockPermission[];
  /** typed props passed to the block renderer */
  props: Props;
  /** override registered title */
  title?: ReactNode;
  /** heavy blocks defer until the block is scrolled near */
  lazy?: boolean;
};

export type BlockRendererProps<Props = Record<string, unknown>, Ctx = unknown> = {
  block: BlockInstance<Props, Ctx>;
  context: Ctx;
};

export type BlockRegistryEntry = {
  /** default title shown in block chrome (may be overridden per instance) */
  title?: ReactNode;
  /** Renderer component. */
  component: ComponentType<BlockRendererProps<any, any>>;
  /** Whether the block should default to lazy mount. */
  defaultLazy?: boolean;
};

const REGISTRY = new Map<BlockType, BlockRegistryEntry>();

export function registerBlock(type: BlockType, entry: BlockRegistryEntry): void {
  REGISTRY.set(type, entry);
}

export function getBlockEntry(type: BlockType): BlockRegistryEntry | undefined {
  return REGISTRY.get(type);
}

export function orderedBlocks<Props, Ctx>(
  blocks: BlockInstance<Props, Ctx>[],
  context: Ctx,
): BlockInstance<Props, Ctx>[] {
  return [...blocks]
    .filter((b) => (b.visibleWhen ? b.visibleWhen(context) : true))
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
}

/** Helper to build a typed block instance with narrower props inference. */
export function defineBlock<P extends Record<string, unknown>, Ctx = unknown>(
  b: BlockInstance<P, Ctx>,
): BlockInstance<P, Ctx> {
  return b;
}

export type BlockComposition<Ctx = unknown> = BlockInstance<any, Ctx>[];