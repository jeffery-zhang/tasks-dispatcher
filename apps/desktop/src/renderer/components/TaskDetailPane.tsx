import type { TaskDetailDto } from "@tasks-dispatcher/core/contracts";
import { TaskStatusActions } from "./TaskStatusActions.js";

interface TaskDetailPaneProps {
  workspaceRoot: string;
  task: TaskDetailDto | null;
  onEdit: () => Promise<void>;
  onQueue: () => Promise<void>;
  onReopen: () => Promise<void>;
  onArchive: () => Promise<void>;
  onAbort: () => Promise<void>;
}

export function TaskDetailPane({
  workspaceRoot,
  task,
  onEdit,
  onQueue,
  onReopen,
  onArchive,
  onAbort
}: TaskDetailPaneProps) {
  if (!task) {
    return (
      <section className="card min-h-[20rem] bg-base-100 shadow-lg">
        <div className="card-body justify-center">
          <p className="text-sm text-base-content/60">
            Select a task to inspect its lifecycle, attempts, and log output.
          </p>
          <p className="text-xs text-base-content/40">Workspace: {workspaceRoot}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card bg-base-100 shadow-lg">
      <div className="card-body gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-base-content/50">
              {workspaceRoot}
            </p>
            <h2 className="text-2xl font-black tracking-tight">{task.title}</h2>
            <p className="mt-2 text-sm text-base-content/70">{task.description}</p>
          </div>
          <div className="space-y-2 text-right">
            <div className="badge badge-outline badge-primary">{task.state}</div>
            {task.currentStepAgent ? (
              <div className="text-xs uppercase tracking-[0.14em] text-base-content/50">
                {task.currentStepAgent}
              </div>
            ) : null}
          </div>
        </div>

        <TaskStatusActions
          state={task.state}
          onEdit={onEdit}
          onQueue={onQueue}
          onReopen={onReopen}
          onArchive={onArchive}
          onAbort={onAbort}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-box border border-base-300 bg-base-200/40 p-4">
            <h3 className="font-semibold">Workflow</h3>
            <p className="mt-2 text-sm text-base-content/70">{task.workflowLabel}</p>
          </article>
          <article className="rounded-box border border-base-300 bg-base-200/40 p-4">
            <h3 className="font-semibold">Current Attempt</h3>
            {task.attempts.at(-1) ? (
              <div className="mt-2 space-y-1 text-sm text-base-content/70">
                <p>ID: {task.attempts.at(-1)?.id}</p>
                <p>Status: {task.attempts.at(-1)?.status}</p>
                <p>Current step: {task.attempts.at(-1)?.currentStepKey ?? "n/a"}</p>
                <p>Termination: {task.attempts.at(-1)?.terminationReason ?? "n/a"}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-base-content/60">No attempts yet.</p>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
