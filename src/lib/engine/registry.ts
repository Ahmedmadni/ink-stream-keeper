import type { ItemTypeKey } from "@/lib/item-types";
import type { ItemTypeSchema } from "./types";
import { taskSchema } from "./schemas/task.schema";
import { purchaseListSchema } from "./schemas/purchase.schema";

/**
 * Central registry. Every implemented item type registers its schema here.
 * Adding a new type later = create schemas/<type>.schema.ts and add it below.
 */
export const SCHEMA_REGISTRY: Partial<Record<ItemTypeKey, ItemTypeSchema<any>>> = {
  task: taskSchema,
  purchase_list: purchaseListSchema,
};

export function getSchema(key: ItemTypeKey): ItemTypeSchema | undefined {
  return SCHEMA_REGISTRY[key] as ItemTypeSchema | undefined;
}