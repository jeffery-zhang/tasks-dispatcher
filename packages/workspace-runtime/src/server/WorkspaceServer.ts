import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { TaskCommandHandlers } from "./TaskCommandHandlers.js";
import { TaskEventStream } from "./TaskEventStream.js";
import { TaskQueryHandlers } from "./TaskQueryHandlers.js";
import { WorkspaceRuntimeService } from "./WorkspaceRuntimeService.js";

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return null;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify(payload));
}

export class WorkspaceServer {
  readonly #service: WorkspaceRuntimeService;
  readonly #commands: TaskCommandHandlers;
  readonly #queries: TaskQueryHandlers;
  readonly #eventStream: TaskEventStream;
  readonly #server: Server;
  #lastActivityAt = Date.now();

  constructor(service: WorkspaceRuntimeService) {
    this.#service = service;
    this.#commands = new TaskCommandHandlers(service);
    this.#queries = new TaskQueryHandlers(service);
    this.#eventStream = new TaskEventStream();
    this.#server = createServer((request, response) => {
      void this.#handleRequest(request, response);
    });
    this.#service.eventBus.subscribe((event) => {
      this.#eventStream.publish(event);
    });
  }

  async listen(): Promise<number> {
    return new Promise((resolvePromise, reject) => {
      this.#server.once("error", reject);
      this.#server.listen(0, "127.0.0.1", () => {
        const address = this.#server.address();

        if (!address || typeof address === "string") {
          reject(new Error("Workspace runtime server did not expose a TCP port."));
          return;
        }

        resolvePromise(address.port);
      });
    });
  }

  get activeClientCount(): number {
    return this.#eventStream.clientCount;
  }

  get activeExecutionCount(): number {
    return this.#service.activeExecutionCount;
  }

  get idleForMs(): number {
    return Date.now() - this.#lastActivityAt;
  }

  close(): Promise<void> {
    return new Promise((resolvePromise, reject) => {
      this.#server.close((error) => {
        this.#service.close();

        if (error) {
          reject(error);
          return;
        }

        resolvePromise();
      });
    });
  }

  async #handleRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathSegments = url.pathname.split("/").filter(Boolean);
    this.#lastActivityAt = Date.now();

    try {
      if (method === "GET" && url.pathname === "/health") {
        writeJson(response, 200, { status: await this.#service.ping() });
        return;
      }

      if (method === "GET" && url.pathname === "/events") {
        this.#eventStream.addClient(response);
        return;
      }

      if (method === "GET" && url.pathname === "/tasks") {
        writeJson(response, 200, { tasks: await this.#queries.listTasks() });
        return;
      }

      if (method === "POST" && url.pathname === "/tasks") {
        writeJson(response, 200, {
          task: await this.#commands.createTask(
            (await readJsonBody(request)) as Parameters<
              TaskCommandHandlers["createTask"]
            >[0]
          )
        });
        return;
      }

      if (pathSegments[0] === "tasks" && pathSegments[1]) {
        const taskId = pathSegments[1];

        if (method === "GET" && pathSegments.length === 2) {
          const task = await this.#queries.getTask(taskId);

          if (!task) {
            writeJson(response, 404, { error: "Task not found." });
            return;
          }

          writeJson(response, 200, { task });
          return;
        }

        if (
          method === "GET" &&
          pathSegments[2] === "attempts" &&
          pathSegments[3] &&
          pathSegments[4] === "log"
        ) {
          const log = await this.#queries.readAttemptLog(taskId, pathSegments[3]);
          response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
          response.end(log);
          return;
        }

        if (method === "POST" && pathSegments[2] === "queue") {
          writeJson(response, 200, { task: await this.#commands.queueTask(taskId) });
          return;
        }

        if (method === "POST" && pathSegments[2] === "reopen") {
          writeJson(response, 200, { task: await this.#commands.reopenTask(taskId) });
          return;
        }

        if (method === "POST" && pathSegments[2] === "archive") {
          writeJson(response, 200, {
            task: await this.#commands.archiveTask(taskId)
          });
          return;
        }

        if (method === "POST" && pathSegments[2] === "abort") {
          writeJson(response, 200, { task: await this.#commands.abortTask(taskId) });
          return;
        }
      }

      writeJson(response, 404, { error: "Route not found." });
    } catch (error) {
      if (!response.headersSent && !response.writableEnded) {
        writeJson(response, 500, {
          error: error instanceof Error ? error.message : "Unexpected runtime error."
        });
        return;
      }

      response.end();
    }
  }
}
