import type { CommandContext } from "../../commandContext.js";

export async function runQueueTaskCommand(
  context: CommandContext,
  taskId: string
): Promise<void> {
  const task = await context.client.queueTask(taskId);
  context.stdout(
    JSON.stringify({
      command: "queue",
      taskId: task.id,
      state: task.state,
      currentAttemptId: task.currentAttemptId
    })
  );
}

