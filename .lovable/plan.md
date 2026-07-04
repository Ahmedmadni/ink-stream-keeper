
## Wave 6.2.c.2 — تنفيذ مرحلي مع Architecture Freeze

نظراً لحجم المرحلة (تحويل 3 صفحات كاملة + 6 blocks قابلة للتحرير + BlockContext + Toolbar + Inspector + Event Bus + تقرير أداء)، سيتم التنفيذ على 3 موجات فرعية متتالية داخل هذه المرحلة، مع الحفاظ الكامل على السلوك الحالي في كل خطوة.

### Sub-wave A — البنية التحتية (هذه الجلسة)

**BlockContext** (`src/lib/engine/block-context.tsx`)
- `BlockProvider` يمرّر: `item`, `schema?`, `permissions`, `mutations`, `workspace?`, `readonly`, `deviceType`, `selection`.
- `useBlockContext<T>()` بدون الحاجة لأي hook خاص بالنوع داخل الـ Block.

**Event Bus** (`src/lib/engine/block-events.ts`)
- Bus خفيف: `emit(event, payload)`, `on(event, cb)`, `useBlockEvent(event, cb)`.
- الأحداث المعيارية: `item:update`, `item:delete`, `checklist:toggle`, `tags:add`, `tags:remove`, `link:add`, `link:remove`, `field:save`.

**Common Actions** (`src/lib/engine/actions.ts`)
- `useItemActions(kind, id)` → `delete`, `duplicate`, `archive`, `favorite`, `share`, `export`, `move`.
- طبقة موحّدة تستدعي hooks الموجودة (`useDeleteTask`, `useUpdateTask`, ...).

**Toolbar** (`src/components/blocks/Toolbar.tsx`)
- شريط علوي موحّد: Edit / Undo / Redo / Share / Favorite / Archive / Delete.
- Undo/Redo عبر `useHistory` (in-memory stack) للحقول القابلة للتحرير.

**Inspector** (`src/components/blocks/Inspector.tsx`)
- لوحة جانبية (Sheet على الموبايل، Panel ثابت على md+) تعرض `PropertiesBlock` القابل للتحرير خارج تدفق الصفحة.

### Sub-wave B — Editable Blocks (هذه الجلسة)

استبدال 6 blocks بنسخ قابلة للتحرير عبر `readonly` flag في `BlockContext`:
1. `PropertiesBlock` → inline editors (select / date / text) عبر `field.editor` prop.
2. `ChecklistBlock` → add/edit/delete/toggle (يبعث `checklist:*` events).
3. `BudgetBlock` → inline number editors مع currency.
4. `RichTextBlock` → click-to-edit textarea + save on blur.
5. `TagsBlock` → add/remove chips.
6. `ProgressBlock` → slider inline.

### Sub-wave C — Migration (جلسة تالية بعد اعتماد A+B)

- `tasks.$id.tsx`, `purchases.$id.tsx`, `plans.$id.tsx` → كل واحدة تصبح ~40 سطر:
  ```
  <BlockProvider ...>
    <Toolbar />
    <BlockRenderer blocks={buildTaskBlocks(ctx)} context={ctx} />
  </BlockProvider>
  ```
- توسيع `task.blocks.ts` / `purchase.blocks.ts` / `plan.blocks.ts` لتغطية كل الأقسام الموجودة (checklist, subtasks, tags, links, category, subtasks كـ block منفصل).
- الصفحات القديمة تُحذف فقط بعد `tsgo` + فحص يدوي لكل مسار.

### ما لن يتغير (ضمان عدم الكسر)
- كل `use*` hooks في `src/lib/data.ts` / `src/lib/purchases.ts` / `src/lib/plans.ts`.
- كل الـ routes ومسارات الروابط.
- `DetailPanel.tsx` (يعمل حالياً على المحرك، سيستفيد تلقائياً من الـ Editable Blocks عبر `readonly: false`).

### Architecture Freeze (بعد C)
تجميد: Dynamic Engine, Block Engine, Planning Engine, Workspace Engine. أي ميزة لاحقة تُبنى فوقها فقط.

### تقرير نهاية المرحلة (بعد C)
- % الصفحات على Block Engine.
- % الكود المكرر المُزال (سطور قبل/بعد لـ `*.$id.tsx`).
- حجم الـ bundle قبل/بعد.
- عدد Editable Blocks.
- تقييم أداء (initial mount + navigation + memory).
- ديون تقنية متبقية.

---

**الطلب:** اعتماد هذا التقسيم للبدء بـ Sub-wave A + B في هذه الجلسة، ثم Sub-wave C في التالية.
