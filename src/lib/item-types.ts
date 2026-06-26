/**
 * Item Types Framework
 * ---------------------------------------------------------------
 * A unified registry describing every "item type" the app supports
 * (notes, tasks, purchase_lists, and future: learning_plans, goals,
 * projects, travel, maintenance...).
 *
 * Each ItemType plugs into the same shared UI primitives:
 *  - SummaryCard, ProgressCard, StatisticsCard, EditableChecklistRow
 *  - unified item_attachments / item_comments tables (already exist)
 *
 * To add a new type later you only need to:
 *   1) Add a row to ITEM_TYPES below
 *   2) Provide data hooks following the (useList / useOne / useStats) shape
 *   3) Mount a list/detail route — UI primitives are reused as-is.
 */
import type { ComponentType } from "react";
import {
  NotebookPen, CheckSquare, ShoppingCart, GraduationCap, Target,
  Plane, Wrench, FolderKanban,
} from "lucide-react";

export type ItemTypeKey =
  | "note"
  | "task"
  | "purchase_list"
  | "learning_plan"
  | "goal"
  | "project"
  | "travel"
  | "maintenance";

export type ItemTypeDef = {
  key: ItemTypeKey;
  /** Arabic display label */
  label: string;
  /** Short Arabic description shown in pickers. */
  description: string;
  icon: ComponentType<{ className?: string }>;
  /** Route path for the list view. */
  listPath: string;
  /** Builds the detail route path. */
  detailPath: (id: string) => string;
  /** Default tone used by shared UI cards. */
  tone: "primary" | "success" | "warning" | "destructive" | "accent";
  /** Whether the type is implemented and reachable today. */
  enabled: boolean;
};

export const ITEM_TYPES: Record<ItemTypeKey, ItemTypeDef> = {
  note: {
    key: "note", label: "ملاحظة", description: "نص حر مع تنسيق",
    icon: NotebookPen, listPath: "/notes",
    detailPath: (id) => `/notes/${id}`, tone: "primary", enabled: true,
  },
  task: {
    key: "task", label: "مهمة", description: "مع وقت وأولوية",
    icon: CheckSquare, listPath: "/tasks",
    detailPath: (id) => `/tasks/${id}`, tone: "primary", enabled: true,
  },
  purchase_list: {
    key: "purchase_list", label: "قائمة مشتريات",
    description: "ميزانية وعناصر ومتاجر",
    icon: ShoppingCart, listPath: "/purchases",
    detailPath: (id) => `/purchases/${id}`, tone: "success", enabled: true,
  },
  learning_plan: {
    key: "learning_plan", label: "خطة تعلم",
    description: "دروس وتتبع التقدم",
    icon: GraduationCap, listPath: "/learning",
    detailPath: (id) => `/learning/${id}`, tone: "warning", enabled: false,
  },
  goal: {
    key: "goal", label: "هدف",
    description: "أهداف ومراحل تنفيذ",
    icon: Target, listPath: "/goals",
    detailPath: (id) => `/goals/${id}`, tone: "destructive", enabled: false,
  },
  project: {
    key: "project", label: "مشروع", description: "مهام ومخرجات",
    icon: FolderKanban, listPath: "/projects",
    detailPath: (id) => `/projects/${id}`, tone: "primary", enabled: false,
  },
  travel: {
    key: "travel", label: "رحلة", description: "تخطيط ووجهات",
    icon: Plane, listPath: "/travel",
    detailPath: (id) => `/travel/${id}`, tone: "accent", enabled: false,
  },
  maintenance: {
    key: "maintenance", label: "صيانة",
    description: "جدولة وأعمال دورية",
    icon: Wrench, listPath: "/maintenance",
    detailPath: (id) => `/maintenance/${id}`, tone: "warning", enabled: false,
  },
};

/** Common shape every item type produces for the dashboard stats grid. */
export type ItemStats = {
  total: number;
  done: number;
  progress: number; // 0..100
};

export function formatCurrency(value: number, currency = "SAR"): string {
  try {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency", currency, maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return `${(value || 0).toFixed(2)} ${currency}`;
  }
}