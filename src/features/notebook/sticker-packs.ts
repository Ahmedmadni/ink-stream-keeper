import type { ComponentType } from "react";
import {
  Stethoscope, HeartPulse, Pill, Microscope, FlaskConical, Dna, Atom,
  BookOpen, GraduationCap, Lightbulb, PencilRuler, Calculator, ChartNoAxesCombined,
  Wallet, Receipt, Landmark, Coins, CircleCheckBig, CalendarCheck, NotebookPen,
  Star, Target,
} from "lucide-react";
import type { PageSticker } from "./model";

/** Curated from the already-installed Lucide library (ISC + Feather MIT).
 * No artwork is scraped, linked at runtime or copied from stock websites. */
export const STICKER_GROUPS = [
  {
    id: "medical", label: "طب وعلوم",
    items: [
      ["stethoscope", "سماعة طبية"], ["heart-pulse", "قلب ونبض"],
      ["pill", "علاج"], ["microscope", "مجهر"], ["flask-conical", "أنبوب مختبر"],
      ["dna", "حمض نووي"], ["atom", "ذرة"],
    ],
  },
  {
    id: "accounting", label: "محاسبة وأعمال",
    items: [
      ["calculator", "آلة حاسبة"], ["chart-no-axes-combined", "نمو"],
      ["wallet", "محفظة"], ["receipt", "فاتورة"], ["landmark", "بنك"],
      ["coins", "نقود"],
    ],
  },
  {
    id: "study", label: "دراسة وتنظيم",
    items: [
      ["book-open", "كتاب"], ["graduation-cap", "تعلم"], ["lightbulb", "فكرة"],
      ["pencil-ruler", "أدوات"], ["circle-check-big", "إنجاز"],
      ["calendar-check", "موعد"], ["notebook-pen", "مذكرة"],
      ["star", "مميز"], ["target", "هدف"],
    ],
  },
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
