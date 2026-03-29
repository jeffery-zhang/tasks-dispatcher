import type { WorkspaceRuntimeEvent } from "@tasks-dispatcher/core/contracts";
import type { CommandContext } from "../../commandContext.js";

export async function runWatchTaskCommand(
  context: CommandContext,
  taskId?: string
): Promise<() => void> {
  context.stdout(
    JSON.stringify({
      command: "watch",
      taskId: taskId ?? null,
      status: "subscribed"
    })
  );

  return context.client.subscribe((event: WorkspaceRuntimeEvent) => {
    if (taskId && event.taskId !== taskId) {
      return;
    }

    context.stdout(JSON.stringify(event));
  });
}
