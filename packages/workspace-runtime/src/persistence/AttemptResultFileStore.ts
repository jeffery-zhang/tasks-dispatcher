import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AttemptResultPaths } from "../agents/AgentRuntime.js";
import {
  ATTEMPT_RESULT_SCHEMA_VERSION,
  type AttemptResult
} from "../agents/wrapper/AgentAttemptWrapperProtocol.js";
import { WorkspacePaths } from "../bootstrap/WorkspacePaths.js";

interface AttemptResultIdentity {
  taskId: string;
  attemptId: string;
  stepKey: string;
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

  clear(taskId: string, attemptId: string): void {
    const paths = this.getPaths(taskId, attemptId);
    rmSync(paths.finalPath, { force: true });
    rmSync(paths.tempPath, { force: true });
  }

  read(taskId: string, attemptId: string): AttemptResult | null {
    const filePath = this.#paths.getAttemptResultPath(taskId, attemptId);

    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<AttemptResult>;

      if (!AttemptResultFileStore.isValidLoose(parsed, { taskId, attemptId })) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  static writeAtomic(paths: AttemptResultPaths, result: AttemptResult): void {
    mkdirSync(dirname(paths.finalPath), { recursive: true });
    rmSync(paths.tempPath, { force: true });
    writeFileSync(paths.tempPath, JSON.stringify(result), "utf8");

    const validated = AttemptResultFileStore.readFromPath(paths.tempPath, {
      taskId: result.taskId,
      attemptId: result.attemptId,
      stepKey: result.stepKey
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
  ): AttemptResult | null {
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<AttemptResult>;

      if (!AttemptResultFileStore.isValid(parsed, expected)) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  static createSuccessResult(identity: AttemptResultIdentity): AttemptResult {
    return {
      schemaVersion: ATTEMPT_RESULT_SCHEMA_VERSION,
      status: "completed",
      taskId: identity.taskId,
      attemptId: identity.attemptId,
      stepKey: identity.stepKey as AttemptResult["stepKey"],
      finishedAt: new Date().toISOString()
    };
  }

  static createFailureResult(
    identity: AttemptResultIdentity,
    failureReason: AttemptResult["failureReason"]
  ): AttemptResult {
    return {
      schemaVersion: ATTEMPT_RESULT_SCHEMA_VERSION,
      status: "failed",
      taskId: identity.taskId,
      attemptId: identity.attemptId,
      stepKey: identity.stepKey as AttemptResult["stepKey"],
      finishedAt: new Date().toISOString(),
      failureReason: failureReason ?? null
    };
  }

  static isValid(
    value: Partial<AttemptResult> | null | undefined,
    expected: AttemptResultIdentity
  ): value is AttemptResult {
    if (!AttemptResultFileStore.isValidLoose(value, expected)) {
      return false;
    }

    return value.stepKey === expected.stepKey;
  }

  private static isValidLoose(
    value: Partial<AttemptResult> | null | undefined,
    expected: { taskId: string; attemptId: string }
  ): value is AttemptResult {
    if (!value) {
      return false;
    }

    const hasFailureReason =
      value.status === "failed"
        ? typeof value.failureReason === "string" || value.failureReason === null
        : true;

    return (
      value.schemaVersion === ATTEMPT_RESULT_SCHEMA_VERSION &&
      (value.status === "completed" || value.status === "failed") &&
      value.taskId === expected.taskId &&
      value.attemptId === expected.attemptId &&
      typeof value.stepKey === "string" &&
      typeof value.finishedAt === "string" &&
      hasFailureReason
    );
  }
}
