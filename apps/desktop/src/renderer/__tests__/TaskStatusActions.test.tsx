import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskStatusActions } from "../components/TaskStatusActions.js";
import type { TaskDetailDto } from "@tasks-dispatcher/core/contracts";

function createTask(state: TaskDetailDto["state"]): TaskDetailDto {
  return {
    id: "task-1",
    title: "Test task",
    description: "Testing buttons",
    state,
    workflowId: "default-plan-work-review",
    workflowLabel: "Default Plan / Work / Review",
    createdAt: "2026-03-29T00:00:00.000Z",
    updatedAt: "2026-03-29T00:00:00.000Z",
    currentAttemptId: null,
    currentStepKey: null,
    currentStepStatus: null,
    currentStepAgent: null,
    attempts: []
  };
}

describe("TaskStatusActions", () => {
  it("shows only reopen for failed tasks", () => {
    const markup = renderToStaticMarkup(
      <TaskStatusActions
        state={createTask("failed").state}
        onQueue={vi.fn()}
        onReopen={vi.fn()}
        onArchive={vi.fn()}
        onAbort={vi.fn()}
      />
    );

    expect(markup).toContain("Reopen");
    expect(markup).not.toContain("Archive");
  });

  it("shows archive and reopen for completed tasks", () => {
    const markup = renderToStaticMarkup(
      <TaskStatusActions
        state={createTask("completed").state}
        onQueue={vi.fn()}
        onReopen={vi.fn()}
        onArchive={vi.fn()}
        onAbort={vi.fn()}
      />
    );

    expect(markup).toContain("Archive");
    expect(markup).toContain("Reopen");
    expect(markup).not.toContain("Abort");
  });
});
