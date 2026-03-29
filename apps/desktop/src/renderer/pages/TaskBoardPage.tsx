import { useEffect, useState } from "react";
import type {
  CreateRuntimeTaskInput,
  TaskDetailDto,
  TaskSummaryDto,
  WorkspaceRuntimeEvent
} from "@tasks-dispatcher/core/contracts";
import { TaskComposer } from "../components/TaskComposer.js";
import { TaskDetailPane } from "../components/TaskDetailPane.js";
import { TaskList } from "../components/TaskList.js";
import { TaskLogStream } from "../components/TaskLogStream.js";

export function TaskBoardPage() {
  const [workspaceRoot, setWorkspaceRoot] = useState("loading...");
  const [tasks, setTasks] = useState<TaskSummaryDto[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskDetailDto | null>(null);
  const [log, setLog] = useState("");

  async function refreshTasks(): Promise<void> {
    const nextTasks = await window.taskBoardApi.listTasks();

    setTasks(nextTasks);
    setSelectedTaskId((currentSelectedTaskId) => {
      if (currentSelectedTaskId) {
        return currentSelectedTaskId;
      }

      return nextTasks[0]?.id ?? null;
    });
  }

  async function refreshTask(taskId: string | null): Promise<void> {
    if (!taskId) {
      setSelectedTask(null);
      setLog("");
      return;
    }

    const task = await window.taskBoardApi.getTask(taskId);

    setSelectedTask(task);

    if (!task?.attempts.at(-1)) {
      setLog("");
      return;
    }

    const latestAttempt = task.attempts.at(-1)!;

    try {
      const nextLog = await window.taskBoardApi.readAttemptLog(taskId, latestAttempt.id);
      setLog(nextLog);
    } catch {
      setLog("");
    }
  }

  useEffect(() => {
    void window.taskBoardApi.getWorkspaceInfo().then(({ workspaceRoot: root }) => {
      setWorkspaceRoot(root);
    });
    void refreshTasks();

    const unsubscribe = window.taskBoardApi.subscribe((event: WorkspaceRuntimeEvent) => {
      if (event.type === "task.updated" && event.task) {
        const task = event.task;

        setTasks((currentTasks) => {
          const nextTasks = currentTasks.filter((task) => task.id !== event.taskId);

          nextTasks.unshift({
            id: task.id,
            title: task.title,
            state: task.state,
            agent: task.agent,
            updatedAt: task.updatedAt,
            currentAttemptId: task.currentAttemptId
          });

          return nextTasks;
        });

        if (event.taskId === selectedTaskId) {
          setSelectedTask(task);
        }
      }

      if (event.type === "task.log" && event.taskId === selectedTaskId && event.chunk) {
        setLog((currentLog) => `${currentLog}${event.chunk}`);
      }
    });

    return unsubscribe;
  }, [selectedTaskId]);

  useEffect(() => {
    void refreshTask(selectedTaskId);
  }, [selectedTaskId]);

  async function createTask(input: CreateRuntimeTaskInput): Promise<void> {
    const task = await window.taskBoardApi.createTask(input);
    setSelectedTaskId(task.id);
    await refreshTasks();
    await refreshTask(task.id);
  }

  async function runTaskAction(
    action: (taskId: string) => Promise<TaskDetailDto>
  ): Promise<void> {
    if (!selectedTaskId) {
      return;
    }

    const task = await action(selectedTaskId);
    setSelectedTask(task);
    await refreshTasks();
    await refreshTask(task.id);
  }

  return (
    <main className="min-h-screen bg-base-200 p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              Tasks Dispatcher
            </p>
            <h1 className="text-4xl font-black tracking-tight">Agent Task Board</h1>
          </div>
          <div className="rounded-box border border-base-300 bg-base-100 px-4 py-3 text-sm text-base-content/70">
            Workspace: <span className="font-medium text-base-content">{workspaceRoot}</span>
          </div>
        </header>

        <TaskComposer onCreate={createTask} />

        <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <TaskList
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onSelect={setSelectedTaskId}
          />

          <div className="grid gap-6">
            <TaskDetailPane
              workspaceRoot={workspaceRoot}
              task={selectedTask}
              onQueue={() => runTaskAction(window.taskBoardApi.queueTask)}
              onReopen={() => runTaskAction(window.taskBoardApi.reopenTask)}
              onArchive={() => runTaskAction(window.taskBoardApi.archiveTask)}
              onAbort={() => runTaskAction(window.taskBoardApi.abortTask)}
            />
            <TaskLogStream log={log} />
          </div>
        </div>
      </div>
    </main>
  );
}
