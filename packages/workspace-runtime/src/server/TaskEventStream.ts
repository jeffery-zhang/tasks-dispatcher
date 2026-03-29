import type { ServerResponse } from "node:http";
import type { WorkspaceRuntimeEvent } from "@tasks-dispatcher/core/contracts";

export class TaskEventStream {
  readonly #clients = new Set<ServerResponse>();
  readonly #onClientOpened: () => void;
  readonly #onClientClosed: () => void;

  constructor(deps?: {
    onClientOpened?: () => void;
    onClientClosed?: () => void;
  }) {
    this.#onClientOpened = deps?.onClientOpened ?? (() => {});
    this.#onClientClosed = deps?.onClientClosed ?? (() => {});
  }

  get clientCount(): number {
    return this.#clients.size;
  }

  addClient(response: ServerResponse): void {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    response.write("\n");
    this.#clients.add(response);
    this.#onClientOpened();
    response.on("close", () => {
      this.#clients.delete(response);
      this.#onClientClosed();
    });
  }

  publish(event: WorkspaceRuntimeEvent): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`;

    for (const client of this.#clients) {
      client.write(payload);
    }
  }
}
