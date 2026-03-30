import { EventEmitter } from "node:events";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { ExecutionStage } from "@tasks-dispatcher/core";

export type SupervisorTerminationReason =
  | "startup_failed";

interface ProcessChunkEvent {
  chunk: string;
  stream: "stdout" | "stderr";
}

interface StageEvent {
  stage: ExecutionStage;
}

interface CompletionDeclaredEvent {
  declared: true;
}

interface AbortConfirmedEvent {
  confirmed: true;
}

interface ExitEvent {
  code: number | null;
  signal: NodeJS.Signals | null;
  reason: SupervisorTerminationReason | null;
}

export class AgentProcessSupervisor {
  readonly #process: ChildProcessWithoutNullStreams;
  readonly #events = new EventEmitter();
  #lineBuffer = "";
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
      this.#events.emit(
        "exit",
        {
          code: null,
          signal: null,
          reason: "startup_failed"
        } satisfies ExitEvent
      );
    });
    this.#process.on("close", (code, signal) => {
      this.#flushBufferedStdout();
      this.#events.emit(
        "exit",
        {
          code,
          signal,
          reason: null
        } satisfies ExitEvent
      );
    });
  }

  abort(): void {
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

  onCompletionDeclared(
    listener: (event: CompletionDeclaredEvent) => void
  ): () => void {
    this.#events.on("completion-declared", listener);
    return () => this.#events.off("completion-declared", listener);
  }

  onAbortConfirmed(listener: (event: AbortConfirmedEvent) => void): () => void {
    this.#events.on("abort-confirmed", listener);
    return () => this.#events.off("abort-confirmed", listener);
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

      if (normalizedLine === "TASKS_DISPATCHER_STAGE:complete") {
        this.#events.emit(
          "completion-declared",
          { declared: true } satisfies CompletionDeclaredEvent
        );
      }

      if (normalizedLine === "TASKS_DISPATCHER_ABORT_CONFIRMED") {
        this.#events.emit(
          "abort-confirmed",
          { confirmed: true } satisfies AbortConfirmedEvent
        );
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

    if (remainingLine === "TASKS_DISPATCHER_STAGE:complete") {
      this.#events.emit(
        "completion-declared",
        { declared: true } satisfies CompletionDeclaredEvent
      );
    }

    if (remainingLine === "TASKS_DISPATCHER_ABORT_CONFIRMED") {
      this.#events.emit(
        "abort-confirmed",
        { confirmed: true } satisfies AbortConfirmedEvent
      );
    }
  }
}
