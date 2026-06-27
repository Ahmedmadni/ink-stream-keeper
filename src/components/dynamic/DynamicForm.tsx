import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { DynamicField } from "./DynamicField";
import { DynamicSection } from "./DynamicSection";
import { buildZodSchema, defaultsFor } from "@/lib/engine/validation";
import { getField, isVisible, type FormValues, type ItemTypeSchema } from "@/lib/engine/types";

/**
 * Generic form renderer driven entirely by an ItemTypeSchema.
 * Lays out fields using the schema's `layout` (sections/grid),
 * validates via Zod built from the schema, and calls onSubmit
 * with clean form values.
 */
export function DynamicForm({
  schema, initialValues, onSubmit, submitLabel = "حفظ", busy,
}: {
  schema: ItemTypeSchema;
  initialValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void> | void;
  submitLabel?: string;
  busy?: boolean;
}) {
  const [values, setValues] = useState<FormValues>(() => ({
    ...defaultsFor(schema), ...(initialValues ?? {}),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const layout = useMemo(() => schema.layout ?? [
    { kind: "section", key: "_all", fields: schema.fields.map((f) => f.name), columns: 1 } as const,
  ], [schema]);

  const update = (name: string, v: unknown) =>
    setValues((prev) => ({ ...prev, [name]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const z = buildZodSchema(schema, values);
    const parsed = z.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0] ?? "");
        if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    try {
      setSubmitting(true);
      // strip hidden / invisible fields
      const out: FormValues = {};
      for (const f of schema.fields) {
        if (isVisible(f, values)) out[f.name] = values[f.name];
      }
      await onSubmit(out);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {layout.map((node) => {
        if (node.kind === "section" || node.kind === "grid") {
          return (
            <DynamicSection
              key={node.key}
              title={"title" in node ? node.title : undefined}
              description={"description" in node ? node.description : undefined}
              columns={node.columns ?? 1}
            >
              {node.fields.map((name) => {
                const f = getField(schema, name);
                if (!f || !isVisible(f, values)) return null;
                return (
                  <DynamicField
                    key={f.name} field={f} value={values[f.name]}
                    onChange={(v) => update(f.name, v)} error={errors[f.name]}
                  />
                );
              })}
            </DynamicSection>
          );
        }
        // tabs / accordion → flatten for v1
        const inner = "tabs" in node ? node.tabs : node.items;
        return (
          <div key={node.key} className="space-y-4">
            {inner.map((g) => (
              <DynamicSection key={g.key} title={g.label} columns={1}>
                {g.fields.map((name) => {
                  const f = getField(schema, name);
                  if (!f || !isVisible(f, values)) return null;
                  return (
                    <DynamicField
                      key={f.name} field={f} value={values[f.name]}
                      onChange={(v) => update(f.name, v)} error={errors[f.name]}
                    />
                  );
                })}
              </DynamicSection>
            ))}
          </div>
        );
      })}

      <button
        type="submit" disabled={submitting || busy}
        className="grid w-full place-items-center rounded-2xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-fab disabled:opacity-70"
      >
        {submitting || busy ? <Loader2 className="size-5 animate-spin" /> : submitLabel}
      </button>
    </form>
  );
}