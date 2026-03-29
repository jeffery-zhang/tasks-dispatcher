import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskStatusActions } from "../components/TaskStatusActions.js";
import type { TaskDetailDto } from "@tasks-dispatcher/core/contracts";

function createTask(state: TaskDetailDto["state"]): TaskDetailDto {
  return {
    id: "task-1",
    title: "Test task",
    description: "Testing buttons",
    agent: "codex-cli",
    state,
    workflowId: "default-plan-develop-self-check",
    workflowLabel: "Default Plan / Develop / Self-check",
    createdAt: "2026-03-29T00:00:00.000Z",
    updatedAt: "2026-03-29T00:00:00.000Z",
    currentAttemptId: null,
    attempts: []
  };
}

describe("TaskStatusActions", () => {
  it("shows queue and reopen actions for failed tasks", () => {
    const markup = renderToStaticMarkup(
      <TaskStatusActions
        task={createTask("execution_failed")}
        onQueue={vi.fn()}
        onReopen={vi.fn()}
        onArchive={vi.fn()}
        onAbort={vi.fn()}
      />
    );

    expect(markup).toContain("Queue");
    expect(markup).toContain("Reopen");
    expect(markup).not.toContain("Archive");
  });

  it("shows only archive and reopen for validation tasks", () => {
    const markup = renderToStaticMarkup(
      <TaskStatusActions
        task={createTask("pending_validation")}
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
