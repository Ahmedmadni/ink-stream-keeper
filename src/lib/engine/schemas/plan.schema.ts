import type { FieldSchema, ItemTypeSchema, LayoutNode } from "../types";
import type { PlanType, Plan } from "@/lib/plans";

/**
 * Per-type extra fields. Stored inside plans.type_data JSONB.
 */
const TYPE_EXTRA: Record<PlanType, FieldSchema[]> = {
  goal: [
    { name: "reason",        label: "السبب",            type: "textarea", order: 50, group: "type" },
    { name: "target_result", label: "النتيجة المستهدفة", type: "text",     order: 51, group: "type" },
    { name: "target_value",  label: "القيمة المستهدفة",  type: "number",   order: 52, width: 2, group: "type" },
    { name: "current_value", label: "القيمة الحالية",    type: "number",   order: 53, width: 2, group: "type" },
    { name: "unit",          label: "وحدة القياس",       type: "text",     order: 54, width: 2, group: "type" },
  ],
  learning: [
    { name: "course_name",   label: "اسم الدورة",        type: "text",     order: 50, group: "type" },
    { name: "platform",      label: "المنصة",            type: "text",     order: 51, width: 2, group: "type" },
    { name: "instructor",    label: "المدرب",            type: "text",     order: 52, width: 2, group: "type" },
    { name: "course_url",    label: "الرابط",            type: "url",      order: 53, group: "type" },
    { name: "learning_mode", label: "طريقة التعلم",      type: "select",   order: 54, width: 2, group: "type",
      options: [
        { value: "video", label: "فيديو" }, { value: "live", label: "مباشر" },
        { value: "book",  label: "كتاب" },  { value: "workshop", label: "ورشة" },
        { value: "mixed", label: "متعدد" },
      ] },
    { name: "cost",          label: "التكلفة",           type: "money",    order: 55, width: 2, group: "type" },
    { name: "hours",         label: "عدد الساعات",       type: "number",   order: 56, width: 2, group: "type" },
    { name: "lessons",       label: "عدد الدروس",        type: "number",   order: 57, width: 2, group: "type" },
    { name: "certificate",   label: "شهادة عند الإنهاء", type: "switch",   order: 58, width: 2, group: "type" },
    { name: "difficulty",    label: "مستوى الصعوبة",     type: "select",   order: 59, width: 2, group: "type",
      options: [
        { value: "beginner", label: "مبتدئ" },
        { value: "intermediate", label: "متوسط" },
        { value: "advanced", label: "متقدم" },
      ] },
  ],
  project: [
    { name: "client",        label: "العميل",            type: "text",     order: 50, width: 2, group: "type" },
    { name: "team",          label: "الفريق",            type: "tags",     order: 51, width: 2, group: "type",
      help: "اضغط Enter بعد كل اسم" },
    { name: "risk",          label: "نسبة المخاطر",      type: "progress", order: 52, group: "type" },
  ],
  travel: [
    { name: "destination",   label: "الوجهة",            type: "text",     order: 50, width: 2, group: "type" },
    { name: "hotel",         label: "الفندق",            type: "text",     order: 51, width: 2, group: "type" },
    { name: "airline",       label: "شركة الطيران",      type: "text",     order: 52, width: 2, group: "type" },
    { name: "booking_ref",   label: "رقم الحجز",         type: "text",     order: 53, width: 2, group: "type" },
    { name: "packing",       label: "قائمة التجهيز",     type: "tags",     order: 54, group: "type" },
  ],
  maintenance: [
    { name: "asset",         label: "الأصل",             type: "text",     order: 50, width: 2, group: "type" },
    { name: "serial",        label: "الرقم التسلسلي",    type: "text",     order: 51, width: 2, group: "type" },
    { name: "last_service",  label: "آخر صيانة",         type: "date",     order: 52, width: 2, group: "type" },
    { name: "next_service",  label: "الصيانة القادمة",   type: "date",     order: 53, width: 2, group: "type" },
  ],
  roadmap: [
    { name: "milestones_count", label: "عدد المعالم",   type: "number",   order: 50, group: "type" },
  ],
  training: [
    { name: "sessions_per_week", label: "الجلسات أسبوعيًا", type: "number", order: 50, width: 2, group: "type" },
    { name: "intensity",       label: "الشدة",            type: "select",  order: 51, width: 2, group: "type",
      options: [{value:"low",label:"خفيفة"},{value:"med",label:"متوسطة"},{value:"high",label:"عالية"}] },
  ],
  career: [
    { name: "current_role",  label: "الوظيفة الحالية",   type: "text",     order: 50, width: 2, group: "type" },
    { name: "target_role",   label: "الوظيفة المستهدفة", type: "text",     order: 51, width: 2, group: "type" },
  ],
  business: [
    { name: "industry",      label: "القطاع",            type: "text",     order: 50, width: 2, group: "type" },
    { name: "revenue_target", label: "الإيرادات المستهدفة", type: "money", order: 51, width: 2, group: "type" },
  ],
};

const BASE_FIELDS: FieldSchema[] = [
  { name: "title", label: "العنوان", type: "text", required: true, order: 1, group: "basics" },
  { name: "description", label: "وصف مختصر", type: "textarea", order: 2, group: "basics" },
  { name: "objective", label: "الهدف الرئيسي", type: "textarea", order: 3, group: "basics",
    help: "ما الذي تريد تحقيقه؟ صياغة واضحة تساعد الذكاء الاصطناعي لاحقًا على اقتراح المراحل." },

  { name: "priority", label: "الأولوية", type: "select", defaultValue: "medium",
    width: 2, order: 10, group: "meta",
    options: [
      { value: "low",    label: "منخفضة" },
      { value: "medium", label: "متوسطة" },
      { value: "high",   label: "عالية" },
      { value: "urgent", label: "عاجلة" },
    ] },
  { name: "status", label: "الحالة", type: "select", defaultValue: "planning",
    width: 2, order: 11, group: "meta",
    options: [
      { value: "planning",  label: "تخطيط" },
      { value: "active",    label: "قيد التنفيذ" },
      { value: "on_hold",   label: "متوقفة" },
      { value: "done",      label: "منتهية" },
      { value: "cancelled", label: "ملغاة" },
    ] },

  { name: "start_date", label: "تاريخ البداية", type: "date", width: 2, order: 20, group: "schedule" },
  { name: "end_date",   label: "تاريخ النهاية", type: "date", width: 2, order: 21, group: "schedule" },
  { name: "estimated_duration", label: "المدة المقدّرة (أيام)", type: "number",
    width: 2, order: 22, group: "schedule" },

  { name: "budget",   label: "الميزانية",  type: "money",  width: 2, order: 30, group: "money" },
  { name: "currency", label: "العملة",     type: "select", width: 2, order: 31, group: "money",
    defaultValue: "SAR",
    options: [
      { value: "SAR", label: "ريال" }, { value: "USD", label: "دولار" },
      { value: "EUR", label: "يورو" }, { value: "AED", label: "درهم" },
    ] },

  { name: "tags",  label: "وسوم",       type: "tags",     order: 40, group: "extras" },
  { name: "notes", label: "ملاحظات إضافية", type: "textarea", order: 41, group: "extras" },
];

export function getPlanSchema(type: PlanType): ItemTypeSchema<Plan> {
  const extras = TYPE_EXTRA[type] ?? [];
  const extraNames = extras.map((f) => f.name);
  const layout: LayoutNode[] = [
    { kind: "section", key: "basics",   title: "الأساسيات", columns: 1,
      fields: ["title", "description", "objective"] },
    { kind: "section", key: "meta",     title: "التصنيف", columns: 2,
      fields: ["priority", "status"] },
    { kind: "section", key: "schedule", title: "الجدولة", columns: 2,
      fields: ["start_date", "end_date", "estimated_duration"] },
    { kind: "section", key: "money",    title: "الميزانية", columns: 2,
      fields: ["budget", "currency"] },
  ];
  if (extras.length) {
    layout.push({ kind: "section", key: "type", title: "تفاصيل خاصة بالنوع", columns: 2, fields: extraNames });
  }
  layout.push({ kind: "section", key: "extras", title: "إضافات", columns: 1, fields: ["tags", "notes"] });

  return {
    id: "plan" as unknown as ItemTypeSchema["id"],
    fields: [...BASE_FIELDS, ...extras],
    layout,
    summary: {
      primary: "title", secondary: "objective", progressField: "progress",
      metrics: [
        { label: "موعد", from: "end_date", format: "date" },
        { label: "أولوية", from: "priority", format: "tag" },
      ],
    },
    stats: [
      { key: "total", label: "إجمالي الخطط", tone: "primary",
        compute: (rows) => ({ value: rows.length }) },
      { key: "active", label: "النشطة", tone: "success",
        compute: (rows) => ({ value: rows.filter((r) => r.status === "active").length }) },
      { key: "done", label: "المكتملة", tone: "accent",
        compute: (rows) => ({ value: rows.filter((r) => r.status === "done").length }) },
      { key: "high", label: "أولوية عالية", tone: "destructive",
        compute: (rows) => ({ value: rows.filter((r) => r.priority === "high" || r.priority === "urgent").length }) },
    ],
  };
}

/**
 * Split a flat DynamicForm output into (columns, type_data).
 */
export function splitPlanValues(type: PlanType, values: Record<string, unknown>) {
  const baseNames = new Set(BASE_FIELDS.map((f) => f.name));
  const extras = TYPE_EXTRA[type] ?? [];
  const extraNames = new Set(extras.map((f) => f.name));
  const base: Record<string, unknown> = {};
  const type_data: Record<string, unknown> = {};
  for (const k of Object.keys(values)) {
    const v = values[k];
    if (extraNames.has(k)) {
      if (v !== "" && v !== null && v !== undefined) type_data[k] = v;
    } else if (baseNames.has(k)) {
      base[k] = v === "" ? null : v;
    }
  }
  // Normalise numeric fields to numbers
  for (const f of [...BASE_FIELDS, ...extras]) {
    const target = extraNames.has(f.name) ? type_data : base;
    if (target[f.name] == null || target[f.name] === "") continue;
    if (["number", "money", "currency", "progress", "duration"].includes(f.type)) {
      target[f.name] = Number(target[f.name]);
    }
  }
  return { base, type_data };
}