import { describe, expect, it, vi } from "vitest";
import { runWatchTaskCommand } from "../src/commands/task/watch.js";
import type { CommandContext } from "../src/commandContext.js";

describe("runWatchTaskCommand", () => {
  it("subscribes and forwards matching runtime events", async () => {
    const stdout = vi.fn();
    let listener:
      | ((event: { type: "task.updated"; taskId: string }) => void)
      | undefined;

    const subscribe = vi.fn(async (nextListener) => {
      listener = nextListener;
      return () => undefined;
    });

    const context = {
      client: {
        subscribe
      },
      stdout,
      stderr: vi.fn()
    } as unknown as CommandContext;

    const watchPromise = runWatchTaskCommand(context, "task-1");

    await Promise.resolve();

    listener?.({ type: "task.updated", taskId: "task-1" });
    listener?.({ type: "task.updated", taskId: "task-2" });

    expect(stdout).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({
        command: "watch",
        taskId: "task-1",
        status: "subscribed"
      })
    );
    expect(stdout).toHaveBeenNthCalledWith(
      2,
      JSON.stringify({
        type: "task.updated",
        taskId: "task-1"
      })
    );

    watchPromise.catch(() => undefined);
  });
});
