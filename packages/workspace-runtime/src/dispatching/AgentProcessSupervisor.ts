import { EventEmitter } from "node:events";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

export type SupervisorTerminationReason = "startup_failed";

interface ProcessChunkEvent {
  chunk: string;
  stream: "stdout" | "stderr";
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

  onExit(listener: (event: ExitEvent) => void): () => void {
    this.#events.on("exit", listener);
    return () => this.#events.off("exit", listener);
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

    if (chunk.includes("TASKS_DISPATCHER_ABORT_CONFIRMED")) {
      this.#events.emit(
        "abort-confirmed",
        { confirmed: true } satisfies AbortConfirmedEvent
      );
    }
  }
}
