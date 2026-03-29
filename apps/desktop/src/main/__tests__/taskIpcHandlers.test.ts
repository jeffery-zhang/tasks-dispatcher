import { beforeEach, describe, expect, it, vi } from "vitest";

const handle = vi.fn();
const send = vi.fn();
const createWorkspaceRuntimeClient = vi.fn();

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: () => [
      {
        webContents: { send }
      }
    ]
  },
  ipcMain: {
    handle
  }
}));

vi.mock("@tasks-dispatcher/workspace-runtime/client", () => ({
  createWorkspaceRuntimeClient
}));

describe("registerTaskIpcHandlers", () => {
  beforeEach(() => {
    handle.mockReset();
    send.mockReset();
    createWorkspaceRuntimeClient.mockReset();
  });

  it("forwards the desktop runtime launch target to the shared runtime client factory", async () => {
    createWorkspaceRuntimeClient.mockResolvedValue({
      subscribe: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue("workspace-runtime-ready"),
      listTasks: vi.fn().mockResolvedValue([]),
      getTask: vi.fn().mockResolvedValue(null),
      createTask: vi.fn(),
      queueTask: vi.fn(),
      reopenTask: vi.fn(),
      archiveTask: vi.fn(),
      abortTask: vi.fn(),
      readAttemptLog: vi.fn()
    });

    const { registerTaskIpcHandlers } = await import("../ipc/taskIpcHandlers.js");

    registerTaskIpcHandlers("D:/Code/test/testdir", {
      entryPath: "D:/Code/Projects/tasks-dispatcher/apps/desktop/out/main/runtimeServerMain.js",
      executablePath: "node",
      mode: "node-bundled"
    });

    expect(createWorkspaceRuntimeClient).toHaveBeenCalledWith("D:/Code/test/testdir", {
      launchTarget: {
        entryPath:
          "D:/Code/Projects/tasks-dispatcher/apps/desktop/out/main/runtimeServerMain.js",
        executablePath: "node",
        mode: "node-bundled"
      }
    });
    expect(handle).toHaveBeenCalled();
  });
});
