// Version 1 is intentionally fixed: new database columns need a format migration.
import { z } from "zod";
const json: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(json), z.record(json)]),
);
export const rowSchemas = {
  profiles: z
    .object({
      avatar_url: z.string().nullable(),
      created_at: z.string(),
      display_name: z.string().nullable(),
      id: z.string().uuid(),
      language: z.string(),
      theme: z.string(),
      updated_at: z.string(),
    })
    .strict(),
  categories: z
    .object({
      color: z.string(),
      created_at: z.string(),
      icon: z.string(),
      id: z.string().uuid(),
      locked: z.boolean(),
      name: z.string(),
      sort_order: z.number().finite(),
      user_id: z.string().uuid(),
    })
    .strict(),
  workspaces: z
    .object({
      archived: z.boolean(),
      color: z.string(),
      cover_url: z.string().nullable(),
      created_at: z.string(),
      description: z.string().nullable(),
      end_date: z.string().nullable(),
      favorite: z.boolean(),
      icon: z.string(),
      id: z.string().uuid(),
      name: z.string(),
      position: z.number().finite(),
      start_date: z.string().nullable(),
      status: z.string(),
      updated_at: z.string(),
      user_id: z.string().uuid(),
    })
    .strict(),
  notes: z
    .object({
      archived: z.boolean(),
      category_id: z.string().uuid().nullable(),
      content: z.string(),
      created_at: z.string(),
      emoji: z.string().nullable(),
      favorite: z.boolean(),
      id: z.string().uuid(),
      pinned: z.boolean(),
      title: z.string(),
      updated_at: z.string(),
      user_id: z.string().uuid(),
    })
    .strict(),
  tasks: z
    .object({
      category_id: z.string().uuid().nullable(),
      created_at: z.string(),
      description: z.string().nullable(),
      done: z.boolean(),
      due_at: z.string().nullable(),
      id: z.string().uuid(),
      links: z.array(z.string()),
      notes: z.string().nullable(),
      priority: z.string(),
      progress: z.number().finite(),
      recurrence: z.string(),
      reminder_at: z.string().nullable(),
      start_at: z.string().nullable(),
      status: z.string(),
      tags: z.array(z.string()),
      title: z.string(),
      updated_at: z.string(),
      user_id: z.string().uuid(),
    })
    .strict(),
  purchase_lists: z
    .object({
      budget: z.number().finite(),
      category_id: z.string().uuid().nullable(),
      created_at: z.string(),
      currency: z.string(),
      description: z.string().nullable(),
      end_date: z.string().nullable(),
      id: z.string().uuid(),
      notes: z.string().nullable(),
      priority: z.string(),
      start_date: z.string().nullable(),
      status: z.string(),
      title: z.string(),
      updated_at: z.string(),
      user_id: z.string().uuid(),
    })
    .strict(),
  purchase_items: z
    .object({
      actual_price: z.number().finite().nullable(),
      barcode: z.string().nullable(),
      brand: z.string().nullable(),
      created_at: z.string(),
      expected_price: z.number().finite(),
      id: z.string().uuid(),
      image_url: z.string().nullable(),
      notes: z.string().nullable(),
      purchase_list_id: z.string().uuid(),
      purchased: z.boolean(),
      purchased_at: z.string().nullable(),
      quantity: z.number().finite(),
      sort_order: z.number().finite(),
      store_name: z.string().nullable(),
      title: z.string(),
      updated_at: z.string(),
      user_id: z.string().uuid(),
    })
    .strict(),
  plans: z
    .object({
      ai_meta: json,
      archived_at: z.string().nullable(),
      budget: z.number().finite().nullable(),
      color: z.string().nullable(),
      created_at: z.string(),
      currency: z.string().nullable(),
      description: z.string().nullable(),
      end_date: z.string().nullable(),
      estimated_duration: z.number().finite().nullable(),
      icon: z.string().nullable(),
      id: z.string().uuid(),
      is_favorite: z.boolean(),
      notes: z.string().nullable(),
      objective: z.string().nullable(),
      priority: z.string(),
      progress: z.number().finite(),
      start_date: z.string().nullable(),
      status: z.string(),
      tags: z.array(z.string()),
      title: z.string(),
      type: z.string(),
      type_data: json,
      updated_at: z.string(),
      user_id: z.string().uuid(),
      workspace_id: z.string().uuid().nullable(),
    })
    .strict(),
  plan_stages: z
    .object({
      created_at: z.string(),
      description: z.string().nullable(),
      end_date: z.string().nullable(),
      id: z.string().uuid(),
      name: z.string(),
      plan_id: z.string().uuid(),
      position: z.number().finite(),
      progress: z.number().finite(),
      start_date: z.string().nullable(),
      status: z.string(),
      updated_at: z.string(),
      user_id: z.string().uuid(),
    })
    .strict(),
  plan_steps: z
    .object({
      created_at: z.string(),
      done: z.boolean(),
      done_at: z.string().nullable(),
      duration: z.number().finite().nullable(),
      id: z.string().uuid(),
      name: z.string(),
      notes: z.string().nullable(),
      plan_id: z.string().uuid(),
      position: z.number().finite(),
      stage_id: z.string().uuid(),
      updated_at: z.string(),
      user_id: z.string().uuid(),
    })
    .strict(),
  plan_links: z
    .object({
      created_at: z.string(),
      id: z.string().uuid(),
      item_id: z.string().uuid(),
      item_type: z.string(),
      label: z.string().nullable(),
      plan_id: z.string().uuid(),
      position: z.number().finite(),
      url: z.string().nullable(),
      user_id: z.string().uuid(),
    })
    .strict(),
  subtasks: z
    .object({
      created_at: z.string(),
      done: z.boolean(),
      due_at: z.string().nullable(),
      id: z.string().uuid(),
      sort_order: z.number().finite(),
      task_id: z.string().uuid(),
      title: z.string(),
      updated_at: z.string(),
      user_id: z.string().uuid(),
    })
    .strict(),
  task_checklist: z
    .object({
      created_at: z.string(),
      done: z.boolean(),
      id: z.string().uuid(),
      sort_order: z.number().finite(),
      task_id: z.string().uuid(),
      text: z.string(),
      updated_at: z.string(),
      user_id: z.string().uuid(),
    })
    .strict(),
  sub_items: z
    .object({
      converted_task_id: z.string().uuid().nullable(),
      created_at: z.string(),
      depth: z.number().finite(),
      description: z.string().nullable(),
      done: z.boolean(),
      done_at: z.string().nullable(),
      end_at: z.string().nullable(),
      id: z.string().uuid(),
      meta: json,
      notes: z.string().nullable(),
      parent_id: z.string().uuid(),
      parent_item_id: z.string().uuid().nullable(),
      parent_type: z.string(),
      position: z.number().finite(),
      priority: z.string(),
      progress: z.number().finite(),
      reminder_at: z.string().nullable(),
      start_at: z.string().nullable(),
      status: z.string(),
      title: z.string(),
      updated_at: z.string(),
      user_id: z.string().uuid(),
    })
    .strict(),
  attachments: z
    .object({
      created_at: z.string(),
      id: z.string().uuid(),
      mime_type: z.string(),
      name: z.string(),
      note_id: z.string().uuid(),
      size_bytes: z.number().finite(),
      storage_path: z.string(),
      user_id: z.string().uuid(),
    })
    .strict(),
  item_attachments: z
    .object({
      created_at: z.string(),
      id: z.string().uuid(),
      item_id: z.string().uuid(),
      item_type: z.string(),
      mime_type: z.string(),
      name: z.string(),
      size_bytes: z.number().finite(),
      storage_path: z.string(),
      user_id: z.string().uuid(),
    })
    .strict(),
  item_comments: z
    .object({
      body: z.string(),
      created_at: z.string(),
      id: z.string().uuid(),
      item_id: z.string().uuid(),
      item_type: z.string(),
      updated_at: z.string(),
      user_id: z.string().uuid(),
    })
    .strict(),
  item_activity: z
    .object({
      action: z.string(),
      created_at: z.string(),
      id: z.string().uuid(),
      item_id: z.string().uuid(),
      item_type: z.string(),
      meta: json,
      parent_id: z.string().uuid().nullable(),
      parent_type: z.string().nullable(),
      user_id: z.string().uuid(),
    })
    .strict(),
  workspace_items: z
    .object({
      added_at: z.string(),
      id: z.string().uuid(),
      item_id: z.string().uuid(),
      item_type: z.string(),
      position: z.number().finite(),
      user_id: z.string().uuid(),
      workspace_id: z.string().uuid(),
    })
    .strict(),
  workspace_links: z
    .object({
      created_at: z.string(),
      description: z.string().nullable(),
      favicon: z.string().nullable(),
      id: z.string().uuid(),
      position: z.number().finite(),
      title: z.string(),
      updated_at: z.string(),
      url: z.string(),
      user_id: z.string().uuid(),
      workspace_id: z.string().uuid(),
    })
    .strict(),
  smart_collections: z
    .object({
      color: z.string(),
      created_at: z.string(),
      filters: json,
      icon: z.string(),
      id: z.string().uuid(),
      item_type: z.string(),
      name: z.string(),
      position: z.number().finite(),
      updated_at: z.string(),
      user_id: z.string().uuid(),
      workspace_id: z.string().uuid().nullable(),
    })
    .strict(),
  workspace_activity: z
    .object({
      action: z.string(),
      created_at: z.string(),
      id: z.string().uuid(),
      item_id: z.string().uuid().nullable(),
      item_type: z.string().nullable(),
      meta: json,
      user_id: z.string().uuid(),
      workspace_id: z.string().uuid(),
    })
    .strict(),
  vault_settings: z
    .object({
      created_at: z.string(),
      kdf_salt: z.string(),
      updated_at: z.string(),
      user_id: z.string().uuid(),
      verifier_ct: z.string(),
      verifier_iv: z.string(),
    })
    .strict(),
  vault_categories: z
    .object({
      color: z.string(),
      created_at: z.string(),
      icon: z.string(),
      id: z.string().uuid(),
      name: z.string(),
      sort_order: z.number().finite(),
      user_id: z.string().uuid(),
    })
    .strict(),
  vault_entries: z
    .object({
      category_id: z.string().uuid().nullable(),
      created_at: z.string(),
      id: z.string().uuid(),
      label: z.string(),
      notes: z.string(),
      password_ct: z.string(),
      password_iv: z.string(),
      updated_at: z.string(),
      url: z.string(),
      user_id: z.string().uuid(),
      username: z.string(),
    })
    .strict(),
} as const;
export const TABLES = Object.keys(rowSchemas) as (keyof typeof rowSchemas)[];
export type TableName = keyof typeof rowSchemas;
export type BackupRow = Record<string, unknown>;
export type BackupTables = Record<TableName, BackupRow[]>;
