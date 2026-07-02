# Wave 6.2 — Premium Polish, Tablet Layout, Services Layer

نطاق Wave 6.2 ضخم جداً ولا يُنصح بتنفيذه في دفعة واحدة. سأقسّمه إلى **4 موجات فرعية** متسلسلة، وكل موجة تُنهى بتقرير مصغّر قبل الانتقال للتالية.

المبدأ العام (يُطبَّق في كل موجة):
- Framer Motion باعتدال، جميع الحركات ≤ 250ms
- احترام `prefers-reduced-motion` عبر hook مركزي `useMotionSafe()`
- لا تغيير في منطق الأعمال أو الـ Schemas — تحسينات UI/UX وطبقات فقط

---

## Wave 6.2.a — Service Layer + Motion Primitives (الأساس)

الهدف: بناء الطبقات التي ستستخدمها بقية الموجات.

1. **Service Layer** — `src/services/`
   - `haptics.ts` — Web Vibration API + interface جاهزة لـ Capacitor
   - `share.ts` — Web Share API + fallback نسخ
   - `notifications.ts` — Notification API (موجود جزئياً في use-task-reminders)
   - `storage.ts` — localStorage/IndexedDB wrapper
   - `camera.ts` — getUserMedia + input[file]
   - `biometric.ts` — WebAuthn interface (stub)
   - `files.ts` — File System Access API + fallback download
   - كل خدمة `interface + webImpl + export singleton` → تبديل Capacitor بسطر واحد

2. **Motion Primitives** — `src/components/motion/`
   - `MotionProvider` مع `useReducedMotion()`
   - `<PageFade>`, `<CardLift>`, `<SectionExpand>`, `<ScaleIn>` — كلها ≤ 220ms
   - `Ripple` component للأزرار الأساسية

3. **Feedback Upgrade**
   - `EmptyState` يقبل `illustration` prop (SVG بسيط لكل نوع)
   - `SkeletonList` variants لكل قائمة (Notes/Tasks/Purchases/Plans/Workspaces)

**تقرير 6.2.a**: قائمة الخدمات + عدد الحركات المضافة.

---

## Wave 6.2.b — Tablet Master/Detail Layout

الهدف: تجربة Tablet احترافية عند `md:` وأكبر.

1. **`AppShell` responsive**
   - Mobile (< md): يبقى كما هو (bottom nav)
   - Tablet (≥ md): 3 أعمدة
     - يسار: Navigation + Workspaces (280px)
     - وسط: List (المسار الحالي)
     - يمين: Detail Panel (يُملأ من selection state أو URL param)

2. **Selection state**
   - `useSelectedItem()` — يحفظ ID في URL search param `?panel=...`
   - Detail Panel يعرض `<DynamicDetail>` للعنصر المحدد
   - على الموبايل: نفس الرابط ينقل لصفحة detail كاملة (بدون تغيير)

3. **Transitions**
   - Fade خفيف عند تغيير Detail Panel
   - لا reload — كل التنقل client-side (موجود أصلاً)

**تقرير 6.2.b**: الصفحات المدعومة (Notes/Tasks/Purchases/Plans/Workspaces).

---

## Wave 6.2.c — Detail Migration + Slots

الهدف: توحيد صفحات التفاصيل على `DynamicDetail` مع الحفاظ على التخصيص.

1. **`DynamicDetail` v2 — Slots API**
   ```tsx
   <DynamicDetail schema={...} values={...}>
     <DynamicDetail.Header>...</DynamicDetail.Header>
     <DynamicDetail.Statistics>...</DynamicDetail.Statistics>
     <DynamicDetail.Timeline>...</DynamicDetail.Timeline>
     <DynamicDetail.Attachments>...</DynamicDetail.Attachments>
     <DynamicDetail.Comments>...</DynamicDetail.Comments>
     <DynamicDetail.Actions>...</DynamicDetail.Actions>
   </DynamicDetail>
   ```
   - Slots معرّفة كـ `React.Children` filter مع named components
   - Default rendering إذا لم يُوفَّر Slot

2. **Migration** (تدريجي، صفحة صفحة):
   - `tasks.$id.tsx` → DynamicDetail + slots
   - `purchases.$id.tsx` → DynamicDetail + slots
   - `plans.$id.tsx` → DynamicDetail + slots
   - **`notes.$id.tsx` استثناء**: يبقى بمحرر TipTap مخصص، فقط يستفيد من `<DynamicDetail.Attachments>` و `<DynamicDetail.Comments>` كمكونات مشتركة

**تقرير 6.2.c**: نسبة الصفحات المُوحَّدة + مكونات مشتركة جديدة.

---

## Wave 6.2.d — Micro-Interactions + A11y + Performance

1. **Micro-interactions**
   - Checkbox animation (spring)
   - Success burst (نجمة صغيرة عند إتمام مهمة)
   - Progress bar animate
   - Long-press feedback (haptic + ripple)
   - Hover elevation على cards (≥ md فقط)

2. **A11y — WCAG AA**
   - Audit ألوان `--muted-foreground` على `--card` (تباين ≥ 4.5:1)
   - `aria-label` لكل أيقونة تفاعلية
   - Focus rings موحّدة (`.focus-ring` موجودة — طبّقها)
   - `role="status"`/`aria-live` للتحديثات الديناميكية
   - اختبار keyboard navigation في القوائم الرئيسية

3. **Performance**
   - Route-based code splitting (تحقق من `autoCodeSplitting`)
   - `React.memo` لعناصر القوائم الثقيلة (NoteCard, TaskRow)
   - Image lazy loading + `loading="lazy"`
   - Prefetch on hover للـ Links الرئيسية (موجود عبر `defaultPreload`)

**تقرير 6.2.d نهائي (تقرير Wave 6.2 الكامل)**:
- % الصفحات على DynamicDetail
- عدد المكونات المشتركة
- تقييم Performance (bundle size, Lighthouse تقديري)
- تقييم Mobile/Tablet/A11y
- جاهزية Capacitor
- الديون التقنية المتبقية

---

## Technical Notes

- كل Framer Motion imports مُشرّطة بـ `useReducedMotion()` — ترجع `initial=false, animate=false` عند التفعيل
- Service Layer يُصدَّر singleton pattern: `import { haptics } from '@/services/haptics'`
- لن نضيف Capacitor نفسه الآن — فقط الـ interfaces
- لن يُلمس أي schema أو migration في هذه الموجة

## ما لن يُنفَّذ في Wave 6.2

- AdMob integration (يُؤجَّل لموجة نشر منفصلة)
- Capacitor build actual (يحتاج بيئة native)
- Split view drag-to-resize (يمكن إضافته لاحقاً)

---

هل أبدأ بـ **Wave 6.2.a (Service Layer + Motion)** الآن؟