export const TASK_STATES = [
  "initializing",
  "pending_execution",
  "executing",
  "pending_validation",
  "archived",
  "execution_failed",
  "reopened"
] as const;

export type TaskState = (typeof TASK_STATES)[number];

