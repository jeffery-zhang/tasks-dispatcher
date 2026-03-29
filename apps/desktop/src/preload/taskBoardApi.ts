import { contextBridge, ipcRenderer } from "electron";
import type {
  CreateRuntimeTaskInput,
  TaskDetailDto,
  TaskSummaryDto,
  WorkspaceRuntimeEvent
} from "@tasks-dispatcher/core/contracts";
import { TASK_BOARD_CHANNELS } from "../shared/ipcChannels.js";

const taskBoardApi = {
  ping: () => ipcRenderer.invoke(TASK_BOARD_CHANNELS.ping) as Promise<string>,
  getWorkspaceInfo: () =>
    ipcRenderer.invoke(TASK_BOARD_CHANNELS.getWorkspaceInfo) as Promise<{
      workspaceRoot: string;
    }>,
  listTasks: () =>
    ipcRenderer.invoke(TASK_BOARD_CHANNELS.listTasks) as Promise<TaskSummaryDto[]>,
  getTask: (taskId: string) =>
    ipcRenderer.invoke(TASK_BOARD_CHANNELS.getTask, taskId) as Promise<
      TaskDetailDto | null
    >,
  createTask: (input: CreateRuntimeTaskInput) =>
    ipcRenderer.invoke(TASK_BOARD_CHANNELS.createTask, input) as Promise<TaskDetailDto>,
  queueTask: (taskId: string) =>
    ipcRenderer.invoke(TASK_BOARD_CHANNELS.queueTask, taskId) as Promise<TaskDetailDto>,
  reopenTask: (taskId: string) =>
    ipcRenderer.invoke(TASK_BOARD_CHANNELS.reopenTask, taskId) as Promise<
      TaskDetailDto
    >,
  archiveTask: (taskId: string) =>
    ipcRenderer.invoke(TASK_BOARD_CHANNELS.archiveTask, taskId) as Promise<
      TaskDetailDto
    >,
  abortTask: (taskId: string) =>
    ipcRenderer.invoke(TASK_BOARD_CHANNELS.abortTask, taskId) as Promise<TaskDetailDto>,
  readAttemptLog: (taskId: string, attemptId: string) =>
    ipcRenderer.invoke(
      TASK_BOARD_CHANNELS.readAttemptLog,
      taskId,
      attemptId
    ) as Promise<string>,
  subscribe: (listener: (event: WorkspaceRuntimeEvent) => void) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: WorkspaceRuntimeEvent
    ) => {
      listener(payload);
    };

    ipcRenderer.on(TASK_BOARD_CHANNELS.runtimeEvent, wrapped);

    return () => {
      ipcRenderer.off(TASK_BOARD_CHANNELS.runtimeEvent, wrapped);
    };
  }
};

contextBridge.exposeInMainWorld("taskBoardApi", taskBoardApi);

export type TaskBoardApi = typeof taskBoardApi;
