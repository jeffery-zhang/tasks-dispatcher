import type { TaskSummaryDto } from "@tasks-dispatcher/core/contracts";
import { TaskCard } from "./TaskCard.js";

interface TaskBoardColumnProps {
  title: string;
  tasks: TaskSummaryDto[];
  onOpenDetails: (taskId: string) => void;
  onEdit: (taskId: string) => Promise<void>;
  onQueue: (taskId: string) => Promise<void>;
  onReopen: (taskId: string) => Promise<void>;
  onArchive: (taskId: string) => Promise<void>;
  onAbort: (taskId: string) => Promise<void>;
}

export function TaskBoardColumn({
  title,
  tasks,
  onOpenDetails,
  onEdit,
  onQueue,
  onReopen,
  onArchive,
  onAbort
}: TaskBoardColumnProps) {
  return (
    <section className="flex min-h-[28rem] flex-col rounded-box border border-base-300 bg-base-200/50">
      <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-base-content/70">
          {title}
        </h2>
        <span className="badge badge-outline">{tasks.length}</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {tasks.length === 0 ? (
          <div className="rounded-box border border-dashed border-base-300 p-4 text-sm text-base-content/45">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpenDetails={onOpenDetails}
              onEdit={onEdit}
              onQueue={onQueue}
              onReopen={onReopen}
              onArchive={onArchive}
              onAbort={onAbort}
            />
          ))
        )}
      </div>
    </section>
  );
}
