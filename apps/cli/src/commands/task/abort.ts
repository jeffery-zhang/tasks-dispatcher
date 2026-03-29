import type { CommandContext } from "../../commandContext.js";

export async function runAbortTaskCommand(
  context: CommandContext,
  taskId: string
): Promise<void> {
  const task = await context.client.abortTask(taskId);
  context.stdout(
    JSON.stringify({
      command: "abort",
      taskId: task.id,
      state: task.state,
      currentAttemptId: task.currentAttemptId
    })
  );
}

