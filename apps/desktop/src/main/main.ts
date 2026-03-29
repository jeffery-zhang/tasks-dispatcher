import { app, BrowserWindow, dialog } from "electron";
import { fileURLToPath } from "node:url";
import { registerTaskIpcHandlers } from "./ipc/taskIpcHandlers.js";
import {
  DesktopBootstrapResolutionError,
  resolveDesktopBootstrapArtifacts
} from "./bootstrap/resolveDesktopBootstrapArtifacts.js";

interface StartupErrorQuery {
  code: string;
  message: string;
  expectedPath?: string;
}

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

function buildStartupQuery(startupError?: StartupErrorQuery): Record<string, string> {
  if (!startupError) {
    return {};
  }

  return {
    startupErrorCode: startupError.code,
    startupErrorMessage: startupError.message,
    ...(startupError.expectedPath
      ? { startupErrorPath: startupError.expectedPath }
      : {})
  };
}

function createMainWindow(options?: {
  preloadPath?: string;
  startupError?: StartupErrorQuery;
}): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 720,
    webPreferences: {
      ...(options?.preloadPath ? { preload: options.preloadPath } : {}),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? null;
  const startupQuery = buildStartupQuery(options?.startupError);

  if (rendererUrl) {
    const url = new URL(rendererUrl);

    for (const [key, value] of Object.entries(startupQuery)) {
      url.searchParams.set(key, value);
    }

    void mainWindow.loadURL(url.toString());
  } else {
    void mainWindow.loadFile(
      fileURLToPath(new URL("../renderer/index.html", import.meta.url)),
      Object.keys(startupQuery).length > 0 ? { query: startupQuery } : undefined
    );
  }

  return mainWindow;
}

void app.whenReady().then(() => {
  let handlersRegistered = false;
  let bootstrapArtifacts:
    | ReturnType<typeof resolveDesktopBootstrapArtifacts>
    | null = null;
  let startupError: StartupErrorQuery | undefined;

  try {
    bootstrapArtifacts = resolveDesktopBootstrapArtifacts(__dirname);
  } catch (error) {
    if (!(error instanceof DesktopBootstrapResolutionError)) {
      throw error;
    }

    startupError = {
      code: error.code,
      message: error.message,
      expectedPath: error.expectedPath
    };
  }

  void (async () => {
    if (startupError) {
      createMainWindow({ startupError });
      return;
    }

    const workspaceRoot = await chooseWorkspaceRoot();

    if (!workspaceRoot) {
      app.quit();
      return;
    }

    if (!handlersRegistered) {
      registerTaskIpcHandlers(workspaceRoot, bootstrapArtifacts!.runtimeLaunchTarget);
      handlersRegistered = true;
    }

    createMainWindow({ preloadPath: bootstrapArtifacts!.preloadPath });
  })();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void (async () => {
        if (startupError) {
          createMainWindow({ startupError });
          return;
        }

        const workspaceRoot = await chooseWorkspaceRoot();

        if (!workspaceRoot) {
          return;
        }

        if (!handlersRegistered) {
          registerTaskIpcHandlers(workspaceRoot, bootstrapArtifacts!.runtimeLaunchTarget);
          handlersRegistered = true;
        }

        createMainWindow({ preloadPath: bootstrapArtifacts!.preloadPath });
      })();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
