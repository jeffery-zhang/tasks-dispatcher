import type { TaskDetailDto } from "@tasks-dispatcher/core/contracts";
import { OverlayModal } from "./OverlayModal.js";
import { TaskSessionList } from "./TaskSessionList.js";
import { TaskStatusActions } from "./TaskStatusActions.js";

interface TaskDetailModalProps {
  task: TaskDetailDto | null;
  open: boolean;
  onClose: () => void;
  onOpenSessionDetails: (attemptId: string) => void;
  onQueue: () => Promise<void>;
  onReopen: () => Promise<void>;
  onArchive: () => Promise<void>;
  onAbort: () => Promise<void>;
}

export function TaskDetailModal({
  task,
  open,
  onClose,
  onOpenSessionDetails,
  onQueue,
  onReopen,
  onArchive,
  onAbort
}: TaskDetailModalProps) {
  if (!task) {
    return null;
  }

  const hasAttempts = task.attempts.length > 0;

  return (
    <OverlayModal onClose={onClose} open={open} title={task.title}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <span className="badge badge-outline">{task.state}</span>
            <p className="text-sm text-base-content/70">{task.description}</p>
          </div>
          <TaskStatusActions
            state={task.state}
            onQueue={onQueue}
            onReopen={onReopen}
            onArchive={onArchive}
            onAbort={onAbort}
          />
        </div>

        <article className="rounded-box border border-base-300 bg-base-200/40 p-4">
          <h3 className="font-semibold">Workflow</h3>
          <p className="mt-2 text-sm text-base-content/70">{task.workflowLabel}</p>
        </article>

        {hasAttempts ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Sessions</h3>
              <span className="badge badge-outline">{task.attempts.length}</span>
            </div>
            <TaskSessionList
              attempts={task.attempts}
              onOpenSessionDetails={onOpenSessionDetails}
            />
          </section>
        ) : (
          <section className="rounded-box border border-dashed border-base-300 p-4 text-sm text-base-content/60">
            No session history yet. This task has not been picked up by an agent.
          </section>
        )}
      </div>
    </OverlayModal>
  );
}
