import type { CommandContext } from "../../commandContext.js";

export async function runReopenTaskCommand(
  context: CommandContext,
  taskId: string
): Promise<void> {
  const task = await context.client.reopenTask(taskId);
  context.stdout(
    JSON.stringify({
      command: "reopen",
      taskId: task.id,
      state: task.state
    })
  );
}

