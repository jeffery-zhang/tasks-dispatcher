import { describe, expect, it } from "vitest";
import { TaskAttempt } from "../../src/domain/TaskAttempt.js";

describe("TaskAttempt", () => {
  it("starts queued in the plan stage", () => {
    const attempt = TaskAttempt.createQueued({
      id: "attempt-1",
      taskId: "task-1",
      agent: "codex-cli",
      createdAt: new Date("2026-03-29T00:00:00.000Z")
    });

    expect(attempt.toSnapshot()).toMatchObject({
      id: "attempt-1",
      status: "queued",
      stage: "plan"
    });
  });

  it("moves through stages before completion", () => {
    const attempt = TaskAttempt.createQueued({
      id: "attempt-1",
      taskId: "task-1",
      agent: "claude-code",
      createdAt: new Date("2026-03-29T00:00:00.000Z")
    });

    attempt.start(new Date("2026-03-29T00:01:00.000Z"));
    attempt.moveToStage("develop");
    attempt.moveToStage("self_check");
    attempt.markCompleted(new Date("2026-03-29T00:03:00.000Z"));

    expect(attempt.toSnapshot()).toMatchObject({
      status: "completed",
      stage: "self_check",
      terminationReason: null
    });
  });

  it("records manual aborts as failed attempts", () => {
    const attempt = TaskAttempt.createQueued({
      id: "attempt-1",
      taskId: "task-1",
      agent: "codex-cli",
      createdAt: new Date("2026-03-29T00:00:00.000Z")
    });

    attempt.start(new Date("2026-03-29T00:01:00.000Z"));
    attempt.markFailed(
      "manually_aborted",
      new Date("2026-03-29T00:02:00.000Z")
    );

    expect(attempt.toSnapshot()).toMatchObject({
      status: "failed",
      terminationReason: "manually_aborted"
    });
  });

  it("records protocol failures as failed attempts", () => {
    const attempt = TaskAttempt.createQueued({
      id: "attempt-1",
      taskId: "task-1",
      agent: "codex-cli",
      createdAt: new Date("2026-03-29T00:00:00.000Z")
    });

    attempt.start(new Date("2026-03-29T00:01:00.000Z"));
    attempt.markFailed(
      "protocol_failure",
      new Date("2026-03-29T00:02:00.000Z")
    );

    expect(attempt.toSnapshot()).toMatchObject({
      status: "failed",
      terminationReason: "protocol_failure"
    });
  });
});
