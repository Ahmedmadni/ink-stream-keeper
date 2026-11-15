# مراجعة مصادر ملصقات Notebook Studio

تاريخ الفحص: 15 نوفمبر 2026. هذه قرارات إدماج أصول بعينها في التطبيق، وليست تصريحًا عامًا لاستخدام كل ما في أي موقع.

| المصدر المقترح | ما تحقق منه | القرار الحالي |
| --- | --- | --- |
| Flaticon / science وaccounting | شروط الموقع وشروط إعادة التوزيع؛ وجود كلمة free لا يكفي لتضمين مكتبة أصول قابلة لإعادة الاستخدام داخل محرر | لم ينسخ أي أصل أو يستخدم اشتراكًا |
| SVG Repo / science | المكتبة تجمع تراخيص متنوعة؛ لكل أصل صفحة ترخيص، والترخيص الافتراضي له قيود إعادة توزيع | لم تستورد حزمة شاملة |
| SaraVieira/open-source-stickers | `License.md`: مجلد SaraVieira-stickers بـCC BY-NC 4.0 ومجلد gw-stickers بـCC BY 4.0 | لم يضم أي مجلد افتراضيًا، وبخاصة محتوى NC |
| continuous-foundation/scienceicons | MIT للمكتبة مع إحالات إلى تراخيص داخل بعض ملفات SVG؛ معظم فهرسها رموز نشر ومنصات علمية | لم تضاف كحزمة طبية أو محاسبية لأنها لا تغطي ذلك الغرض |
| Science-icons/Scicons | README يذكر المؤسسين والمصمم؛ لم تظهر رخصة صريحة في metadata أو ملف LICENSE | أرجئ الاستيراد حتى تحديد إذن الرسومات |
| SaveenaSolanki/SciSVG | `LICENSE-ASSETS` يخصص الرسومات لـCC BY 4.0، بينما MIT للكود فقط | أدرجت 20 SVG مع المصدر والنسبة وبصمة كل ملف، ودون تعديل فني |
| duerrsimon/bioicons | README يطلب مراجعة كل أصل ومؤلفه؛ توجد مجلدات CC0 وMIT وCC-BY وغيرها | لم يفترض أن MIT الخاص بالمستودع يرخّص كل الرسومات |
| themesberg/flowbite-illustrations | README وLICENSE يحددان MIT مع احتفاظ العلامات التجارية | مصدر صالح مرشح للرسوم التوضيحية، لم يحتج الدفتر لاستيرادها الآن |
| Iconpacks / accounting | شروط الاستخدام تسمح بالاستخدام ضمن المشاريع لكنها تقيد إعادة توزيع الأصول والتوزيع على الغير كما هي | لم ينسخ كتالوج محاسبي؛ وسعت مجموعة Lucide المحلية بدلًا منه |

## ما وزع فعليًا

- 50 ملصقًا خطيًا من Lucide المثبتة أصلًا (ISC مع إشعارات Feather MIT).
- 20 رسمًا من SciSVG — Saveena Solanki، CC BY 4.0؛ الإصدار `b8a2b60a3a5b2d9b717b1065fbcb8de9f1faf72b`. `src/features/notebook/assets/scisvg/manifest.json` يسجل اسم كل أصل ومساره وبصمة blob الأصلية، وتتحقق منها الاختبارات.
- ألوان SVG الأصلية محفوظة، وعرضه مصغرًا أو مدورًا مع عزل IDs أثناء التصيير. تظهر نسبة المؤلفة والترخيص في صفحات PDF التي تستعمل الرسم، وفي قارئ الخزنة وواجهة الدفتر.
- خط Aref Ruqaa من Google Fonts بترخيص SIL OFL 1.1؛ نسختا Regular وBold. بصمتا blob: `49e2c4e29ee2e24c4e36a8857f45a24d13d103f3` و`f5622cd3dbc6970f215cd451648500f9db9a582f`.
- نصوص الرخص موزعة داخل `public/licenses/` فتدخل حزم الويب وAndroid وElectron، ولا تقتصر على ملفات وثائق المستودع.

## المراجع

- https://www.flaticon.com/legal/
- https://www.svgrepo.com/page/licensing/
- https://github.com/SaraVieira/open-source-stickers/blob/master/License.md
- https://github.com/continuous-foundation/scienceicons/blob/main/README.md
- https://github.com/Science-icons/Scicons/blob/master/README.md
- https://github.com/SaveenaSolanki/SciSVG/blob/b8a2b60a3a5b2d9b717b1065fbcb8de9f1faf72b/LICENSE-ASSETS
- https://github.com/duerrsimon/bioicons/blob/main/README.md
- https://github.com/themesberg/flowbite-illustrations/blob/main/LICENSE
- https://www.iconpacks.net/terms/
- https://github.com/google/fonts/tree/main/ofl/arefruqaa
