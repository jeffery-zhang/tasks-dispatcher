import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskSessionDetailModal } from "../components/TaskSessionDetailModal.js";

describe("TaskSessionDetailModal", () => {
  it("renders a wider session modal with collapsed logs by default", () => {
    const markup = renderToStaticMarkup(
      <TaskSessionDetailModal
        attempt={{
          id: "attempt-1",
          status: "running",
          workflowId: "default-plan-work-review",
          workflowLabel: "Default Plan / Work / Review",
          currentStepKey: "work",
          startedAt: "2026-03-29T00:01:00.000Z",
          finishedAt: null,
          terminationReason: null,
          steps: []
        }}
        isCurrentAttempt={true}
        log={"line one\nline two"}
        onClose={vi.fn()}
        open={true}
      />
    );

    expect(markup).toContain("Session attempt-1");
    expect(markup).toContain("Show Logs");
    expect(markup).not.toContain("line one");
  });

  it("formats termination reasons for failed sessions", () => {
    const markup = renderToStaticMarkup(
      <TaskSessionDetailModal
        attempt={{
          id: "attempt-2",
          status: "failed",
          workflowId: "default-plan-work-review",
          workflowLabel: "Default Plan / Work / Review",
          currentStepKey: "review",
          startedAt: "2026-03-29T00:01:00.000Z",
          finishedAt: "2026-03-29T00:05:00.000Z",
          terminationReason: "manually_aborted",
          steps: []
        }}
        isCurrentAttempt={false}
        log=""
        onClose={vi.fn()}
        open={true}
      />
    );

    expect(markup).toContain("Manually Aborted");
  });
});
