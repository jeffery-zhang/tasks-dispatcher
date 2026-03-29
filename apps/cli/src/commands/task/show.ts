import type { CommandContext } from "../../commandContext.js";

export async function runShowTaskCommand(
  context: CommandContext,
  taskId: string
): Promise<void> {
  const task = await context.client.getTask(taskId);

  if (!task) {
    throw new Error(`Task "${taskId}" was not found.`);
  }

  let log = "";
  const latestAttempt = task.attempts.at(-1);

  if (latestAttempt) {
    try {
      log = await context.client.readAttemptLog(task.id, latestAttempt.id);
    } catch {
      log = "";
    }
  }

  context.stdout(
    JSON.stringify({
      command: "show",
      task,
      log
    })
  );
}

