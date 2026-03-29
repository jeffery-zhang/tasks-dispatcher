import type { TaskDetailDto } from "@tasks-dispatcher/core/contracts";
import { buildExecutionPrompt } from "./AgentPromptFactory.js";
import type { AgentLaunchSpec, AgentRuntime } from "./AgentRuntime.js";

export class ClaudeCodeRuntime implements AgentRuntime {
  readonly kind = "claude-code" as const;

  createLaunchSpec(task: TaskDetailDto): AgentLaunchSpec {
    return {
      command: "claude",
      args: [
        "-p",
        "--dangerously-skip-permissions",
        "--permission-mode",
        "bypassPermissions",
        buildExecutionPrompt(task)
      ]
    };
  }
}

