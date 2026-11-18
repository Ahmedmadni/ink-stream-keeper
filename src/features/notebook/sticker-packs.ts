import type { ComponentType } from "react";
import {
  Stethoscope, HeartPulse, Pill, Microscope, FlaskConical, Dna, Atom,
  BookOpen, GraduationCap, Lightbulb, PencilRuler, Calculator, ChartNoAxesCombined,
  Wallet, Receipt, Landmark, Coins, CircleCheckBig, CalendarCheck, NotebookPen,
  Star, Target, Brain, Bone, Syringe, Thermometer, Hospital, Bandage, ScanEye, Ear, FileSpreadsheet, Scale, PiggyBank, CreditCard, BriefcaseBusiness, BadgeDollarSign, HandCoins, ChartPie, TrendingDown, CircleDollarSign, StickyNote, AlarmClock, Bookmark, Flag, ListChecks, NotebookTabs, BookMarked, Presentation, ClipboardList, Ruler,
} from "lucide-react";
import { FLUENT_ART, FLUENT_ITEMS } from "./fluent-art";
import { SCIENCE_ART, SCIENCE_ITEMS } from "./science-art";
import type { PageSticker } from "./model";

/** Curated from the already-installed Lucide library (ISC + Feather MIT).
 * No artwork is scraped, linked at runtime or copied from stock websites. */
export const STICKER_GROUPS = [
  { id: "fluent", label: "ملصقات ملونة", items: FLUENT_ITEMS },
  {
    id: "medical", label: "طب وعلوم",
    items: [
      ["brain", "دماغ"],
      ["bone", "عظام"],
      ["syringe", "حقنة"],
      ["thermometer", "ميزان حرارة"],
      ["hospital", "مستشفى"],
      ["bandage", "ضمادة"],
      ["scan-eye", "فحص العين"],
      ["ear", "أذن"],

      ["stethoscope", "سماعة طبية"], ["heart-pulse", "قلب ونبض"],
      ["pill", "علاج"], ["microscope", "مجهر"], ["flask-conical", "أنبوب مختبر"],
      ["dna", "حمض نووي"], ["atom", "ذرة"],
    ],
  },
  {
    id: "accounting", label: "محاسبة وأعمال",
    items: [
      ["file-spreadsheet", "كشف حساب"],
      ["scale", "ميزان الحسابات"],
      ["piggy-bank", "ادخار"],
      ["credit-card", "بطاقة ائتمان"],
      ["briefcase-business", "أعمال"],
      ["badge-dollar-sign", "عملة"],
      ["hand-coins", "تحصيل"],
      ["chart-pie", "توزيع التكاليف"],
      ["trending-down", "انخفاض"],
      ["circle-dollar-sign", "مبلغ مالي"],

      ["calculator", "آلة حاسبة"], ["chart-no-axes-combined", "نمو"],
      ["wallet", "محفظة"], ["receipt", "فاتورة"], ["landmark", "بنك"],
      ["coins", "نقود"],
    ],
  },
  {
    id: "study", label: "دراسة وتنظيم",
    items: [
      ["sticky-note", "ورقة تذكير"],
      ["alarm-clock", "وقت المذاكرة"],
      ["bookmark", "علامة مرجعية"],
      ["flag", "علامة مهمة"],
      ["list-checks", "قائمة مراجعة"],
      ["notebook-tabs", "فواصل الدفتر"],
      ["book-marked", "مرجع دراسي"],
      ["presentation", "شرح الدرس"],
      ["clipboard-list", "خطة الدراسة"],
      ["ruler", "مسطرة"],

      ["book-open", "كتاب"], ["graduation-cap", "تعلم"], ["lightbulb", "فكرة"],
      ["pencil-ruler", "أدوات"], ["circle-check-big", "إنجاز"],
      ["calendar-check", "موعد"], ["notebook-pen", "مذكرة"],
      ["star", "مميز"], ["target", "هدف"],
    ],
  },
  { id: "science", label: "رسومات علمية", items: SCIENCE_ITEMS },
] as const;

const ICONS: Record<PageSticker["kind"], ComponentType<{ size?: number | string; strokeWidth?: number; color?: string; className?: string }>> = {
  "stethoscope": Stethoscope,
  "heart-pulse": HeartPulse,
  "pill": Pill,
  "microscope": Microscope,
  "flask-conical": FlaskConical,
  "dna": Dna,
  "atom": Atom,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  "lightbulb": Lightbulb,
  "pencil-ruler": PencilRuler,
  "calculator": Calculator,
  "chart-no-axes-combined": ChartNoAxesCombined,
  "wallet": Wallet,
  "receipt": Receipt,
  "landmark": Landmark,
  "coins": Coins,
  "circle-check-big": CircleCheckBig,
  "calendar-check": CalendarCheck,
  "notebook-pen": NotebookPen,
  "star": Star,
  "target": Target,
  "brain": Brain,
  "bone": Bone,
  "syringe": Syringe,
  "thermometer": Thermometer,
  "hospital": Hospital,
  "bandage": Bandage,
  "scan-eye": ScanEye,
  "ear": Ear,
  "file-spreadsheet": FileSpreadsheet,
  "scale": Scale,
  "piggy-bank": PiggyBank,
  "credit-card": CreditCard,
  "briefcase-business": BriefcaseBusiness,
  "badge-dollar-sign": BadgeDollarSign,
  "hand-coins": HandCoins,
  "chart-pie": ChartPie,
  "trending-down": TrendingDown,
  "circle-dollar-sign": CircleDollarSign,
  "sticky-note": StickyNote,
  "alarm-clock": AlarmClock,
  "bookmark": Bookmark,
  "flag": Flag,
  "list-checks": ListChecks,
  "notebook-tabs": NotebookTabs,
  "book-marked": BookMarked,
  "presentation": Presentation,
  "clipboard-list": ClipboardList,
  "ruler": Ruler,
  ...SCIENCE_ART,
  ...FLUENT_ART,
};
export function stickerIcon(kind: PageSticker["kind"]) {
  return ICONS[kind];
}
export function stickerLabel(kind: PageSticker["kind"]): string {
  for (const group of STICKER_GROUPS) {
    const found = group.items.find(([key]) => key === kind);
    if (found) return found[1];
  }
  return kind;
}

export function searchStickers(query: string, groupId: string) {
  const text = query.trim().toLocaleLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه");
  return STICKER_GROUPS.filter((g) => !text ? g.id === groupId : true).flatMap<readonly [PageSticker["kind"], string]>((g) => g.items)
    .filter(([kind, label]) => !text || (kind + " " + label).toLocaleLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").includes(text));
}
