import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { WorkspacePaths } from "../bootstrap/WorkspacePaths.js";

export class AttemptAbortSignalStore {
  readonly #paths: WorkspacePaths;

  constructor(paths: WorkspacePaths) {
    this.#paths = paths;
  }

  getPath(taskId: string, attemptId: string): string {
    return this.#paths.getAttemptAbortSignalPath(taskId, attemptId);
  }

  requestAbort(taskId: string, attemptId: string): void {
    const filePath = this.getPath(taskId, attemptId);

    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, "abort", "utf8");
  }

  clear(taskId: string, attemptId: string): void {
    rmSync(this.getPath(taskId, attemptId), { force: true });
  }

  isAbortRequested(taskId: string, attemptId: string): boolean {
    return existsSync(this.getPath(taskId, attemptId));
  }
}
