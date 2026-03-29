import { describe, expect, it, vi } from "vitest";
import { runAbortTaskCommand } from "../src/commands/task/abort.js";
import { runArchiveTaskCommand } from "../src/commands/task/archive.js";
import { runQueueTaskCommand } from "../src/commands/task/queue.js";
import { runReopenTaskCommand } from "../src/commands/task/reopen.js";
import { runShowTaskCommand } from "../src/commands/task/show.js";
import type { CommandContext } from "../src/commandContext.js";

function createContext() {
  const stdout = vi.fn();

  return {
    context: {
      client: {
        queueTask: vi.fn().mockResolvedValue({
          id: "task-1",
          state: "pending_execution",
          currentAttemptId: "attempt-1"
        }),
        reopenTask: vi.fn().mockResolvedValue({
          id: "task-1",
          state: "reopened"
        }),
        archiveTask: vi.fn().mockResolvedValue({
          id: "task-1",
          state: "archived"
        }),
        abortTask: vi.fn().mockResolvedValue({
          id: "task-1",
          state: "execution_failed",
          currentAttemptId: "attempt-1"
        }),
        getTask: vi.fn().mockResolvedValue({
          id: "task-1",
          title: "Task",
          description: "Task description",
          agent: "codex-cli",
          state: "execution_failed",
          workflowId: "default-plan-develop-self-check",
          workflowLabel: "Default Plan / Develop / Self-check",
          createdAt: "2026-03-29T00:00:00.000Z",
          updatedAt: "2026-03-29T00:01:00.000Z",
          currentAttemptId: "attempt-1",
          attempts: [
            {
              id: "attempt-1",
              status: "failed",
              stage: "plan",
              terminationReason: "manually_aborted"
            }
          ]
        }),
        readAttemptLog: vi.fn().mockResolvedValue("task log")
      },
      stdout,
      stderr: vi.fn()
    } as unknown as CommandContext,
    stdout
  };
}

describe("task state commands", () => {
  it("prints queue transitions", async () => {
    const { context, stdout } = createContext();

    await runQueueTaskCommand(context, "task-1");

    expect(stdout).toHaveBeenCalledWith(
      JSON.stringify({
        command: "queue",
        taskId: "task-1",
        state: "pending_execution",
        currentAttemptId: "attempt-1"
      })
    );
  });

  it("prints reopen transitions", async () => {
    const { context, stdout } = createContext();

    await runReopenTaskCommand(context, "task-1");

    expect(stdout).toHaveBeenCalledWith(
      JSON.stringify({
        command: "reopen",
        taskId: "task-1",
        state: "reopened"
      })
    );
  });

  it("prints archive transitions", async () => {
    const { context, stdout } = createContext();

    await runArchiveTaskCommand(context, "task-1");

    expect(stdout).toHaveBeenCalledWith(
      JSON.stringify({
        command: "archive",
        taskId: "task-1",
        state: "archived"
      })
    );
  });

  it("prints abort transitions", async () => {
    const { context, stdout } = createContext();

    await runAbortTaskCommand(context, "task-1");

    expect(stdout).toHaveBeenCalledWith(
      JSON.stringify({
        command: "abort",
        taskId: "task-1",
        state: "execution_failed",
        currentAttemptId: "attempt-1"
      })
    );
  });

  it("prints full task details and latest log", async () => {
    const { context, stdout } = createContext();

    await runShowTaskCommand(context, "task-1");

    expect(stdout).toHaveBeenCalledWith(
      JSON.stringify({
        command: "show",
        task: {
          id: "task-1",
          title: "Task",
          description: "Task description",
          agent: "codex-cli",
          state: "execution_failed",
          workflowId: "default-plan-develop-self-check",
          workflowLabel: "Default Plan / Develop / Self-check",
          createdAt: "2026-03-29T00:00:00.000Z",
          updatedAt: "2026-03-29T00:01:00.000Z",
          currentAttemptId: "attempt-1",
          attempts: [
            {
              id: "attempt-1",
              status: "failed",
              stage: "plan",
              terminationReason: "manually_aborted"
            }
          ]
        },
        log: "task log"
      })
    );
  });
});
