import { describe, expect, test } from "bun:test";
import {
  advanceTaskDate,
  localDayKey,
  matchesTask,
  summarizeTaskItems,
  taskCompletionPatch,
  taskRollupPatch,
  formatTaskDateTime,
  previewTaskItems,
} from "../src/features/tasks/task-rules";

const task = {
  title: "مراجعة الحسابات",
  done: false,
  due_at: null as string | null,
  priority: "med",
};
describe("task checklist semantics", () => {
  test("card previews keep unfinished work first by priority and replace legacy rows", () => {
    const row = {
      title: "بند",
      done: false,
      priority: "med",
      position: 0,
      created_at: "2026-10-19",
    };
    const result = previewTaskItems(
      [
        { ...row, id: "done", taskId: "current", done: true, priority: "high" },
        { ...row, id: "low", taskId: "current", priority: "low" },
        { ...row, id: "high", taskId: "current", priority: "high" },
        { ...row, id: "nested", taskId: "current", position: 2 },
      ],
      [
        { ...row, id: "old-duplicate", taskId: "current" },
        { ...row, id: "legacy-only", taskId: "legacy", title: "بند قديم" },
      ],
    );
    expect(result.current.map((item) => item.id)).toEqual(["high", "nested", "low", "done"]);
    expect(result.legacy[0].title).toBe("بند قديم");
    expect(previewTaskItems([], [])).toEqual({});
  });
  test("Arabic dates spell out the month and keep day before month before year", () => {
    const text = formatTaskDateTime("2026-10-18T18:30");
    expect(text).toContain("18 أكتوبر 2026");
    expect(formatTaskDateTime("")).toBe("اختيار التاريخ والوقت");
    expect(formatTaskDateTime("invalid")).toBe("اختيار التاريخ والوقت");
  });
  test("undated tasks belong in open tasks, not today/upcoming", () => {
    expect(matchesTask(task, "all", "")).toBe(true);
    expect(matchesTask(task, "today", "")).toBe(false);
    expect(matchesTask(task, "upcoming", "")).toBe(false);
  });
  test("today uses local calendar boundaries including times near midnight", () => {
    const now = new Date(2026, 9, 10, 0, 10);
    expect(
      matchesTask(
        { ...task, due_at: new Date(2026, 9, 10, 23, 59).toISOString() },
        "today",
        "",
        now,
      ),
    ).toBe(true);
    expect(
      matchesTask(
        { ...task, due_at: new Date(2026, 9, 9, 23, 59).toISOString() },
        "today",
        "",
        now,
      ),
    ).toBe(false);
    expect(localDayKey(now)).toBe("2026-10-10");
  });
  test("search trims whitespace; completed tasks only appear in their filter", () => {
    expect(matchesTask(task, "all", "  الحسابات  ")).toBe(true);
    expect(matchesTask(task, "all", "اجتماع")).toBe(false);
    expect(matchesTask({ ...task, done: true }, "all", "")).toBe(false);
    expect(matchesTask({ ...task, done: true }, "done", "")).toBe(true);
  });
  test("upcoming excludes overdue and includes tomorrow", () => {
    const now = new Date(2026, 9, 10, 12);
    expect(
      matchesTask({ ...task, due_at: new Date(2026, 9, 9).toISOString() }, "upcoming", "", now),
    ).toBe(false);
    expect(
      matchesTask({ ...task, due_at: new Date(2026, 9, 11).toISOString() }, "upcoming", "", now),
    ).toBe(true);
  });
  test("completion patches keep done and status consistent", () => {
    expect(taskCompletionPatch(true)).toEqual({ done: true, status: "done" });
    expect(taskCompletionPatch(false)).toEqual({ done: false, status: "todo" });
  });
  test("checklist rollup completes and reopens the parent task", () => {
    expect(taskRollupPatch(4, 4, "in_progress")).toEqual({
      progress: 100,
      done: true,
      status: "done",
    });
    expect(taskRollupPatch(4, 3, "done")).toEqual({
      progress: 75,
      done: false,
      status: "todo",
    });
    expect(taskRollupPatch(0, 0, "in_progress")).toEqual({
      progress: 0,
      done: false,
      status: "in_progress",
    });
  });
  test("current checklist summaries replace rather than duplicate legacy rows", () => {
    expect(
      summarizeTaskItems(
        [
          { taskId: "current", done: true },
          { taskId: "current", done: false },
        ],
        [
          { taskId: "current", done: true },
          { taskId: "legacy", done: true },
        ],
      ),
    ).toEqual({
      current: { done: 1, total: 2, progress: 50 },
      legacy: { done: 1, total: 1, progress: 100 },
    });
  });
  test("monthly recurrence clamps to month end and preserves local time", () => {
    const next = advanceTaskDate(new Date(2026, 0, 31, 9, 30), "monthly");
    expect(localDayKey(next)).toBe("2026-02-28");
    expect(next.getHours()).toBe(9);
    expect(localDayKey(advanceTaskDate(new Date(2028, 0, 31), "monthly"))).toBe("2028-02-29");
  });
});

describe("matchesTask search coverage", () => {
  const base = { title: "تسوق", done: false, due_at: null, priority: "med" };
  test("matches description, notes and tags, not only the title", () => {
    expect(matchesTask({ ...base, description: "شراء حليب وخبز" }, "all", "حليب")).toBe(true);
    expect(matchesTask({ ...base, notes: "من متجر الحي" }, "all", "متجر")).toBe(true);
    expect(matchesTask({ ...base, tags: ["بقالة"] }, "all", "بقالة")).toBe(true);
    expect(matchesTask(base, "all", "حليب")).toBe(false);
  });
});
