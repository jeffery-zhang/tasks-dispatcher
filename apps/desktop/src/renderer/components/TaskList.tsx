import type { TaskSummaryDto } from "@tasks-dispatcher/core/contracts";

interface TaskListProps {
  tasks: TaskSummaryDto[];
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
}

export function TaskList({ tasks, selectedTaskId, onSelect }: TaskListProps) {
  return (
    <section className="card min-h-[32rem] bg-base-100 shadow-lg">
      <div className="card-body gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Tasks</h2>
          <span className="badge badge-outline">{tasks.length}</span>
        </div>

        <div className="space-y-2 overflow-y-auto">
          {tasks.length === 0 ? (
            <div className="rounded-box border border-dashed border-base-300 p-6 text-sm text-base-content/60">
              No tasks yet in this workspace.
            </div>
          ) : (
            tasks.map((task) => {
              const selected = task.id === selectedTaskId;

              return (
                <button
                  key={task.id}
                  className={[
                    "w-full rounded-box border p-4 text-left transition",
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-base-300 bg-base-200/40 hover:border-primary/40"
                  ].join(" ")}
                  onClick={() => onSelect(task.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{task.title}</h3>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-base-content/50">
                        {task.agent}
                      </p>
                    </div>
                    <span className="badge badge-outline">{task.state}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

