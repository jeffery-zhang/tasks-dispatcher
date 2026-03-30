import type { TaskAttemptTerminationReason } from "@tasks-dispatcher/core";

export function formatTerminationReason(
  reason: TaskAttemptTerminationReason | null
): string {
  if (!reason) {
    return "n/a";
  }

  return reason
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
