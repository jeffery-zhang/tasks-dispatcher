export const EXECUTION_STAGES = ["plan", "work", "review"] as const;

export type ExecutionStage = (typeof EXECUTION_STAGES)[number];
