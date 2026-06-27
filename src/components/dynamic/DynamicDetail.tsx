import type { ReactNode } from "react";
import { DynamicSection } from "./DynamicSection";
import { getField, isVisible, orderedFields, type FormValues, type ItemTypeSchema } from "@/lib/engine/types";
import { formatCurrency } from "@/lib/item-types";

/**
 * Read-only renderer. Same schema → consistent detail view across types.
 */
export function DynamicDetail({
  schema, values,
}: { schema: ItemTypeSchema; values: FormValues }) {
  const layout = schema.layout ?? [
    { kind: "section", key: "_all", fields: orderedFields(schema).map((f) => f.name), columns: 1 } as const,
  ];
  return (
    <div className="space-y-5">
      {layout.map((node) => {
        if (node.kind === "section" || node.kind === "grid") {
          return (
            <DynamicSection key={node.key}
              title={"title" in node ? node.title : undefined}
              columns={node.columns ?? 1}>
              {node.fields.map((name) => {
                const f = getField(schema, name);
                if (!f || !isVisible(f, values)) return null;
                return <FieldDisplay key={name} label={f.label} value={renderValue(f.type, values[name], f.meta)} />;
              })}
            </DynamicSection>
          );
        }
        const inner = "tabs" in node ? node.tabs : node.items;
        return inner.map((g) => (
          <DynamicSection key={g.key} title={g.label} columns={1}>
            {g.fields.map((name) => {
              const f = getField(schema, name);
              if (!f || !isVisible(f, values)) return null;
              return <FieldDisplay key={name} label={f.label} value={renderValue(f.type, values[name], f.meta)} />;
            })}
          </DynamicSection>
        ));
      })}
    </div>
  );
}

function FieldDisplay({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-card">
      <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-semibold">{value || <span className="text-muted-foreground/60">—</span>}</div>
    </div>
  );
}

function renderValue(type: string, v: unknown, meta?: Record<string, unknown>): ReactNode {
  if (v == null || v === "") return "";
  switch (type) {
    case "money": case "currency":
      return formatCurrency(Number(v), (meta?.currency as string) ?? "SAR");
    case "tags": case "multi_select":
      return (
        <div className="flex flex-wrap gap-1.5">
          {(v as string[]).map((t) => (
            <span key={t} className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">{t}</span>
          ))}
        </div>
      );
    case "checkbox": case "switch":
      return v ? "نعم" : "لا";
    case "date": case "datetime":
      return new Date(v as string).toLocaleDateString("ar-EG");
    case "progress": case "rating":
      return `${v}${type === "progress" ? "%" : ""}`;
    case "color":
      return (
        <span className="inline-flex items-center gap-2">
          <span className="size-4 rounded-full border" style={{ background: v as string }} />
          {String(v)}
        </span>
      );
    default:
      return String(v);
  }
}