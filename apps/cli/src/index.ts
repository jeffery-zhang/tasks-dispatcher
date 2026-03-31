import { parseArgs } from "node:util";
import { createWorkspaceRuntimeClient } from "@tasks-dispatcher/workspace-runtime/client";
import { runAbortTaskCommand } from "./commands/task/abort.js";
import { runArchiveTaskCommand } from "./commands/task/archive.js";
import { runCreateTaskCommand } from "./commands/task/create.js";
import { runQueueTaskCommand } from "./commands/task/queue.js";
import { runReopenTaskCommand } from "./commands/task/reopen.js";
import { runShowTaskCommand } from "./commands/task/show.js";
import { runWatchTaskCommand } from "./commands/task/watch.js";
import type { CommandContext } from "./commandContext.js";

function assertString(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required argument: ${name}`);
  }

  return value;
}

async function createContext(): Promise<CommandContext> {
  const client = await createWorkspaceRuntimeClient(process.cwd());

  return {
    client,
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`)
  };
}

async function main(): Promise<void> {
  const [command = "help", ...restArgs] = process.argv.slice(2);
  const context = await createContext();

  switch (command) {
    case "create": {
      const { values } = parseArgs({
        args: restArgs,
        options: {
          title: { type: "string" },
          description: { type: "string" },
          workflow: { type: "string" }
        }
      });

      await runCreateTaskCommand(context, {
        title: assertString(values.title, "--title"),
        description: assertString(values.description, "--description"),
        workflowId: assertString(values.workflow, "--workflow")
      });
      return;
    }

    case "queue":
      await runQueueTaskCommand(context, assertString(restArgs[0], "taskId"));
      return;

    case "reopen":
      await runReopenTaskCommand(context, assertString(restArgs[0], "taskId"));
      return;

    case "archive":
      await runArchiveTaskCommand(context, assertString(restArgs[0], "taskId"));
      return;

    case "abort":
      await runAbortTaskCommand(context, assertString(restArgs[0], "taskId"));
      return;

    case "show":
      await runShowTaskCommand(context, assertString(restArgs[0], "taskId"));
      return;

    case "watch":
      await runWatchTaskCommand(context, restArgs[0]);
      await new Promise<void>(() => {
        // Keep the CLI alive for watch mode until it is terminated externally.
      });
      return;

    default:
      context.stdout(
        JSON.stringify({
          commands: ["create", "queue", "reopen", "archive", "abort", "show", "watch"]
        })
      );
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown CLI error.";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
