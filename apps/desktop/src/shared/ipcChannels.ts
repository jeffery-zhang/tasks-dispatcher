export const TASK_BOARD_CHANNELS = {
  ping: "task-board:ping",
  getWorkspaceInfo: "task-board:get-workspace-info",
  listTasks: "task-board:list-tasks",
  getTask: "task-board:get-task",
  createTask: "task-board:create-task",
  queueTask: "task-board:queue-task",
  reopenTask: "task-board:reopen-task",
  archiveTask: "task-board:archive-task",
  abortTask: "task-board:abort-task",
  readAttemptLog: "task-board:read-attempt-log",
  runtimeEvent: "task-board:runtime-event"
} as const;

