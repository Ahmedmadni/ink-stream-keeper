
# المرحلة 3 — Dynamic Item Engine

الهدف: بناء محرك واحد يقرأ Schema لكل نوع ويولّد تلقائياً: نموذج الإنشاء، عرض التفاصيل، بطاقات القائمة، وقواعد التحقق — بحيث لا يحتاج أي نوع جديد (Learning / Goal / Project / Travel / Maintenance) إلى صفحات مخصصة.

تنفيذ **تدريجي وغير كاسر** — كل ملفات Task و Purchase List الحالية تبقى تعمل كما هي. المحرك يُبنى بجانبها ثم نحوّل أجزاء محددة فقط.

## البنية المقترحة

```text
src/lib/engine/
  types.ts              # FieldType, FieldSchema, ItemTypeSchema, LayoutNode
  registry.ts           # تسجيل الـ schemas لكل ItemTypeKey
  validation.ts         # محرك تحقق مبني على Zod من Schema
  schemas/
    task.schema.ts      # تعريف Task بصيغة Schema (مع التوافق الحالي)
    purchase.schema.ts  # تعريف Purchase List
    purchase-item.schema.ts

src/components/dynamic/
  DynamicField.tsx       # يرسم حقلاً واحداً حسب type
  DynamicSection.tsx     # عنوان + وصف + محتوى
  DynamicForm.tsx        # Renderer كامل (Sections/Grid/Tabs/Accordion)
  DynamicHeader.tsx      # رأس صفحة التفاصيل (أيقونة/لون/حالة)
  DynamicStatistics.tsx  # شريط KPI من تعريف الإحصائيات
  DynamicDetail.tsx      # عرض القراءة للحقول
  DynamicSummaryCard.tsx # بطاقة عنصر في القائمة
  DynamicAttachments.tsx # موحّد عبر item_attachments
  DynamicChecklist.tsx   # يلفّ EditableChecklistRow الحالي
  DynamicComments.tsx    # عبر item_comments
  DynamicTimeline.tsx    # مراحل/تواريخ
  DynamicGallery.tsx     # صور متعددة
  fields/                # محرّرات الحقول (Text, Money, Date, Tags, …)
```

## أنواع الحقول المدعومة في v1

text, textarea, rich_text, number, money, date, time, date_range, select, multi_select, checkbox, radio, tags, url, email, phone, image, gallery, attachment, checklist, subtasks, progress, rating, color, icon, duration, currency.
(location/barcode تُسجَّل في الـtypes لكن تُرسم لاحقاً — لا تكسر شيئاً.)

كل حقل في Schema:
`{ name, label, type, required?, defaultValue?, placeholder?, options?, validation?, visibleWhen?, group?, width?, order?, help? }`.

## محركات فرعية

- **Validation Engine**: يبني schema Zod من الـFieldSchema (required/min/max/regex/email/url/range)، ويطبّق `visibleWhen` قبل التحقق.
- **Layout Engine**: عقد `section | card | tabs | accordion | grid` مع `columns: 1|2|3|4` وعرض responsive.
- **Form Renderer**: يأخذ `ItemTypeSchema + initialValues + onSubmit`، يبني RHF + zodResolver تلقائياً.
- **Detail Renderer**: نفس الـschema لكن قراءة فقط مع تنسيق حسب النوع (Money → عملة، Date → تاريخ عربي، Tags → Badges…).
- **Summary Renderer**: يقرأ `list.primary / secondary / metrics` من الـschema لرسم بطاقات موحّدة.

## التحويل التدريجي (بدون كسر)

1. **Task**: إضافة زر "إضافة عبر النموذج الديناميكي" داخل `tasks.$id.tsx` و`create.tsx` يستخدم `DynamicForm` فوق نفس hooks (`useAddTask`/`useUpdateTask`). الكود القديم يبقى كـfallback.
2. **Purchase List**: `purchases.tsx` إنشاء قائمة جديدة عبر `DynamicForm`. `purchase_items` تكتسب `DynamicChecklist` كغلاف فوق `EditableChecklistRow`.
3. **Attachments/Comments**: مكوّنات `DynamicAttachments` و`DynamicComments` تستخدم جداول `item_attachments`/`item_comments` الموجودة فعلاً — تصبح متاحة لأي نوع لاحق.

> لن نُعيد كتابة `tasks.$id.tsx` أو `purchases.$id.tsx` بالكامل في هذه المرحلة. نضيف "نقاط حقن" ديناميكية فقط.

## إضافة نوع جديد لاحقاً = 4 خطوات فقط

1. أضف ItemType في `item-types.ts` (موجود).
2. أضف ملف `schemas/<type>.schema.ts`.
3. عرّف الإحصائيات (دالة `computeStats(items)`).
4. أنشئ route بسيطين `list` و`$id` يستدعيان `<DynamicForm/>` و`<DynamicDetail/>`.

## ما لن يتغيّر في هذه المرحلة

- لا تعديلات على قاعدة البيانات.
- لا تغيير على `data.ts`/`purchases.ts` العامة (فقط إضافات صغيرة عند اللزوم).
- لا حذف لأي مكوّن حالي (`SummaryCard`, `ProgressCard`, `StatisticsCard`, `EditableChecklistRow`) — المكونات الديناميكية تلفّها.

## تقرير نهاية المرحلة (سيتم تسليمه)

- عدد الـschemas المُعرّفة.
- عدد مكونات `Dynamic*` القابلة لإعادة الاستخدام.
- ما تم تحويله فعلياً في Task و Purchase List.
- ما تبقّى للتحويل اللاحق (مثلاً Calendar view للمهام، صفحة Detail الكاملة).
- جاهزية إضافة Learning Plan في خطوة واحدة (Schema فقط).

هل أبدأ التنفيذ؟
