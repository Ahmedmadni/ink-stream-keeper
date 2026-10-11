import { describe, expect, test } from "bun:test";
import {
  advanceTaskDate,
  localDayKey,
  matchesTask,
  taskCompletionPatch,
  taskRollupPatch,
} from "../src/features/tasks/task-rules";

const task = {
  title: "مراجعة الحسابات",
  done: false,
  due_at: null as string | null,
  priority: "med",
};
describe("task checklist semantics", () => {
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
  test("monthly recurrence clamps to month end and preserves local time", () => {
    const next = advanceTaskDate(new Date(2026, 0, 31, 9, 30), "monthly");
    expect(localDayKey(next)).toBe("2026-02-28");
    expect(next.getHours()).toBe(9);
    expect(localDayKey(advanceTaskDate(new Date(2028, 0, 31), "monthly"))).toBe("2028-02-29");
  });
});
