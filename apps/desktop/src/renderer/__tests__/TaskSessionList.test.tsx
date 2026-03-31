import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskSessionList } from "../components/TaskSessionList.js";

describe("TaskSessionList", () => {
  it("renders termination hints for failed attempts", () => {
    const markup = renderToStaticMarkup(
      <TaskSessionList
        attempts={[
          {
            id: "attempt-1",
            status: "failed",
            workflowId: "default-plan-work-review",
            workflowLabel: "Default Plan / Work / Review",
            currentStepKey: "review",
            startedAt: "2026-03-29T00:01:00.000Z",
            finishedAt: "2026-03-29T00:05:00.000Z",
            terminationReason: "protocol_failure",
            steps: []
          },
          {
            id: "attempt-2",
            status: "completed",
            workflowId: "default-plan-work-review",
            workflowLabel: "Default Plan / Work / Review",
            currentStepKey: null,
            startedAt: "2026-03-29T00:01:00.000Z",
            finishedAt: "2026-03-29T00:05:00.000Z",
            terminationReason: null,
            steps: []
          }
        ]}
        onOpenSessionDetails={vi.fn()}
      />
    );

    expect(markup).toContain("Protocol Failure");
    expect(markup).toContain("attempt-1");
    expect(markup).toContain("attempt-2");
  });
});
