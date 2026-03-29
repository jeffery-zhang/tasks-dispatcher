import type { AgentKind } from "@tasks-dispatcher/core";
import type { CommandContext } from "../../commandContext.js";

export interface CreateTaskCommandInput {
  title: string;
  description: string;
  agent: AgentKind;
}

export async function runCreateTaskCommand(
  context: CommandContext,
  input: CreateTaskCommandInput
): Promise<void> {
  const task = await context.client.createTask(input);
  context.stdout(
    JSON.stringify({
      command: "create",
      taskId: task.id,
      state: task.state,
      workflow: task.workflowId
    })
  );
}

