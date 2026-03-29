import { EventEmitter } from "node:events";
import type { WorkspaceRuntimeEvent } from "@tasks-dispatcher/core";

type RuntimeEventListener = (event: WorkspaceRuntimeEvent) => void;

export class LocalEventBus {
  readonly #emitter = new EventEmitter();

  emit(event: WorkspaceRuntimeEvent): void {
    this.#emitter.emit("runtime-event", event);
  }

  subscribe(listener: RuntimeEventListener): () => void {
    this.#emitter.on("runtime-event", listener);

    return () => {
      this.#emitter.off("runtime-event", listener);
    };
  }
}

