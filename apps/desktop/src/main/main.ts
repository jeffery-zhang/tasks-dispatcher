import { app, BrowserWindow, dialog } from "electron";
import { join } from "node:path";
import { registerTaskIpcHandlers } from "./ipc/taskIpcHandlers.js";

async function chooseWorkspaceRoot(): Promise<string | null> {
  if (process.env.TASKS_DISPATCHER_WORKSPACE) {
    return process.env.TASKS_DISPATCHER_WORKSPACE;
  }

  const result = await dialog.showOpenDialog({
    title: "Select a workspace for Tasks Dispatcher",
    properties: ["openDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0] ?? null;
}

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 720,
    webPreferences: {
      preload: join(__dirname, "../preload/taskBoardApi.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? null;

  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return mainWindow;
}

void app.whenReady().then(() => {
  let handlersRegistered = false;

  void (async () => {
    const workspaceRoot = await chooseWorkspaceRoot();

    if (!workspaceRoot) {
      app.quit();
      return;
    }

    if (!handlersRegistered) {
      registerTaskIpcHandlers(workspaceRoot);
      handlersRegistered = true;
    }

    createMainWindow();
  })();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void (async () => {
        const workspaceRoot = await chooseWorkspaceRoot();

        if (!workspaceRoot) {
          return;
        }

        if (!handlersRegistered) {
          registerTaskIpcHandlers(workspaceRoot);
          handlersRegistered = true;
        }

        createMainWindow();
      })();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
