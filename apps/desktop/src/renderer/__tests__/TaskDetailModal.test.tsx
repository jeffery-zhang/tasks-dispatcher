import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TaskDetailDto } from "@tasks-dispatcher/core/contracts";
import { TaskDetailModal } from "../components/TaskDetailModal.js";

function createTask(attemptCount = 0): TaskDetailDto {
  return {
    id: "task-1",
    title: "Review runtime sync",
    description: "Inspect the task detail modal.",
    agent: "codex-cli",
    state: "pending_validation",
    workflowId: "default-plan-develop-self-check",
    workflowLabel: "Default Plan / Develop / Self-check",
    createdAt: "2026-03-29T00:00:00.000Z",
    updatedAt: "2026-03-29T00:00:00.000Z",
    currentAttemptId: attemptCount > 0 ? "attempt-1" : null,
    attempts:
      attemptCount > 0
        ? [
            {
              id: "attempt-1",
              status: "completed",
              stage: "self_check",
              terminationReason: null
            }
          ]
        : []
  };
}

describe("TaskDetailModal", () => {
  it("renders lightweight details when the task has no attempts yet", () => {
    const markup = renderToStaticMarkup(
      <TaskDetailModal
        open={true}
        task={createTask(0)}
        onAbort={vi.fn()}
        onArchive={vi.fn()}
        onClose={vi.fn()}
        onOpenSessionDetails={vi.fn()}
        onQueue={vi.fn()}
        onReopen={vi.fn()}
      />
    );

    expect(markup).toContain("No session history yet");
    expect(markup).toContain("Default Plan / Develop / Self-check");
  });

  it("renders a session list when attempts exist", () => {
    const markup = renderToStaticMarkup(
      <TaskDetailModal
        open={true}
        task={createTask(1)}
        onAbort={vi.fn()}
        onArchive={vi.fn()}
        onClose={vi.fn()}
        onOpenSessionDetails={vi.fn()}
        onQueue={vi.fn()}
        onReopen={vi.fn()}
      />
    );

    expect(markup).toContain("Sessions");
    expect(markup).toContain("attempt-1");
    expect(markup).toContain("Details");
  });
});
