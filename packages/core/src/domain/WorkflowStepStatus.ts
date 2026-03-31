export const WORKFLOW_STEP_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped"
] as const;

export type WorkflowStepStatus = (typeof WORKFLOW_STEP_STATUSES)[number];
