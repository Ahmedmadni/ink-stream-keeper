
# المرحلة 6 — Product Polish & Mobile Optimization

نطاق كبير جداً لتنفيذه دفعة واحدة دون كسر ميزات موجودة. سأقسّمه إلى **4 موجات متتابعة**، كل موجة تُسلَّم مع تقرير مصغّر، ثم ننتقل للتي بعدها.

## Wave 6.1 — Design System Unification + Responsive Baseline
- إنشاء `src/lib/design-tokens.ts` + مراجعة `styles.css`:
  - توحيد `spacing`, `radius`, `shadow`, `typography scale`, `focus ring`, `hover`, `transitions`.
  - Semantic tokens فقط — إزالة أي `bg-white/text-black/#hex` من المكونات.
- توحيد Primitives:
  - `PageHeader`, `EmptyState`, `LoadingState`, `ErrorState`, `SuccessToast`, `SkeletonList`, `SectionCard` — استخراج من التكرار الحالي.
  - `AppShell`: safe-area (`env(safe-area-inset-*)`)، bottom nav 44×44 دنيا، حالة active أوضح.
- Responsive audit على 320 / 360 / 390 / 412 / 768 / 1024 / 1280 / 1600:
  - تطبيق قاعدة `grid-cols-[minmax(0,1fr)_auto] + min-w-0 + shrink-0 + truncate` على كل الرؤوس.
  - إزالة `h-screen` لصالح `h-dvh`، ومنع أي `overflow-x`.
- Tablet layout (≥768):
  - إضافة `AppShellResponsive`: sidebar عمودي على التابلت + master/detail لـ Notes / Tasks / Plans / Purchases / Workspaces عبر مكوّن `SplitView` جديد.

## Wave 6.2 — Detail Pages Migration + Animations + A11y
- تحويل صفحات التفاصيل (`notes.$id`, `tasks.$id`, `purchases.$id`, `plans.$id`) لاستخدام:
  - `DynamicHeader`, `DynamicSummaryCard`, `DynamicDetail`, `DynamicAttachments`, `DynamicComments`, `DynamicTimeline`
  - مع الحفاظ 100% على السلوك الحالي (checklist, subtasks, stages, price fields, RichEditor للملاحظات).
- Animations خفيفة:
  - `PageTransition` عبر `framer-motion` (fade+slide 200ms).
  - `animate-fade-in` / `animate-scale-in` على البطاقات والحوارات.
  - FAB micro-interaction، Accordion smooth، Pull-to-refresh على القوائم الرئيسية.
- Accessibility:
  - `aria-label` لكل زر أيقونة، `<main>` واحد لكل صفحة، `focus-visible` موحّد.
  - فحص التباين، دعم Keyboard Nav على البطاقات القابلة للفتح.
  - `lang="ar" dir="rtl"` (موجود) + دعم LTR داخل حقول تحتاجها (URLs، أرقام).

## Wave 6.3 — Performance + Offline + Monitoring + Security
- Performance:
  - `React.lazy` + `Suspense` لصفحات الثقيلة (RichEditor, DrawingCanvas, Calendar, TipTap).
  - `useMemo`/`memo` للقوائم الطويلة، virtualization في Notes/Tasks/Purchase items (موجود جزئياً).
  - مراجعة React Query: `staleTime`, `select`, تقليل استعلامات المشتقات.
- Offline (optimistic):
  - إضافة `onMutate` optimistic updates + rollback لكل الميوتيشنز الحرجة (toggle task, update note, checklist).
  - رسالة توست عند فقدان الاتصال مع إعادة محاولة تلقائية عبر React Query retry.
- Monitoring:
  - `ErrorBoundary` عام + توسعة `lovable-error-reporting` لتغطية server functions.
  - `src/lib/logger.ts` مع مستويات ومصدر تقارير مستقبلي.
- Security:
  - تشغيل `security--run_security_scan` ومعالجة النتائج.
  - مراجعة سياسات RLS والـ GRANTs عبر migrations إذا لزم.
  - تحقق مدخلات Zod على كل server function، حدود حجم رفع في `note-attachments`.

## Wave 6.4 — Mobile App Readiness + Ads Slot + Cleanup + Report
- Capacitor readiness (بدون تنفيذ التحويل):
  - `src/lib/platform.ts`: كشف بيئة (web/ios/android) + واجهات موحّدة لـ Camera, Gallery, FilePicker, Share, Storage, LocalNotifications، مع تطبيق Web fallback الآن.
  - Safe-area utilities، viewport-fit=cover (موجود)، Splash/Icons متحقق منها.
  - Deep-link map: توثيق مسارات `/notes/:id`, `/tasks/:id`, `/plans/:id`, `/workspaces/:id` كـ Universal Links جاهزة.
  - `permissions.ts` طبقة تجريد.
- Ads architecture:
  - `<AdSlot placement="..." />` مكوّن يقرأ من `settings.ads_enabled` ولا يعرض شيئاً حالياً.
  - أماكن مخصّصة: Home bottom, Notes list footer, Tasks between-days، Vault معطّل دائماً.
  - إعداد في `settings.tsx` لتفعيل/تعطيل مستقبلاً.
- Cleanup:
  - إزالة imports/hooks/مكونات غير مستخدمة، توحيد أسماء ملفات، تنظيف routeTree.
- Final Report:
  - جودة المنتج، الأداء، تجربة الهاتف/التابلت، جاهزية Android/iOS/النشر، وقائمة blockers متبقية.

## قيود صارمة
- لا Features جديدة، لا أنواع بيانات جديدة، لا Refactors تكسر عقد الخدمات الحالية.
- كل موجة قابلة للنشر بشكل مستقل.
- التحقق بعد كل موجة عبر: build، سكرين‌شوت Playwright على 360/768/1280، وسكان أمني في Wave 6.3.

## أسئلة قبل البدء
1. هل نبدأ بـ **Wave 6.1** الآن؟ أم تفضّل تغيير الترتيب (مثلاً البدء بـ 6.3 Performance/Security)؟
2. هل تريد `framer-motion` للـ animations (إضافة تبعية ~30KB gz) أم الاكتفاء بـ Tailwind keyframes الموجودة؟
3. تصميم التابلت: **Sidebar + Split View** أم **Bottom nav مع master/detail عريض** فقط؟
