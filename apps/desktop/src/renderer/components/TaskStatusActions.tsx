import type { TaskDetailDto } from "@tasks-dispatcher/core/contracts";

interface TaskStatusActionsProps {
  task: TaskDetailDto;
  onQueue: () => Promise<void>;
  onReopen: () => Promise<void>;
  onArchive: () => Promise<void>;
  onAbort: () => Promise<void>;
}

export function TaskStatusActions({
  task,
  onQueue,
  onReopen,
  onArchive,
  onAbort
}: TaskStatusActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {(task.state === "initializing" ||
        task.state === "reopened" ||
        task.state === "execution_failed") && (
        <button className="btn btn-primary btn-sm" onClick={() => void onQueue()} type="button">
          Queue
        </button>
      )}

      {(task.state === "pending_validation" || task.state === "execution_failed") && (
        <button className="btn btn-secondary btn-sm" onClick={() => void onReopen()} type="button">
          Reopen
        </button>
      )}

      {task.state === "pending_validation" && (
        <button className="btn btn-success btn-sm" onClick={() => void onArchive()} type="button">
          Archive
        </button>
      )}

      {task.state === "executing" && (
        <button className="btn btn-error btn-sm" onClick={() => void onAbort()} type="button">
          Abort
        </button>
      )}
    </div>
  );
}

