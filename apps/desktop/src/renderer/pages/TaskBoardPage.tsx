import { useEffect, useRef, useState } from "react";
import type {
  CreateRuntimeTaskInput,
  TaskDetailDto,
  TaskSummaryDto,
  WorkspaceRuntimeEvent
} from "@tasks-dispatcher/core/contracts";
import { BOARD_COLUMNS, mapTaskStateToBoardColumn, sortBoardTasks } from "../board/boardModel.js";
import { CreateTaskModal } from "../components/CreateTaskModal.js";
import { DesktopStartupErrorState } from "../components/DesktopStartupErrorState.js";
import { TaskBoardColumn } from "../components/TaskBoardColumn.js";
import { TaskDetailModal } from "../components/TaskDetailModal.js";
import { TaskSessionDetailModal } from "../components/TaskSessionDetailModal.js";
import {
  classifyDesktopStartupError,
  type DesktopStartupError
} from "../startup/desktopStartup.js";

function toSummaryFromDetail(task: TaskDetailDto): TaskSummaryDto {
  const currentAttempt =
    task.attempts.find((attempt) => attempt.id === task.currentAttemptId) ?? null;

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    state: task.state,
    agent: task.agent,
    updatedAt: task.updatedAt,
    currentAttemptId: task.currentAttemptId,
    currentAttemptTerminationReason: currentAttempt?.terminationReason ?? null
  };
}

function upsertTaskSummary(
  tasks: TaskSummaryDto[],
  nextTask: TaskSummaryDto
): TaskSummaryDto[] {
  const otherTasks = tasks.filter((task) => task.id !== nextTask.id);
  return sortBoardTasks([nextTask, ...otherTasks]);
}

export function TaskBoardPage() {
  const [workspaceRoot, setWorkspaceRoot] = useState("loading...");
  const [tasks, setTasks] = useState<TaskSummaryDto[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskDetailDto | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSessionLog, setSelectedSessionLog] = useState("");
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [sessionDetailOpen, setSessionDetailOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [startupError, setStartupError] = useState<DesktopStartupError | null>(null);
  const selectedTaskIdRef = useRef<string | null>(null);
  const selectedSessionIdRef = useRef<string | null>(null);

  const selectedAttempt =
    selectedTask?.attempts.find((attempt) => attempt.id === selectedSessionId) ?? null;

  async function refreshTasks(): Promise<void> {
    const nextTasks = await window.taskBoardApi.listTasks();
    setTasks(sortBoardTasks(nextTasks));
  }

  async function refreshTask(taskId: string | null): Promise<TaskDetailDto | null> {
    if (!taskId) {
      setSelectedTask(null);
      return null;
    }

    const task = await window.taskBoardApi.getTask(taskId);
    setSelectedTask(task);

    if (task) {
      setTasks((currentTasks) => upsertTaskSummary(currentTasks, toSummaryFromDetail(task)));
    }

    return task;
  }

  async function refreshSessionLog(
    taskId: string | null,
    attemptId: string | null
  ): Promise<void> {
    if (!taskId || !attemptId) {
      setSelectedSessionLog("");
      return;
    }

    try {
      const nextLog = await window.taskBoardApi.readAttemptLog(taskId, attemptId);
      setSelectedSessionLog(nextLog);
    } catch {
      setSelectedSessionLog("");
    }
  }

  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const { workspaceRoot: root } = await window.taskBoardApi.getWorkspaceInfo();

        if (cancelled) {
          return;
        }

        setWorkspaceRoot(root);
        await refreshTasks();
        unsubscribe = window.taskBoardApi.subscribe((event: WorkspaceRuntimeEvent) => {
          if (event.type === "task.updated" && event.task) {
            setTasks((currentTasks) =>
              upsertTaskSummary(currentTasks, toSummaryFromDetail(event.task!))
            );

            if (event.taskId === selectedTaskIdRef.current) {
              setSelectedTask(event.task);
            }
          }

          if (
            event.type === "task.log" &&
            event.taskId === selectedTaskIdRef.current &&
            event.attemptId === selectedSessionIdRef.current &&
            event.chunk
          ) {
            setSelectedSessionLog((currentLog) => `${currentLog}${event.chunk}`);
          }
        });
        setStartupError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setStartupError(classifyDesktopStartupError(error));
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const hasExecutingTasks =
      tasks.some((task) => task.state === "executing") || selectedTask?.state === "executing";

    if (!hasExecutingTasks) {
      return;
    }

    const intervalId = setInterval(() => {
      void refreshTasks().catch((error) => {
        setStartupError(classifyDesktopStartupError(error, workspaceRoot));
      });

      if (selectedTaskIdRef.current) {
        void refreshTask(selectedTaskIdRef.current).catch((error) => {
          setStartupError(classifyDesktopStartupError(error, workspaceRoot));
        });
      }

      if (selectedTaskIdRef.current && selectedSessionIdRef.current) {
        void refreshSessionLog(
          selectedTaskIdRef.current,
          selectedSessionIdRef.current
        ).catch((error) => {
          setStartupError(classifyDesktopStartupError(error, workspaceRoot));
        });
      }
    }, 1_500);

    return () => {
      clearInterval(intervalId);
    };
  }, [tasks, selectedTask?.state, workspaceRoot]);

  async function createTask(input: CreateRuntimeTaskInput): Promise<void> {
    const task = await window.taskBoardApi.createTask(input);
    setTasks((currentTasks) => upsertTaskSummary(currentTasks, toSummaryFromDetail(task)));
  }

  async function openTaskDetails(taskId: string): Promise<void> {
    setSelectedTaskId(taskId);
    setTaskDetailOpen(true);
    setSessionDetailOpen(false);
    setSelectedSessionId(null);
    setSelectedSessionLog("");

    try {
      await refreshTask(taskId);
    } catch (error) {
      setStartupError(classifyDesktopStartupError(error, workspaceRoot));
    }
  }

  async function openSessionDetails(attemptId: string): Promise<void> {
    if (!selectedTaskId) {
      return;
    }

    setSelectedSessionId(attemptId);
    setSessionDetailOpen(true);
    await refreshSessionLog(selectedTaskId, attemptId);
  }

  function closeTaskDetails(): void {
    setTaskDetailOpen(false);
    setSelectedTaskId(null);
    setSelectedTask(null);
    setSelectedSessionId(null);
    setSelectedSessionLog("");
    setSessionDetailOpen(false);
  }

  function closeSessionDetails(): void {
    setSessionDetailOpen(false);
    setSelectedSessionId(null);
    setSelectedSessionLog("");
  }

  async function runTaskAction(
    taskId: string,
    action: (taskId: string) => Promise<TaskDetailDto>
  ): Promise<void> {
    const task = await action(taskId);
    setTasks((currentTasks) => upsertTaskSummary(currentTasks, toSummaryFromDetail(task)));

    if (selectedTaskIdRef.current === taskId) {
      setSelectedTask(task);

      if (
        selectedSessionIdRef.current &&
        selectedSessionIdRef.current === task.currentAttemptId
      ) {
        await refreshSessionLog(task.id, selectedSessionIdRef.current);
      }
    }
  }

  if (startupError) {
    return <DesktopStartupErrorState error={startupError} />;
  }

  const groupedTasks = BOARD_COLUMNS.map((column) => ({
    ...column,
    tasks: sortBoardTasks(
      tasks.filter((task) => mapTaskStateToBoardColumn(task.state) === column.key)
    )
  }));

  return (
    <main className="min-h-screen min-w-[1200px] overflow-x-auto bg-base-200 px-3 py-4">
      <div className="flex w-full flex-col gap-4">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              Tasks Dispatcher
            </p>
            <h1 className="text-4xl font-black tracking-tight">Agent Task Board</h1>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setCreateModalOpen(true)}
            type="button"
          >
            Add Task
          </button>
        </header>

        <section className="grid min-w-[1200px] grid-cols-6 gap-3">
          {groupedTasks.map((column) => (
            <TaskBoardColumn
              key={column.key}
              title={column.title}
              tasks={column.tasks}
              onOpenDetails={openTaskDetails}
              onQueue={(taskId) => runTaskAction(taskId, window.taskBoardApi.queueTask)}
              onReopen={(taskId) => runTaskAction(taskId, window.taskBoardApi.reopenTask)}
              onArchive={(taskId) => runTaskAction(taskId, window.taskBoardApi.archiveTask)}
              onAbort={(taskId) => runTaskAction(taskId, window.taskBoardApi.abortTask)}
            />
          ))}
        </section>
      </div>

      <CreateTaskModal
        onClose={() => setCreateModalOpen(false)}
        onCreate={createTask}
        open={createModalOpen}
      />

      <TaskDetailModal
        onAbort={() =>
          selectedTaskId ? runTaskAction(selectedTaskId, window.taskBoardApi.abortTask) : Promise.resolve()
        }
        onArchive={() =>
          selectedTaskId ? runTaskAction(selectedTaskId, window.taskBoardApi.archiveTask) : Promise.resolve()
        }
        onClose={closeTaskDetails}
        onOpenSessionDetails={openSessionDetails}
        onQueue={() =>
          selectedTaskId ? runTaskAction(selectedTaskId, window.taskBoardApi.queueTask) : Promise.resolve()
        }
        onReopen={() =>
          selectedTaskId ? runTaskAction(selectedTaskId, window.taskBoardApi.reopenTask) : Promise.resolve()
        }
        open={taskDetailOpen}
        task={selectedTask}
      />

      <TaskSessionDetailModal
        attempt={selectedAttempt}
        isCurrentAttempt={selectedTask?.currentAttemptId === selectedAttempt?.id}
        log={selectedSessionLog}
        onClose={closeSessionDetails}
        open={sessionDetailOpen}
      />
    </main>
  );
}
