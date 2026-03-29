export type DesktopStartupErrorCode =
  | "preload_missing"
  | "bridge_missing"
  | "runtime_bootstrap_failed"
  | "initial_query_failed";

export interface DesktopStartupError {
  code: DesktopStartupErrorCode;
  message: string;
  expectedPath?: string;
  workspaceRoot?: string;
}

export function readDesktopStartupErrorFromLocation(
  search: string
): DesktopStartupError | null {
  const params = new URLSearchParams(search);
  const code = params.get("startupErrorCode");
  const message = params.get("startupErrorMessage");

  if (!code || !message) {
    return null;
  }

  return {
    code: code as DesktopStartupErrorCode,
    message,
    expectedPath: params.get("startupErrorPath") ?? undefined,
    workspaceRoot: params.get("workspaceRoot") ?? undefined
  };
}

export function classifyDesktopStartupError(
  error: unknown,
  workspaceRoot?: string
): DesktopStartupError {
  const message =
    error instanceof Error ? error.message : "Unknown desktop startup error.";
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("workspace runtime") ||
    normalizedMessage.includes("runtime launcher") ||
    normalizedMessage.includes("timed out waiting for workspace runtime")
  ) {
    return {
      code: "runtime_bootstrap_failed",
      message,
      workspaceRoot
    };
  }

  return {
    code: "initial_query_failed",
    message,
    workspaceRoot
  };
}
