import { createRequire } from "node:module";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { WorkspacePaths } from "./WorkspacePaths.js";
import { RuntimeLock } from "./RuntimeLock.js";
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

export class RuntimeLauncher {
  #paths: WorkspacePaths;
  #metadataPath: string;

  constructor(workspaceRoot: string) {
    this.#paths = new WorkspacePaths(workspaceRoot);
    mkdirSync(this.#paths.runtimeRoot, { recursive: true });
    this.#metadataPath = resolve(this.#paths.runtimeRoot, "runtime.json");
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
    const require = createRequire(import.meta.url);
    const tsxCli = require.resolve("tsx/cli");
    const runtimeMain = fileURLToPath(
      new URL("../server/runtimeServerMain.ts", import.meta.url)
    );

    const child = spawn(
      process.execPath,
      [tsxCli, runtimeMain, "--workspace-root", this.#paths.workspaceRoot],
      {
        cwd: this.#paths.workspaceRoot,
        detached: true,
        stdio: "ignore"
      }
    );

    child.unref();
  }
}
