import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TaskSummaryDto } from "@tasks-dispatcher/core/contracts";
import { TaskCard } from "../components/TaskCard.js";

const task: TaskSummaryDto = {
  id: "task-1",
  title: "Implement grouped board",
  description:
    "This is a long description that should still render inside the task card and be clipped by the card container rather than expanded in full.",
  state: "draft",
  workflowId: "default-plan-work-review",
  workflowLabel: "Default Plan / Work / Review",
  updatedAt: "2026-03-29T00:00:00.000Z",
  currentAttemptId: null,
  currentAttemptTerminationReason: null,
  currentStepKey: null,
  currentStepStatus: null,
  currentStepAgent: null
};

describe("TaskCard", () => {
  it("renders the minimal card summary and direct actions", () => {
    const markup = renderToStaticMarkup(
      <TaskCard
        task={task}
        onAbort={vi.fn()}
        onArchive={vi.fn()}
        onOpenDetails={vi.fn()}
        onQueue={vi.fn()}
        onReopen={vi.fn()}
      />
    );

    expect(markup).toContain("Implement grouped board");
    expect(markup).toContain("Details");
    expect(markup).toContain("Queue");
    expect(markup).toContain("draft");
  });

  it("renders a failure hint on failed cards", () => {
    const markup = renderToStaticMarkup(
      <TaskCard
        task={{
          ...task,
          state: "failed",
          currentAttemptId: "attempt-1",
          currentAttemptTerminationReason: "protocol_failure"
        }}
        onAbort={vi.fn()}
        onArchive={vi.fn()}
        onOpenDetails={vi.fn()}
        onQueue={vi.fn()}
        onReopen={vi.fn()}
      />
    );

    expect(markup).toContain("Protocol Failure");
  });
});
