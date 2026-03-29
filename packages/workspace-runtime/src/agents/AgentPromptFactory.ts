import type { TaskDetailDto } from "@tasks-dispatcher/core/contracts";

export function buildExecutionPrompt(task: TaskDetailDto): string {
  return [
    "You are executing a coding task inside a local workspace.",
    "The task title and description below are the full specification for this run.",
    "Work fully autonomously and do not ask for confirmation or clarification.",
    "If anything is ambiguous, make the smallest reasonable assumption, continue, and mention the assumption in your final summary.",
    "Follow these stages exactly in order and print these marker lines exactly as standalone lines before each stage:",
    "TASKS_DISPATCHER_STAGE:plan",
    "TASKS_DISPATCHER_STAGE:develop",
    "TASKS_DISPATCHER_STAGE:self_check",
    "When the work is complete, print TASKS_DISPATCHER_STAGE:complete as a standalone line and then print your concise final summary.",
    "",
    `Task title: ${task.title}`,
    `Task description: ${task.description}`,
    "",
    "You must keep all work inside the current workspace directory.",
    "Do the work now."
  ].join("\n");
}
