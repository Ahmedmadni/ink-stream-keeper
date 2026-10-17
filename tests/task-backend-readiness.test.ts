import { describe, expect, test } from "bun:test";
import { taskChecklistBackendStatus } from "../src/features/tasks/backend-readiness";

describe("task checklist backend readiness", () => {
  test("accepts the installed parent-completion guard", () => {
    expect(taskChecklistBackendStatus({ data: true, error: null })).toBe("ready");
  });

  test("requires the guard trigger, not only a callable probe", () => {
    expect(taskChecklistBackendStatus({ data: false, error: null })).toBe("missing");
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
