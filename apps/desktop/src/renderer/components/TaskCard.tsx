import type { TaskSummaryDto } from "@tasks-dispatcher/core/contracts";
import { TaskStatusActions } from "./TaskStatusActions.js";
import { formatTerminationReason } from "../board/failureLabels.js";

interface TaskCardProps {
  task: TaskSummaryDto;
  onOpenDetails: (taskId: string) => void;
  onEdit: (taskId: string) => Promise<void>;
  onQueue: (taskId: string) => Promise<void>;
  onReopen: (taskId: string) => Promise<void>;
  onArchive: (taskId: string) => Promise<void>;
  onAbort: (taskId: string) => Promise<void>;
}

export function TaskCard({
  task,
  onOpenDetails,
  onEdit,
  onQueue,
  onReopen,
  onArchive,
  onAbort
}: TaskCardProps) {
  const failureReason =
    task.state === "failed"
      ? formatTerminationReason(task.currentAttemptTerminationReason)
      : null;

  return (
    <article className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold">{task.title}</h3>
        <span className="badge badge-outline">{task.state}</span>
      </div>

      <p
        className="mt-3 text-sm text-base-content/70"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 3,
          overflow: "hidden"
        }}
      >
        {task.description}
      </p>

      {failureReason ? (
        <div className="mt-3">
          <span className="badge badge-error badge-soft">{failureReason}</span>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          className="btn btn-outline btn-sm"
          onClick={() => onOpenDetails(task.id)}
          type="button"
        >
          Details
        </button>

        <TaskStatusActions
          state={task.state}
          onEdit={() => onEdit(task.id)}
          onQueue={() => onQueue(task.id)}
          onReopen={() => onReopen(task.id)}
          onArchive={() => onArchive(task.id)}
          onAbort={() => onAbort(task.id)}
        />
      </div>
    </article>
  );
}
