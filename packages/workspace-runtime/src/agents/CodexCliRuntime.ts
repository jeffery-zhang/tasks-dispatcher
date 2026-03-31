import type { TaskDetailDto } from "@tasks-dispatcher/core/contracts";
import { buildExecutionPrompt } from "./AgentPromptFactory.js";
import {
  createAgentAttemptWrapperLaunchSpec,
  type AgentLaunchContext,
  type AgentRuntime
} from "./AgentRuntime.js";

export class CodexCliRuntime implements AgentRuntime {
  readonly kind = "codex-cli" as const;

  createLaunchSpec(task: TaskDetailDto, context: AgentLaunchContext) {
    return createAgentAttemptWrapperLaunchSpec(
      {
        command: "codex",
        args: [
          "exec",
          "--dangerously-bypass-approvals-and-sandbox",
          "--skip-git-repo-check",
          "-"
        ],
        stdinText: buildExecutionPrompt(task)
      },
      context
    );
  }
}
