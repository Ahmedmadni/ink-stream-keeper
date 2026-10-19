import { Search, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TaskFilter } from "./task-rules";

const filters: { key: TaskFilter; label: string }[] = [
  { key: "all", label: "غير المكتملة" },
  { key: "today", label: "اليوم" },
  { key: "upcoming", label: "القادمة" },
  { key: "done", label: "المكتملة" },
];

export function TaskSearch({
  search,
  onSearch,
  filter,
  onFilter,
  priority,
  onPriority,
}: {
  search: string;
  onSearch: (value: string) => void;
  filter: TaskFilter;
  onFilter: (value: TaskFilter) => void;
  priority: string;
  onPriority: (value: string) => void;
}) {
  const activeCount = Number(filter !== "all") + Number(priority !== "all");
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-1.5 ps-4 shadow-card">
      <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      <input
        aria-label="بحث في المهام"
        type="search"
        placeholder="بحث في المهام"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        className="min-h-11 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none"
      />
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="خيارات البحث والتصفية"
            className={`relative grid size-11 shrink-0 place-items-center rounded-xl transition-colors ${activeCount ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-secondary"}`}
          >
            <SlidersHorizontal aria-hidden="true" className="size-5" />
            {activeCount > 0 && (
              <span className="absolute -end-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                <span className="sr-only">مرشحات مفعلة: </span>
                {activeCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          dir="rtl"
          align="end"
          sideOffset={10}
          aria-label="تصفية المهام"
          className="w-80 max-w-[calc(100vw-2rem)] space-y-4 rounded-2xl p-4 shadow-elevated"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">خيارات البحث</h2>
            <button
              type="button"
              disabled={!activeCount}
              onClick={() => {
                onFilter("all");
                onPriority("all");
              }}
              className="min-h-10 rounded-lg px-2 text-xs text-muted-foreground hover:bg-secondary disabled:opacity-40"
            >
              إعادة ضبط
            </button>
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-medium text-muted-foreground">حالة المهمة</legend>
            <div className="grid grid-cols-2 gap-2">
              {filters.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  aria-pressed={filter === item.key}
                  onClick={() => onFilter(item.key)}
                  className={`min-h-11 rounded-xl px-3 text-sm ${filter === item.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block space-y-2 text-xs font-medium text-muted-foreground">
            <span>الأولوية</span>
            <select
              aria-label="أولوية المهام"
              value={priority}
              onChange={(event) => onPriority(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="all">كل الأولويات</option>
              <option value="high">عالية</option>
              <option value="med">متوسطة</option>
              <option value="low">منخفضة</option>
            </select>
          </label>
        </PopoverContent>
      </Popover>
    </div>
  );
}
