import { resolve } from "node:path";

export class WorkspacePaths {
  readonly #workspaceRoot: string;
  readonly #stateRoot: string;
  readonly #logsRoot: string;
  readonly #runtimeRoot: string;
  readonly #resultsRoot: string;
  readonly #abortSignalsRoot: string;
  readonly #databasePath: string;
  readonly #runtimeMetadataPath: string;
  readonly #runtimeLockPath: string;

  constructor(workspaceRoot: string) {
    this.#workspaceRoot = resolve(workspaceRoot);
    this.#stateRoot = resolve(this.#workspaceRoot, ".tasks-dispatcher");
    this.#logsRoot = resolve(this.#stateRoot, "logs");
    this.#runtimeRoot = resolve(this.#stateRoot, "runtime");
    this.#resultsRoot = resolve(this.#runtimeRoot, "results");
    this.#abortSignalsRoot = resolve(this.#runtimeRoot, "abort-signals");
    this.#databasePath = resolve(this.#stateRoot, "state.sqlite");
    this.#runtimeMetadataPath = resolve(this.#runtimeRoot, "runtime.json");
    this.#runtimeLockPath = resolve(this.#runtimeRoot, "launcher.lock");
  }

  get workspaceRoot(): string {
    return this.#workspaceRoot;
  }

  get stateRoot(): string {
    return this.#stateRoot;
  }

  get logsRoot(): string {
    return this.#logsRoot;
  }

  get runtimeRoot(): string {
    return this.#runtimeRoot;
  }

  get resultsRoot(): string {
    return this.#resultsRoot;
  }

  get abortSignalsRoot(): string {
    return this.#abortSignalsRoot;
  }

  get databasePath(): string {
    return this.#databasePath;
  }

  get runtimeMetadataPath(): string {
    return this.#runtimeMetadataPath;
  }

  get runtimeLockPath(): string {
    return this.#runtimeLockPath;
  }

  getAttemptLogPath(taskId: string, attemptId: string): string {
    return resolve(this.#logsRoot, taskId, `${attemptId}.log`);
  }

  getAttemptResultPath(taskId: string, attemptId: string): string {
    return resolve(this.#resultsRoot, taskId, `${attemptId}.json`);
  }

  getAttemptResultTempPath(taskId: string, attemptId: string): string {
    return resolve(this.#resultsRoot, taskId, `${attemptId}.tmp.json`);
  }

  getAttemptAbortSignalPath(taskId: string, attemptId: string): string {
    return resolve(this.#abortSignalsRoot, taskId, `${attemptId}.abort`);
  }
}
