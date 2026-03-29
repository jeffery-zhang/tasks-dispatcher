import { describe, expect, it, vi } from "vitest";
import { runCreateTaskCommand } from "../src/commands/task/create.js";
import type { CommandContext } from "../src/commandContext.js";

function createContext() {
  const stdout = vi.fn();

  return {
    context: {
      client: {
        createTask: vi.fn().mockResolvedValue({
          id: "task-1",
          state: "initializing",
          workflowId: "default-plan-develop-self-check"
        })
      },
      stdout,
      stderr: vi.fn()
    } as unknown as CommandContext,
    stdout
  };
}

describe("runCreateTaskCommand", () => {
  it("creates a draft task and prints a compact JSON summary", async () => {
    const { context, stdout } = createContext();

    await runCreateTaskCommand(context, {
      title: "Build feature",
      description: "Implement command",
      agent: "codex-cli"
    });

    expect(stdout).toHaveBeenCalledWith(
      JSON.stringify({
        command: "create",
        taskId: "task-1",
        state: "initializing",
        workflow: "default-plan-develop-self-check"
      })
    );
  });
});

