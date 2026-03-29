import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { WorkspacePaths } from "../bootstrap/WorkspacePaths.js";

export class TaskLogFileStore {
  readonly #paths: WorkspacePaths;

  constructor(paths: WorkspacePaths) {
    this.#paths = paths;
  }

  append(taskId: string, attemptId: string, chunk: string): void {
    const logPath = this.#paths.getAttemptLogPath(taskId, attemptId);

    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, chunk, "utf8");
  }

  read(taskId: string, attemptId: string): string {
    const logPath = this.#paths.getAttemptLogPath(taskId, attemptId);

    if (!existsSync(logPath)) {
      return "";
    }

    return readFileSync(logPath, "utf8");
  }
}
