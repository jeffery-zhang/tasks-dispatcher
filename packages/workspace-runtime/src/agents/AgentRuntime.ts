import type { AgentKind } from "@tasks-dispatcher/core";
import type { TaskDetailDto } from "@tasks-dispatcher/core/contracts";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export interface AgentLaunchSpec {
  command: string;
  args: string[];
  stdinText?: string;
}

export interface AgentLaunchTarget {
  command: string;
  args: string[];
  stdinText?: string;
}

export interface AttemptResultPaths {
  finalPath: string;
  tempPath: string;
}

export interface AgentLaunchContext {
  workspaceRoot: string;
  taskId: string;
  attemptId: string;
  stepKey: string;
  resultPaths: AttemptResultPaths;
  abortSignalPath: string;
}

export interface AgentRuntime {
  readonly kind: AgentKind;
  createLaunchSpec(
    task: TaskDetailDto,
    context: AgentLaunchContext
  ): AgentLaunchSpec;
}

const tsxCliPath = createRequire(import.meta.url).resolve("tsx/cli");
const wrapperEntryPath = fileURLToPath(
  new URL("./wrapper/AgentAttemptWrapper.ts", import.meta.url)
);

export function createAgentAttemptWrapperLaunchSpec(
  target: AgentLaunchTarget,
  context: AgentLaunchContext
): AgentLaunchSpec {
  return {
    command: process.execPath,
    args: [tsxCliPath, wrapperEntryPath],
    stdinText: JSON.stringify({
      workspaceRoot: context.workspaceRoot,
      taskId: context.taskId,
      attemptId: context.attemptId,
      stepKey: context.stepKey,
      resultPaths: context.resultPaths,
      abortSignalPath: context.abortSignalPath,
      target
    })
  };
}
