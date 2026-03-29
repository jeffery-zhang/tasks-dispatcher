import { EventEmitter } from "node:events";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { ExecutionStage } from "@tasks-dispatcher/core";

export type SupervisorTerminationReason =
  | "completed"
  | "process_exit_non_zero"
  | "signal_terminated"
  | "startup_failed"
  | "manually_aborted";

interface ProcessChunkEvent {
  chunk: string;
  stream: "stdout" | "stderr";
}

interface StageEvent {
  stage: ExecutionStage;
}

interface ExitEvent {
  reason: SupervisorTerminationReason;
}

export class AgentProcessSupervisor {
  readonly #process: ChildProcessWithoutNullStreams;
  readonly #events = new EventEmitter();
  #lineBuffer = "";
  #abortRequested = false;
  #started = false;

  constructor(childProcess: ChildProcessWithoutNullStreams) {
    this.#process = childProcess;
    this.start();
  }

  start(): void {
    if (this.#started) {
      return;
    }

    this.#started = true;
    this.#process.stdout.on("data", (chunk: Buffer) => {
      this.#handleChunk(chunk.toString("utf8"), "stdout");
    });
    this.#process.stderr.on("data", (chunk: Buffer) => {
      this.#handleChunk(chunk.toString("utf8"), "stderr");
    });
    this.#process.on("error", () => {
      this.#events.emit("exit", { reason: "startup_failed" } satisfies ExitEvent);
    });
    this.#process.on("close", (code, signal) => {
      this.#flushBufferedStdout();

      const reason: SupervisorTerminationReason =
        this.#abortRequested
          ? "manually_aborted"
          : code === 0
            ? "completed"
            : signal
              ? "signal_terminated"
              : "process_exit_non_zero";

      this.#events.emit("exit", { reason } satisfies ExitEvent);
    });
  }

  abort(): void {
    this.#abortRequested = true;
    this.#process.kill("SIGTERM");
  }

  onChunk(listener: (event: ProcessChunkEvent) => void): () => void {
    this.#events.on("chunk", listener);
    return () => this.#events.off("chunk", listener);
  }

  onStage(listener: (event: StageEvent) => void): () => void {
    this.#events.on("stage", listener);
    return () => this.#events.off("stage", listener);
  }

  onExit(listener: (event: ExitEvent) => void): () => void {
    this.#events.on("exit", listener);
    return () => this.#events.off("exit", listener);
  }

  #handleChunk(chunk: string, stream: "stdout" | "stderr"): void {
    this.#events.emit("chunk", { chunk, stream } satisfies ProcessChunkEvent);

    if (stream !== "stdout") {
      return;
    }

    this.#lineBuffer += chunk;
    const lines = this.#lineBuffer.split(/\r?\n/);
    this.#lineBuffer = lines.pop() ?? "";

    for (const line of lines) {
      const normalizedLine = line.trim();

      if (normalizedLine === "TASKS_DISPATCHER_STAGE:plan") {
        this.#events.emit("stage", { stage: "plan" } satisfies StageEvent);
      }

      if (normalizedLine === "TASKS_DISPATCHER_STAGE:develop") {
        this.#events.emit("stage", { stage: "develop" } satisfies StageEvent);
      }

      if (normalizedLine === "TASKS_DISPATCHER_STAGE:self_check") {
        this.#events.emit("stage", { stage: "self_check" } satisfies StageEvent);
      }
    }
  }

  #flushBufferedStdout(): void {
    const remainingLine = this.#lineBuffer.trim();
    this.#lineBuffer = "";

    if (!remainingLine) {
      return;
    }

    if (remainingLine === "TASKS_DISPATCHER_STAGE:plan") {
      this.#events.emit("stage", { stage: "plan" } satisfies StageEvent);
    }

    if (remainingLine === "TASKS_DISPATCHER_STAGE:develop") {
      this.#events.emit("stage", { stage: "develop" } satisfies StageEvent);
    }

    if (remainingLine === "TASKS_DISPATCHER_STAGE:self_check") {
      this.#events.emit("stage", { stage: "self_check" } satisfies StageEvent);
    }
  }
}
