import { BrowserWindow, ipcMain } from "electron";
import type {
  CreateRuntimeTaskInput,
  UpdateRuntimeTaskInput,
  TaskDetailDto,
  TaskSummaryDto,
  WorkspaceRuntimeEvent
} from "@tasks-dispatcher/core/contracts";
import {
  createWorkspaceRuntimeClient,
  type RuntimeLaunchTarget
} from "@tasks-dispatcher/workspace-runtime/client";
import { TASK_BOARD_CHANNELS } from "../../shared/ipcChannels.js";

export function registerTaskIpcHandlers(
  workspaceRoot: string,
  runtimeLaunchTarget?: RuntimeLaunchTarget
): void {
  const runtimeClientPromise = createWorkspaceRuntimeClient(workspaceRoot, {
    launchTarget: runtimeLaunchTarget
  });
  const keepAliveInterval = setInterval(() => {
    void runtimeClientPromise
      .then((client) => client.ping())
      .catch(() => {});
  }, 2_000);

  void runtimeClientPromise
    .then(async (client) => {
      await client.subscribe((event: WorkspaceRuntimeEvent) => {
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send(TASK_BOARD_CHANNELS.runtimeEvent, event);
        }
      });
    })
    .catch(() => {
      // Initial bootstrap failures are surfaced through the IPC handlers and renderer state.
    });

  if (typeof keepAliveInterval.unref === "function") {
    keepAliveInterval.unref();
  }

  ipcMain.handle(TASK_BOARD_CHANNELS.ping, async () => {
    const client = await runtimeClientPromise;
    return client.ping();
  });

  ipcMain.handle(TASK_BOARD_CHANNELS.getWorkspaceInfo, async () => ({
    workspaceRoot
  }));

  ipcMain.handle(TASK_BOARD_CHANNELS.listTasks, async (): Promise<TaskSummaryDto[]> => {
    const client = await runtimeClientPromise;
    return client.listTasks();
  });

  ipcMain.handle(
    TASK_BOARD_CHANNELS.getTask,
    async (_event, taskId: string): Promise<TaskDetailDto | null> => {
      const client = await runtimeClientPromise;
      return client.getTask(taskId);
    }
  );

  ipcMain.handle(
    TASK_BOARD_CHANNELS.createTask,
    async (_event, input: CreateRuntimeTaskInput): Promise<TaskDetailDto> => {
      const client = await runtimeClientPromise;
      return client.createTask(input);
    }
  );

  ipcMain.handle(
    TASK_BOARD_CHANNELS.updateTask,
    async (
      _event,
      taskId: string,
      input: UpdateRuntimeTaskInput
    ): Promise<TaskDetailDto> => {
      const client = await runtimeClientPromise;
      return client.updateTask(taskId, input);
    }
  );

  ipcMain.handle(
    TASK_BOARD_CHANNELS.queueTask,
    async (_event, taskId: string): Promise<TaskDetailDto> => {
      const client = await runtimeClientPromise;
      return client.queueTask(taskId);
    }
  );

  ipcMain.handle(
    TASK_BOARD_CHANNELS.reopenTask,
    async (_event, taskId: string): Promise<TaskDetailDto> => {
      const client = await runtimeClientPromise;
      return client.reopenTask(taskId);
    }
  );

  ipcMain.handle(
    TASK_BOARD_CHANNELS.archiveTask,
    async (_event, taskId: string): Promise<TaskDetailDto> => {
      const client = await runtimeClientPromise;
      return client.archiveTask(taskId);
    }
  );

  ipcMain.handle(
    TASK_BOARD_CHANNELS.abortTask,
    async (_event, taskId: string): Promise<TaskDetailDto> => {
      const client = await runtimeClientPromise;
      return client.abortTask(taskId);
    }
  );

  ipcMain.handle(
    TASK_BOARD_CHANNELS.readAttemptLog,
    async (_event, taskId: string, attemptId: string): Promise<string> => {
      try {
        const client = await runtimeClientPromise;
        return client.readAttemptLog(taskId, attemptId);
      } catch {
        return "";
      }
    }
  );
}
