export const TASK_STATES = [
  "draft",
  "ready",
  "executing",
  "completed",
  "failed",
  "archived"
] as const;

export type TaskState = (typeof TASK_STATES)[number];
