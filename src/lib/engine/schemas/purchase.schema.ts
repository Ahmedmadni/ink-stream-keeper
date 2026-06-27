import type { ItemTypeSchema } from "../types";
import { formatCurrency } from "@/lib/item-types";

export type PurchaseListRow = {
  id: string;
  title: string;
  description: string | null;
  store: string | null;
  budget: number | null;
  currency: string;
  status: "active" | "completed" | "archived";
  archived: boolean;
};

export const purchaseListSchema: ItemTypeSchema<PurchaseListRow> = {
  id: "purchase_list",
  summary: {
    primary: "title",
    secondary: "store",
    metrics: [
      { label: "الميزانية", from: "budget", format: "money" },
      { label: "العملة", from: "currency", format: "tag" },
    ],
  },
  stats: [
    { key: "total", label: "إجمالي القوائم", tone: "primary",
      compute: (rows) => ({ value: rows.length }) },
    { key: "active", label: "نشطة", tone: "success",
      compute: (rows) => ({ value: rows.filter((r) => r.status === "active").length }) },
    { key: "budget", label: "إجمالي الميزانيات", tone: "accent",
      compute: (rows) => {
        const sum = rows.reduce((a, r) => a + (r.budget || 0), 0);
        return { value: formatCurrency(sum, rows[0]?.currency ?? "SAR") };
      } },
  ],
  fields: [
    { name: "title", label: "اسم القائمة", type: "text", required: true,
      order: 1, group: "basics", placeholder: "مثلاً: مشتريات الأسبوع" },
    { name: "description", label: "ملاحظات", type: "textarea",
      order: 2, group: "basics" },
    { name: "store", label: "المتجر", type: "text", width: 2, order: 3, group: "details",
      placeholder: "اسم المتجر (اختياري)" },
    { name: "budget", label: "الميزانية", type: "money", width: 2, order: 4, group: "details",
      validation: { min: 0 } },
    { name: "currency", label: "العملة", type: "select", defaultValue: "SAR",
      width: 2, order: 5, group: "details",
      options: [
        { value: "SAR", label: "ريال سعودي" },
        { value: "AED", label: "درهم إماراتي" },
        { value: "EGP", label: "جنيه مصري" },
        { value: "USD", label: "دولار" },
        { value: "EUR", label: "يورو" },
      ],
    },
    { name: "status", label: "الحالة", type: "select", defaultValue: "active",
      width: 2, order: 6, group: "details",
      options: [
        { value: "active", label: "نشطة" },
        { value: "completed", label: "مكتملة" },
        { value: "archived", label: "مؤرشفة" },
      ],
    },
  ],
  layout: [
    { kind: "section", key: "basics", title: "الأساسيات",
      fields: ["title", "description"], columns: 1 },
    { kind: "section", key: "details", title: "التفاصيل",
      fields: ["store", "budget", "currency", "status"], columns: 2 },
  ],
};

export function purchaseValuesToInput(v: Record<string, unknown>) {
  const budget = v.budget === "" || v.budget == null ? null : Number(v.budget);
  return {
    title: String(v.title || "").trim(),
    description: (v.description as string) || null,
    store: (v.store as string) || null,
    budget,
    currency: (v.currency as string) || "SAR",
    status: (v.status as "active" | "completed" | "archived") || "active",
  };
}