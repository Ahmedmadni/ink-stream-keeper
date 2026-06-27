import { z, type ZodTypeAny } from "zod";
import type { FieldSchema, FormValues, ItemTypeSchema } from "./types";
import { isVisible } from "./types";

function baseFor(field: FieldSchema): ZodTypeAny {
  switch (field.type) {
    case "number": case "money": case "currency":
    case "duration": case "progress": case "rating": {
      let s: ZodTypeAny = z.coerce.number();
      const v = field.validation;
      if (v?.min !== undefined) s = (s as z.ZodNumber).min(v.min, v.message);
      if (v?.max !== undefined) s = (s as z.ZodNumber).max(v.max, v.message);
      return s;
    }
    case "checkbox": case "switch":
      return z.coerce.boolean();
    case "multi_select": case "tags": case "gallery":
      return z.array(z.string());
    case "email": {
      let s = z.string().email(field.validation?.message ?? "بريد غير صالح");
      return s;
    }
    case "url": {
      let s = z.string().url(field.validation?.message ?? "رابط غير صالح");
      return s;
    }
    default: {
      let s: ZodTypeAny = z.string();
      const v = field.validation;
      if (v?.minLength !== undefined) s = (s as z.ZodString).min(v.minLength, v.message);
      if (v?.maxLength !== undefined) s = (s as z.ZodString).max(v.maxLength, v.message);
      if (v?.pattern) s = (s as z.ZodString).regex(new RegExp(v.pattern), v.message);
      return s;
    }
  }
}

/**
 * Build a Zod schema dynamically.
 * Hidden / invisible fields are stripped before validation.
 */
export function buildZodSchema(schema: ItemTypeSchema, values: FormValues) {
  const shape: Record<string, ZodTypeAny> = {};
  for (const f of schema.fields) {
    if (!isVisible(f, values)) continue;
    let s = baseFor(f);
    if (!f.required) {
      // allow empty string / null / undefined
      s = s.optional().nullable().or(z.literal(""));
    } else {
      if (f.type === "text" || f.type === "textarea" || f.type === "rich_text") {
        s = (s as z.ZodString).min(1, "هذا الحقل مطلوب");
      }
    }
    shape[f.name] = s;
  }
  return z.object(shape);
}

export function defaultsFor(schema: ItemTypeSchema): FormValues {
  const out: FormValues = {};
  for (const f of schema.fields) {
    if (f.defaultValue !== undefined) { out[f.name] = f.defaultValue; continue; }
    switch (f.type) {
      case "multi_select": case "tags": case "gallery": out[f.name] = []; break;
      case "checkbox": case "switch": out[f.name] = false; break;
      case "number": case "money": case "currency":
      case "duration": case "progress": case "rating": out[f.name] = ""; break;
      default: out[f.name] = ""; break;
    }
  }
  return out;
}