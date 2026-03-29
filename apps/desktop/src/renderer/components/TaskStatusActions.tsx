import type { TaskDetailDto } from "@tasks-dispatcher/core/contracts";

interface TaskStatusActionsProps {
  state: TaskDetailDto["state"];
  onQueue: () => Promise<void>;
  onReopen: () => Promise<void>;
  onArchive: () => Promise<void>;
  onAbort: () => Promise<void>;
}

export function TaskStatusActions({
  state,
  onQueue,
  onReopen,
  onArchive,
  onAbort
}: TaskStatusActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {(state === "initializing" ||
        state === "reopened" ||
        state === "execution_failed") && (
        <button className="btn btn-primary btn-sm" onClick={() => void onQueue()} type="button">
          Queue
        </button>
      )}

      {(state === "pending_validation" || state === "execution_failed") && (
        <button className="btn btn-secondary btn-sm" onClick={() => void onReopen()} type="button">
          Reopen
        </button>
      )}

      {state === "pending_validation" && (
        <button className="btn btn-success btn-sm" onClick={() => void onArchive()} type="button">
          Archive
        </button>
      )}

      {state === "executing" && (
        <button className="btn btn-error btn-sm" onClick={() => void onAbort()} type="button">
          Abort
        </button>
      )}
    </div>
  );
}
