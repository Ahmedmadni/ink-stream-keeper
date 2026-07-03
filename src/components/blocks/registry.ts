import { lazy } from "react";
import { registerBlock } from "@/lib/engine/blocks";
import { HeaderBlock } from "./blocks/HeaderBlock";
import { StatisticsBlock } from "./blocks/StatisticsBlock";
import { ProgressBlock } from "./blocks/ProgressBlock";
import { PropertiesBlock } from "./blocks/PropertiesBlock";
import { RichTextBlock } from "./blocks/RichTextBlock";
import { TagsBlock } from "./blocks/TagsBlock";
import { LinksBlock } from "./blocks/LinksBlock";
import { BudgetBlock } from "./blocks/BudgetBlock";
import { ChecklistBlock } from "./blocks/ChecklistBlock";
import { CalendarBlock } from "./blocks/CalendarBlock";
import { CustomBlock } from "./blocks/CustomBlock";

const TimelineBlock = lazy(() => import("./blocks/TimelineBlock").then((m) => ({ default: m.TimelineBlock })));
const GalleryBlock = lazy(() => import("./blocks/GalleryBlock").then((m) => ({ default: m.GalleryBlock })));
const AttachmentsBlock = lazy(() => import("./blocks/AttachmentsBlock").then((m) => ({ default: m.AttachmentsBlock })));
const CommentsBlock = lazy(() => import("./blocks/CommentsBlock").then((m) => ({ default: m.CommentsBlock })));
const RecentActivityBlock = lazy(() => import("./blocks/RecentActivityBlock").then((m) => ({ default: m.RecentActivityBlock })));
const RelatedItemsBlock = lazy(() => import("./blocks/RelatedItemsBlock").then((m) => ({ default: m.RelatedItemsBlock })));

let registered = false;
function ensureRegistered() {
  if (registered) return;
  registered = true;
  registerBlock("header", { component: HeaderBlock });
  registerBlock("statistics", { title: "الإحصائيات", component: StatisticsBlock });
  registerBlock("progress", { title: "التقدم", component: ProgressBlock });
  registerBlock("properties", { title: "الخصائص", component: PropertiesBlock });
  registerBlock("rich_text", { title: "الوصف", component: RichTextBlock });
  registerBlock("tags", { title: "الوسوم", component: TagsBlock });
  registerBlock("links", { title: "الروابط", component: LinksBlock });
  registerBlock("budget", { title: "الميزانية", component: BudgetBlock });
  registerBlock("checklist", { title: "قائمة البنود", component: ChecklistBlock });
  registerBlock("calendar", { title: "التقويم", component: CalendarBlock });
  registerBlock("custom", { component: CustomBlock });
  registerBlock("timeline", { title: "المسار الزمني", component: TimelineBlock, defaultLazy: true });
  registerBlock("gallery", { title: "المعرض", component: GalleryBlock, defaultLazy: true });
  registerBlock("attachments", { title: "المرفقات", component: AttachmentsBlock, defaultLazy: true });
  registerBlock("comments", { title: "التعليقات", component: CommentsBlock, defaultLazy: true });
  registerBlock("recent_activity", { title: "النشاط الأخير", component: RecentActivityBlock, defaultLazy: true });
  registerBlock("related_items", { title: "عناصر مرتبطة", component: RelatedItemsBlock, defaultLazy: true });
}

ensureRegistered();
export {};