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
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tasks-dispatcher-runtime-bundle-"));

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

describe("RuntimeLauncher launch target overrides", () => {
  it("starts a bundled runtime entry when a node-bundled launch target is provided", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const entryPath = resolve(
      process.cwd(),
      "packages/workspace-runtime/tests/server/fixtures/runtimeServerBundle.mjs"
    );
    const launcher = new RuntimeLauncher(workspaceRoot, {
      launchTarget: {
        entryPath,
        mode: "node-bundled"
      }
    });

    const client = await launcher.connect();
    const metadata = readRuntimeMetadata(workspaceRoot);

    expect(await client.ping()).toBe("workspace-runtime-ready");
    expect(metadata.workspaceRoot).toBe(workspaceRoot);
    expect(metadata.port).toBeGreaterThan(0);
  });

  it("fails fast when the configured launch target does not exist", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const launcher = new RuntimeLauncher(workspaceRoot, {
      launchTarget: {
        entryPath: resolve(workspaceRoot, "missing-runtime-server.js"),
        mode: "node-bundled"
      }
    });

    await expect(launcher.connect()).rejects.toThrow(/Workspace runtime entry does not exist/);
  });
});
