import type { TaskDetailDto } from "@tasks-dispatcher/core/contracts";

function getCurrentAttempt(task: TaskDetailDto) {
  const currentAttempt =
    task.attempts.find((attempt) => attempt.id === task.currentAttemptId) ?? null;

  if (!currentAttempt) {
    throw new Error(`Task "${task.id}" has no current attempt DTO.`);
  }

  return currentAttempt;
}

function getCurrentStep(task: TaskDetailDto) {
  const currentAttempt = getCurrentAttempt(task);
  const currentStep =
    currentAttempt.steps.find((step) => step.key === currentAttempt.currentStepKey) ?? null;

  if (!currentStep) {
    throw new Error(`Task "${task.id}" has no current step DTO.`);
  }

  return currentStep;
}

export function buildExecutionPrompt(task: TaskDetailDto): string {
  const currentStep = getCurrentStep(task);

  return [
    "You are executing one workflow step inside a local workspace.",
    "Do not ask the user for clarification or confirmation.",
    "If you cannot continue without user input, fail with failureReason `needs_input`.",
    "Work only on the current step described below. Do not simulate later steps.",
    "When you finish, print exactly one standalone result line in this format:",
    'TASKS_DISPATCHER_RESULT:{"status":"completed","finishedAt":"<ISO-8601>"}',
    "If the step fails, print exactly one standalone result line in this format:",
    'TASKS_DISPATCHER_RESULT:{"status":"failed","failureReason":"needs_input|protocol_failure|process_exit_non_zero|signal_terminated|startup_failed|manually_aborted","finishedAt":"<ISO-8601>"}',
    "The result line must be valid JSON after the prefix.",
    "",
    `Task title: ${task.title}`,
    `Task description: ${task.description}`,
    `Workflow: ${task.workflowLabel}`,
    `Current step: ${currentStep.name}`,
    `Current step agent: ${currentStep.agent}`,
    "",
    "Current step prompt:",
    currentStep.prompt,
    "",
    "You must keep all work inside the current workspace directory.",
    "Do the work now."
  ].join("\n");
}
