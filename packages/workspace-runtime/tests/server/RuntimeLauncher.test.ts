import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RuntimeLauncher } from "../../src/bootstrap/RuntimeLauncher.js";
import { WorkspacePaths } from "../../src/bootstrap/WorkspacePaths.js";

interface RuntimeMetadata {
  pid: number;
  port: number;
  workspaceRoot: string;
}

const tempDirectories: string[] = [];

function createWorkspaceRoot(): string {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tasks-dispatcher-runtime-"));

  tempDirectories.push(workspaceRoot);
  return workspaceRoot;
}

function readRuntimeMetadata(workspaceRoot: string): RuntimeMetadata {
  const paths = new WorkspacePaths(workspaceRoot);

  return JSON.parse(
    readFileSync(paths.runtimeMetadataPath, "utf8")
  ) as RuntimeMetadata;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

async function canPing(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForPortToClose(port: number): Promise<void> {
  const timeoutAt = Date.now() + 10_000;

  while (Date.now() < timeoutAt) {
    if (!(await canPing(port))) {
      return;
    }

    await sleep(200);
  }

  throw new Error(`Timed out waiting for runtime on port ${port} to stop.`);
}

async function waitForProcessToExit(pid: number): Promise<void> {
  const timeoutAt = Date.now() + 10_000;

  while (Date.now() < timeoutAt) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === "ESRCH") {
        return;
      }
    }

    await sleep(200);
  }

  throw new Error(`Timed out waiting for runtime process ${pid} to exit.`);
}

async function stopRuntime(workspaceRoot: string): Promise<void> {
  const paths = new WorkspacePaths(workspaceRoot);

  if (!existsSync(paths.runtimeMetadataPath)) {
    return;
  }

  const { pid, port } = readRuntimeMetadata(workspaceRoot);

  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== "ESRCH") {
      throw error;
    }
  }

  await waitForPortToClose(port);
  await waitForProcessToExit(pid);
  await sleep(100);
}

afterEach(async () => {
  for (const directory of tempDirectories.splice(0)) {
    await stopRuntime(directory);
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("RuntimeLauncher", () => {
  it("restarts a healthy tsx-source runtime so code changes are picked up", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const launcher = new RuntimeLauncher(workspaceRoot, {
      launchTarget: {
        entryPath: resolve(
          "packages",
          "workspace-runtime",
          "src",
          "server",
          "runtimeServerMain.ts"
        ),
        mode: "tsx-source"
      }
    });
    const firstClient = await launcher.connect();

    const created = await firstClient.createTask({
      title: "Reload runtime task",
      description: "Verify fresh tsx runtime",
      workflowId: "default-plan-work-review"
    });
    const firstRuntime = readRuntimeMetadata(workspaceRoot);

    const restartedClient = await launcher.connect();
    const fetched = await restartedClient.getTask(created.id);
    const secondRuntime = readRuntimeMetadata(workspaceRoot);

    expect(await restartedClient.ping()).toBe("workspace-runtime-ready");
    expect(fetched?.id).toBe(created.id);
    expect(secondRuntime.pid).not.toBe(firstRuntime.pid);
  });

  it("restarts the workspace runtime after the previous process exits", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const launcher = new RuntimeLauncher(workspaceRoot);
    const firstClient = await launcher.connect();

    const created = await firstClient.createTask({
      title: "Restarted runtime task",
      description: "Verify restarted runtime",
      workflowId: "default-plan-work-review"
    });
    const firstRuntime = readRuntimeMetadata(workspaceRoot);

    await stopRuntime(workspaceRoot);
    expect(await canPing(firstRuntime.port)).toBe(false);

    const restartedClient = await launcher.connect();
    const fetched = await restartedClient.getTask(created.id);
    const secondRuntime = readRuntimeMetadata(workspaceRoot);

    expect(await restartedClient.ping()).toBe("workspace-runtime-ready");
    expect(fetched?.id).toBe(created.id);
    expect(secondRuntime.workspaceRoot).toBe(firstRuntime.workspaceRoot);
    expect(secondRuntime.pid).not.toBe(firstRuntime.pid);
  });
});
