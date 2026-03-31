import type { ExecutionStage, TaskAttemptTerminationReason } from "@tasks-dispatcher/core";
import type {
  AgentLaunchTarget,
  AttemptResultPaths
} from "../AgentRuntime.js";

export const ATTEMPT_RESULT_SCHEMA_VERSION = 1;
export const WRAPPER_ABORT_EXIT_CODE = 130;
export const WRAPPER_RESULT_PREFIX = "TASKS_DISPATCHER_RESULT:";

export interface AgentAttemptWrapperLaunchPayload {
  workspaceRoot: string;
  taskId: string;
  attemptId: string;
  stepKey: ExecutionStage;
  resultPaths: AttemptResultPaths;
  abortSignalPath: string;
  target: AgentLaunchTarget;
}

export interface AttemptResult {
  schemaVersion: typeof ATTEMPT_RESULT_SCHEMA_VERSION;
  status: "completed" | "failed";
  taskId: string;
  attemptId: string;
  stepKey: ExecutionStage;
  finishedAt: string;
  failureReason?: TaskAttemptTerminationReason | null;
}
