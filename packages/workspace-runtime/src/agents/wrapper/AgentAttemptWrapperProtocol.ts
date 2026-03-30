import type {
  AgentLaunchTarget,
  AttemptResultPaths
} from "../AgentRuntime.js";

export const ATTEMPT_RESULT_SCHEMA_VERSION = 1;
export const WRAPPER_ABORT_EXIT_CODE = 130;

export interface AgentAttemptWrapperLaunchPayload {
  workspaceRoot: string;
  taskId: string;
  attemptId: string;
  resultPaths: AttemptResultPaths;
  abortSignalPath: string;
  target: AgentLaunchTarget;
}

export interface AttemptSuccessResult {
  schemaVersion: typeof ATTEMPT_RESULT_SCHEMA_VERSION;
  status: "completed";
  taskId: string;
  attemptId: string;
  finishedAt: string;
}
