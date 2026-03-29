export const EXECUTION_STAGES = ["plan", "develop", "self_check"] as const;

export type ExecutionStage = (typeof EXECUTION_STAGES)[number];

