import type { CommandContext } from "../../commandContext.js";

export async function runArchiveTaskCommand(
  context: CommandContext,
  taskId: string
): Promise<void> {
  const task = await context.client.archiveTask(taskId);
  context.stdout(
    JSON.stringify({
      command: "archive",
      taskId: task.id,
      state: task.state
    })
  );
}

