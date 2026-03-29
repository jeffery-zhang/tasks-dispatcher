import { createRequire } from "node:module";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { WorkspacePaths } from "./WorkspacePaths.js";
import { RuntimeLock } from "./RuntimeLock.js";
import type { RuntimeLaunchTarget } from "./RuntimeLaunchTarget.js";
import { WorkspaceRuntimeClient } from "../client/WorkspaceRuntimeClient.js";

interface RuntimeMetadata {
  pid: number;
  port: number;
  workspaceRoot: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

interface RuntimeLauncherOptions {
  launchTarget?: RuntimeLaunchTarget;
}

export class RuntimeLauncher {
  #paths: WorkspacePaths;
  #metadataPath: string;
  #launchTarget: RuntimeLaunchTarget | null;

  constructor(workspaceRoot: string, options?: RuntimeLauncherOptions) {
    this.#paths = new WorkspacePaths(workspaceRoot);
    mkdirSync(this.#paths.runtimeRoot, { recursive: true });
    this.#metadataPath = resolve(this.#paths.runtimeRoot, "runtime.json");
    this.#launchTarget = options?.launchTarget ?? null;
  }

  async connect(): Promise<WorkspaceRuntimeClient> {
    const existing = await this.#loadHealthyClient();

    if (existing) {
      return existing;
    }

    const release = await RuntimeLock.acquire(this.#paths.runtimeRoot);

    try {
      const rechecked = await this.#loadHealthyClient();

      if (rechecked) {
        return rechecked;
      }

      await this.#spawnRuntimeProcess();
      return await this.#waitForClient();
    } finally {
      release();
    }
  }

  writeMetadata(metadata: RuntimeMetadata): void {
    writeFileSync(this.#metadataPath, JSON.stringify(metadata), "utf8");
  }

  clearMetadata(): void {
    rmSync(this.#metadataPath, { force: true });
  }

  async #loadHealthyClient(): Promise<WorkspaceRuntimeClient | null> {
    try {
      const metadata = JSON.parse(
        readFileSync(this.#metadataPath, "utf8")
      ) as RuntimeMetadata;
      const client = new WorkspaceRuntimeClient(
        `http://127.0.0.1:${metadata.port}`
      );

      await client.ping();

      return client;
    } catch {
      return null;
    }
  }

  async #waitForClient(): Promise<WorkspaceRuntimeClient> {
    const timeoutAt = Date.now() + 10_000;

    while (Date.now() < timeoutAt) {
      const client = await this.#loadHealthyClient();

      if (client) {
        return client;
      }

      await sleep(200);
    }

    throw new Error("Timed out waiting for workspace runtime to start.");
  }

  async #spawnRuntimeProcess(): Promise<void> {
    const launchTarget = this.#launchTarget ?? this.#resolveDefaultLaunchTarget();
    const executablePath = launchTarget.executablePath ?? process.execPath;

    if (!existsSync(launchTarget.entryPath)) {
      throw new Error(
        `Workspace runtime entry does not exist: ${launchTarget.entryPath}.`
      );
    }

    const args =
      launchTarget.mode === "node-bundled"
        ? [launchTarget.entryPath, "--workspace-root", this.#paths.workspaceRoot]
        : [
            createRequire(import.meta.url).resolve("tsx/cli"),
            launchTarget.entryPath,
            "--workspace-root",
            this.#paths.workspaceRoot
          ];

    const stdoutLogFd = openSync(resolve(this.#paths.runtimeRoot, "runtime.stdout.log"), "a");
    const stderrLogFd = openSync(resolve(this.#paths.runtimeRoot, "runtime.stderr.log"), "a");
    const child = spawn(
      executablePath,
      args,
      {
        cwd: this.#paths.workspaceRoot,
        detached: true,
        stdio: ["ignore", stdoutLogFd, stderrLogFd]
      }
    );

    closeSync(stdoutLogFd);
    closeSync(stderrLogFd);
    child.unref();
  }

  #resolveDefaultLaunchTarget(): RuntimeLaunchTarget {
    return {
      entryPath: fileURLToPath(new URL("../server/runtimeServerMain.ts", import.meta.url)),
      mode: "tsx-source"
    };
  }
}
