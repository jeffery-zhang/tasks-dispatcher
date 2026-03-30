import type { TaskDetailDto } from "@tasks-dispatcher/core/contracts";
import { formatTerminationReason } from "../board/failureLabels.js";

interface TaskSessionListProps {
  attempts: TaskDetailDto["attempts"];
  onOpenSessionDetails: (attemptId: string) => void;
}

export function TaskSessionList({
  attempts,
  onOpenSessionDetails
}: TaskSessionListProps) {
  const orderedAttempts = [...attempts].reverse();

  return (
    <div className="space-y-3">
      {orderedAttempts.map((attempt) => (
        <article
          key={attempt.id}
          className="flex items-center justify-between gap-3 rounded-box border border-base-300 bg-base-200/40 p-4"
        >
          <div className="min-w-0">
            <h4 className="truncate font-medium">{attempt.id}</h4>
            <p className="mt-1 text-sm text-base-content/65">
              {attempt.status} / {attempt.stage}
            </p>
            {attempt.terminationReason ? (
              <p className="mt-1 text-xs text-base-content/50">
                {formatTerminationReason(attempt.terminationReason)}
              </p>
            ) : null}
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => onOpenSessionDetails(attempt.id)}
            type="button"
          >
            Details
          </button>
        </article>
      ))}
    </div>
  );
}
