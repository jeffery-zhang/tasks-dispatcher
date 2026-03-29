import type { AgentKind } from "@tasks-dispatcher/core";
import type { TaskDetailDto } from "@tasks-dispatcher/core/contracts";

export interface AgentLaunchSpec {
  command: string;
  args: string[];
  stdinText?: string;
}

export interface AgentRuntime {
  readonly kind: AgentKind;
  createLaunchSpec(task: TaskDetailDto): AgentLaunchSpec;
}
