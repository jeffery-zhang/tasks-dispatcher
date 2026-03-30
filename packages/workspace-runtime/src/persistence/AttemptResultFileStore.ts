import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AttemptResultPaths } from "../agents/AgentRuntime.js";
import {
  ATTEMPT_RESULT_SCHEMA_VERSION,
  type AttemptSuccessResult
} from "../agents/wrapper/AgentAttemptWrapperProtocol.js";
import { WorkspacePaths } from "../bootstrap/WorkspacePaths.js";

interface AttemptResultIdentity {
  taskId: string;
  attemptId: string;
}

export class AttemptResultFileStore {
  readonly #paths: WorkspacePaths;

  constructor(paths: WorkspacePaths) {
    this.#paths = paths;
  }

  getPaths(taskId: string, attemptId: string): AttemptResultPaths {
    return {
      finalPath: this.#paths.getAttemptResultPath(taskId, attemptId),
      tempPath: this.#paths.getAttemptResultTempPath(taskId, attemptId)
    };
  }

  read(
    taskId: string,
    attemptId: string
  ): AttemptSuccessResult | null {
    return AttemptResultFileStore.readFromPath(
      this.#paths.getAttemptResultPath(taskId, attemptId),
      { taskId, attemptId }
    );
  }

  static writeAtomic(
    paths: AttemptResultPaths,
    result: AttemptSuccessResult
  ): void {
    mkdirSync(dirname(paths.finalPath), { recursive: true });
    rmSync(paths.tempPath, { force: true });
    writeFileSync(paths.tempPath, JSON.stringify(result), "utf8");

    const validated = AttemptResultFileStore.readFromPath(paths.tempPath, {
      taskId: result.taskId,
      attemptId: result.attemptId
    });

    if (!validated) {
      rmSync(paths.tempPath, { force: true });
      throw new Error("Attempt result validation failed.");
    }

    rmSync(paths.finalPath, { force: true });
    renameSync(paths.tempPath, paths.finalPath);
  }

  static readFromPath(
    filePath: string,
    expected: AttemptResultIdentity
  ): AttemptSuccessResult | null {
    try {
      const parsed = JSON.parse(
        readFileSync(filePath, "utf8")
      ) as Partial<AttemptSuccessResult>;

      if (!AttemptResultFileStore.isValid(parsed, expected)) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  static createSuccessResult(identity: AttemptResultIdentity): AttemptSuccessResult {
    return {
      schemaVersion: ATTEMPT_RESULT_SCHEMA_VERSION,
      status: "completed",
      taskId: identity.taskId,
      attemptId: identity.attemptId,
      finishedAt: new Date().toISOString()
    };
  }

  static isValid(
    value: Partial<AttemptSuccessResult> | null | undefined,
    expected: AttemptResultIdentity
  ): value is AttemptSuccessResult {
    if (!value) {
      return false;
    }

    return (
      value.schemaVersion === ATTEMPT_RESULT_SCHEMA_VERSION &&
      value.status === "completed" &&
      value.taskId === expected.taskId &&
      value.attemptId === expected.attemptId &&
      typeof value.finishedAt === "string"
    );
  }
}
