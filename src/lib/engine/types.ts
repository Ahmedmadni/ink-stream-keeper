/**
 * Dynamic Item Engine — core types.
 *
 * A single ItemTypeSchema is enough to render:
 *   • create / edit form  (DynamicForm)
 *   • detail view         (DynamicDetail)
 *   • list summary card   (DynamicSummaryCard)
 *   • dashboard stats     (DynamicStatistics)
 *
 * Adding a new item type later requires no new UI code — just a schema.
 */
import type { ComponentType, ReactNode } from "react";
import type { ItemTypeKey } from "@/lib/item-types";

export type FieldType =
  | "text" | "textarea" | "rich_text"
  | "number" | "money" | "currency" | "duration" | "progress" | "rating"
  | "date" | "time" | "datetime" | "date_range"
  | "select" | "multi_select" | "radio" | "checkbox" | "switch"
  | "tags" | "url" | "email" | "phone" | "color" | "icon"
  | "image" | "gallery" | "attachment"
  | "checklist" | "subtasks"
  | "location" | "barcode";

export type FieldOption = { value: string; label: string; icon?: ComponentType<{ className?: string }>; color?: string };

export type FieldValidation = {
  min?: number; max?: number;
  minLength?: number; maxLength?: number;
  pattern?: string;        // regex source
  message?: string;
};

/** Show this field only when another field matches a value. */
export type VisibleWhen = { field: string; equals?: unknown; in?: unknown[]; truthy?: boolean };

export type FieldSchema = {
  name: string;                    // form key
  label: ReactNode;
  type: FieldType;
  required?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  help?: ReactNode;
  options?: FieldOption[];         // select/radio/multi_select
  validation?: FieldValidation;
  visibleWhen?: VisibleWhen;
  group?: string;                  // section/tab key
  /** Grid column span 1..4 (default 4 = full width). */
  width?: 1 | 2 | 3 | 4;
  order?: number;
  /** Static UI props per type (e.g. currency for money). */
  meta?: Record<string, unknown>;
  /** Hide in form / detail without removing from schema. */
  hidden?: boolean;
  readOnly?: boolean;
};

export type LayoutNode =
  | { kind: "section"; key: string; title?: ReactNode; description?: ReactNode; columns?: 1 | 2 | 3 | 4; fields: string[] }
  | { kind: "tabs"; key: string; tabs: { key: string; label: ReactNode; fields: string[] }[] }
  | { kind: "accordion"; key: string; items: { key: string; label: ReactNode; fields: string[]; open?: boolean }[] }
  | { kind: "grid"; key: string; columns: 1 | 2 | 3 | 4; fields: string[] };

export type SummaryConfig = {
  /** Field name used as the card title. */
  primary: string;
  /** Optional secondary line. */
  secondary?: string;
  /** Up to 3 small metrics (formatted from the row). */
  metrics?: { label: ReactNode; from: string; format?: "money" | "percent" | "number" | "date" | "tag" }[];
  /** Field used as the "done/complete" boolean (for muted styling). */
  doneField?: string;
  /** Optional progress field name (0..100). */
  progressField?: string;
};

export type StatsEntryDef<Row> = {
  key: string;
  label: ReactNode;
  tone?: "primary" | "success" | "warning" | "destructive" | "accent" | "muted";
  icon?: ComponentType<{ className?: string }>;
  compute: (rows: Row[]) => { value: ReactNode; hint?: ReactNode };
};

export type ItemTypeSchema<Row = Record<string, unknown>> = {
  id: ItemTypeKey;
  fields: FieldSchema[];
  /** Optional layout. If omitted, fields render in a single section. */
  layout?: LayoutNode[];
  /** Summary rendering for list views. */
  summary: SummaryConfig;
  /** Statistics computed across a collection of rows. */
  stats?: StatsEntryDef<Row>[];
};

export type FormValues = Record<string, unknown>;

export function isVisible(field: FieldSchema, values: FormValues): boolean {
  if (field.hidden) return false;
  const v = field.visibleWhen;
  if (!v) return true;
  const cur = values[v.field];
  if (v.truthy !== undefined) return Boolean(cur) === v.truthy;
  if (v.in) return v.in.includes(cur);
  if (v.equals !== undefined) return cur === v.equals;
  return true;
}

export function orderedFields(schema: ItemTypeSchema): FieldSchema[] {
  return [...schema.fields]
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

export function getField(schema: ItemTypeSchema, name: string): FieldSchema | undefined {
  return schema.fields.find((f) => f.name === name);
}