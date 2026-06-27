import type { ItemTypeSchema } from "../types";
import type { Task } from "@/lib/data";

/**
 * Task — described as a Schema so DynamicForm/Detail can render it.
 * Matches the columns the existing useAddTask/useUpdateTask hooks accept,
 * so we can stay 100% backward compatible.
 */
export const taskSchema: ItemTypeSchema<Task> = {
  id: "task",
  summary: {
    primary: "title",
    secondary: "description",
    doneField: "done",
    progressField: "progress",
    metrics: [
      { label: "موعد", from: "due_at", format: "date" },
      { label: "أولوية", from: "priority", format: "tag" },
    ],
  },
  stats: [
    {
      key: "total", label: "إجمالي المهام", tone: "primary",
      compute: (rows) => ({ value: rows.length }),
    },
    {
      key: "done", label: "المكتملة", tone: "success",
      compute: (rows) => ({ value: rows.filter((r) => r.done).length }),
    },
    {
      key: "high", label: "ذات أولوية عالية", tone: "destructive",
      compute: (rows) => ({ value: rows.filter((r) => r.priority === "high" && !r.done).length }),
    },
    {
      key: "today", label: "اليوم", tone: "warning",
      compute: (rows) => {
        const t = new Date(); t.setHours(0,0,0,0);
        const end = new Date(t); end.setDate(end.getDate()+1);
        const n = rows.filter((r) => r.due_at && new Date(r.due_at) >= t && new Date(r.due_at) < end).length;
        return { value: n };
      },
    },
  ],
  fields: [
    { name: "title", label: "العنوان", type: "text", required: true,
      placeholder: "اكتب عنوان المهمة...", order: 1, group: "basics" },

    { name: "description", label: "الوصف", type: "textarea",
      placeholder: "تفاصيل إضافية (اختياري)", order: 2, group: "basics" },

    { name: "priority", label: "الأولوية", type: "select", required: true,
      defaultValue: "med", width: 2, order: 3, group: "meta",
      options: [
        { value: "low", label: "منخفضة" },
        { value: "med", label: "متوسطة" },
        { value: "high", label: "عالية" },
      ],
    },
    { name: "status", label: "الحالة", type: "select",
      defaultValue: "todo", width: 2, order: 4, group: "meta",
      options: [
        { value: "todo", label: "قيد الانتظار" },
        { value: "in_progress", label: "جارية" },
        { value: "blocked", label: "متوقفة" },
        { value: "done", label: "منتهية" },
      ],
    },

    { name: "date", label: "التاريخ", type: "date", width: 2, order: 5, group: "schedule" },
    { name: "time", label: "الوقت", type: "time", width: 2, order: 6, group: "schedule" },
    { name: "recurrence", label: "التكرار", type: "select", defaultValue: "none",
      width: 2, order: 7, group: "schedule",
      options: [
        { value: "none", label: "بدون" },
        { value: "daily", label: "يوميًا" },
        { value: "weekly", label: "أسبوعيًا" },
        { value: "monthly", label: "شهريًا" },
      ],
    },
    { name: "reminderOffset", label: "تذكير قبل (دقيقة)", type: "select", defaultValue: "none",
      width: 2, order: 8, group: "schedule",
      visibleWhen: { field: "time", truthy: true },
      options: [
        { value: "none", label: "بدون" },
        { value: "0", label: "عند الموعد" },
        { value: "5", label: "5 دقائق" },
        { value: "15", label: "15 دقيقة" },
        { value: "30", label: "30 دقيقة" },
        { value: "60", label: "ساعة" },
        { value: "1440", label: "يوم" },
      ],
    },

    { name: "progress", label: "نسبة الإنجاز", type: "progress",
      defaultValue: 0, order: 9, group: "tracking",
      validation: { min: 0, max: 100 },
    },
    { name: "tags", label: "وسوم", type: "tags", order: 10, group: "tracking",
      help: "اضغط Enter بعد كل وسم" },
  ],
  layout: [
    { kind: "section", key: "basics", title: "الأساسيات",
      fields: ["title", "description"], columns: 1 },
    { kind: "section", key: "meta", title: "التصنيف",
      fields: ["priority", "status"], columns: 2 },
    { kind: "section", key: "schedule", title: "الجدولة",
      fields: ["date", "time", "recurrence", "reminderOffset"], columns: 2 },
    { kind: "section", key: "tracking", title: "التتبع",
      fields: ["progress", "tags"], columns: 1 },
  ],
};

/** Map dynamic-form values → useAddTask input shape (keeps legacy hooks intact). */
export function taskValuesToInput(v: Record<string, unknown>) {
  const date = (v.date as string) || "";
  const time = (v.time as string) || "";
  let due_at: string | null = null;
  let reminder_at: string | null = null;
  if (date && time) {
    const [y, mo, dd] = date.split("-").map(Number);
    const [h, m] = time.split(":").map(Number);
    const d = new Date(y, mo - 1, dd, h, m, 0, 0);
    due_at = d.toISOString();
    const off = v.reminderOffset as string;
    if (off && off !== "none") {
      reminder_at = new Date(d.getTime() - Number(off) * 60_000).toISOString();
    }
  } else if (date) {
    const [y, mo, dd] = date.split("-").map(Number);
    due_at = new Date(y, mo - 1, dd, 23, 59, 0, 0).toISOString();
  }
  return {
    title: String(v.title || "").trim(),
    due_at, reminder_at,
    priority: (v.priority as "low" | "med" | "high") || "med",
    recurrence: (v.recurrence as "none" | "daily" | "weekly" | "monthly") || "none",
  };
}