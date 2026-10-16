import { describe, expect, test } from "bun:test";
import { taskChecklistBackendStatus } from "../src/features/tasks/backend-readiness";

describe("task checklist backend readiness", () => {
  test("accepts the installed read-only recurrence helper", () => {
    expect(taskChecklistBackendStatus({ data: "2026-01-01T00:00:00+00:00", error: null })).toBe(
      "ready",
    );
  });

  test("distinguishes a missing migration from a network failure", () => {
    expect(
      taskChecklistBackendStatus({
        data: null,
        error: { code: "PGRST202", message: "Could not find the function" },
      }),
    ).toBe("missing");
    expect(
      taskChecklistBackendStatus({
        data: null,
        error: { message: "Failed to fetch" },
      }),
    ).toBe("unreachable");
  });
});
