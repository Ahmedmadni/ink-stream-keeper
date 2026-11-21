import { artwork } from "./science-art";
import art0 from "./assets/fluent/stethoscope.svg?raw";
import art1 from "./assets/fluent/syringe.svg?raw";
import art2 from "./assets/fluent/pill.svg?raw";
import art3 from "./assets/fluent/microscope.svg?raw";
import art4 from "./assets/fluent/abacus.svg?raw";
import art5 from "./assets/fluent/moneybag.svg?raw";
import art6 from "./assets/fluent/chart.svg?raw";
import art7 from "./assets/fluent/coins.svg?raw";
import art8 from "./assets/fluent/books.svg?raw";
import art9 from "./assets/fluent/graduation.svg?raw";
import art10 from "./assets/fluent/memo.svg?raw";
import art11 from "./assets/fluent/lightbulb.svg?raw";
export const FLUENT_ITEMS = [["fl-stethoscope", "سماعة ملونة"], ["fl-syringe", "حقنة ملونة"], ["fl-pill", "علاج ملون"], ["fl-microscope", "مجهر ملون"], ["fl-abacus", "عداد محاسبي"], ["fl-moneybag", "حقيبة نقود"], ["fl-chart", "رسم النمو"], ["fl-coins", "عملة ذهبية"], ["fl-books", "كتب ملونة"], ["fl-graduation", "قبعة تخرج"], ["fl-memo", "ورقة كتابة"], ["fl-lightbulb", "فكرة ملونة"]] as const;
export const FLUENT_ART = {
  "fl-stethoscope": artwork(art0),
  "fl-syringe": artwork(art1),
  "fl-pill": artwork(art2),
  "fl-microscope": artwork(art3),
  "fl-abacus": artwork(art4),
  "fl-moneybag": artwork(art5),
  "fl-chart": artwork(art6),
  "fl-coins": artwork(art7),
  "fl-books": artwork(art8),
  "fl-graduation": artwork(art9),
  "fl-memo": artwork(art10),
  "fl-lightbulb": artwork(art11),
};
