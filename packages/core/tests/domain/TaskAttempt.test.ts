import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKFLOW_ID,
  getTaskWorkflowDefinition
} from "../../src/domain/TaskWorkflow.js";
import { TaskAttempt } from "../../src/domain/TaskAttempt.js";

describe("TaskAttempt", () => {
  it("starts queued with workflow-backed step records", () => {
    const workflow = getTaskWorkflowDefinition(DEFAULT_WORKFLOW_ID);
    const attempt = TaskAttempt.createQueued({
      id: "attempt-1",
      taskId: "task-1",
      workflowId: workflow.id,
      workflowLabel: workflow.label,
      steps: workflow.steps,
      createdAt: new Date("2026-03-29T00:00:00.000Z")
    });

    expect(attempt.toSnapshot()).toMatchObject({
      id: "attempt-1",
      status: "queued",
      currentStepKey: null
    });
    expect(attempt.toSnapshot().steps.map((step) => step.status)).toEqual([
      "pending",
      "pending",
      "pending"
    ]);
  });

  it("moves through plan, work, and review before completion", () => {
    const workflow = getTaskWorkflowDefinition(DEFAULT_WORKFLOW_ID);
    const attempt = TaskAttempt.createQueued({
      id: "attempt-1",
      taskId: "task-1",
      workflowId: workflow.id,
      workflowLabel: workflow.label,
      steps: workflow.steps,
      createdAt: new Date("2026-03-29T00:00:00.000Z")
    });

    attempt.start(new Date("2026-03-29T00:01:00.000Z"));
    attempt.completeStep("plan", new Date("2026-03-29T00:02:00.000Z"));
    attempt.startStep("work", new Date("2026-03-29T00:03:00.000Z"));
    attempt.completeStep("work", new Date("2026-03-29T00:04:00.000Z"));
    attempt.startStep("review", new Date("2026-03-29T00:05:00.000Z"));
    attempt.completeStep("review", new Date("2026-03-29T00:06:00.000Z"));
    attempt.markCompleted(new Date("2026-03-29T00:06:30.000Z"));

    expect(attempt.toSnapshot()).toMatchObject({
      status: "completed",
      currentStepKey: null,
      terminationReason: null
    });
    expect(attempt.toSnapshot().steps.map((step) => step.status)).toEqual([
      "completed",
      "completed",
      "completed"
    ]);
  });

  it("records needs_input as a failed running step and failed attempt", () => {
    const workflow = getTaskWorkflowDefinition(DEFAULT_WORKFLOW_ID);
    const attempt = TaskAttempt.createQueued({
      id: "attempt-1",
      taskId: "task-1",
      workflowId: workflow.id,
      workflowLabel: workflow.label,
      steps: workflow.steps,
      createdAt: new Date("2026-03-29T00:00:00.000Z")
    });

    attempt.start(new Date("2026-03-29T00:01:00.000Z"));
    attempt.markFailed("needs_input", new Date("2026-03-29T00:02:00.000Z"));

    expect(attempt.toSnapshot()).toMatchObject({
      status: "failed",
      terminationReason: "needs_input"
    });
    expect(attempt.toSnapshot().steps[0]).toMatchObject({
      status: "failed",
      failureReason: "needs_input"
    });
  });
});
