import type { Task, TaskSubItemSummary } from "@/lib/data";
import { compareTaskChecklistItems } from "./task-rules";
import type { DesktopFloatingTask } from "@/services/desktop";

export function desktopTaskSnapshot(task: Task, summary?: TaskSubItemSummary): DesktopFloatingTask {
  return {
    kind: "task",
    id: task.id,
    userId: task.user_id,
    title: task.title || "مهمة",
    text: task.description || "",
    done: task.done,
    items: [...(summary?.items ?? [])]
      .sort(compareTaskChecklistItems)
      .map(({ id, title, done }) => ({
        id,
        title,
        done,
      })),
    updatedAt: task.updated_at,
    dark: typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  };
}
