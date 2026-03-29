import type {
  CreateRuntimeTaskInput,
  WorkspaceRuntimeApi,
  WorkspaceRuntimeEvent
} from "@tasks-dispatcher/core/contracts";
import type { TaskDetailDto, TaskSummaryDto } from "@tasks-dispatcher/core/contracts";

export class WorkspaceRuntimeClient implements WorkspaceRuntimeApi {
  readonly #baseUrl: string;

  constructor(baseUrl: string) {
    this.#baseUrl = baseUrl;
  }

  async ping(): Promise<string> {
    const response = await fetch(`${this.#baseUrl}/health`);
    const body = (await response.json()) as { status: string };

    return body.status;
  }

  async listTasks(): Promise<TaskSummaryDto[]> {
    const response = await fetch(`${this.#baseUrl}/tasks`);
    const body = (await response.json()) as { tasks: TaskSummaryDto[] };

    return body.tasks;
  }

  async getTask(taskId: string): Promise<TaskDetailDto | null> {
    const response = await fetch(`${this.#baseUrl}/tasks/${taskId}`);

    if (response.status === 404) {
      return null;
    }

    const body = (await response.json()) as { task: TaskDetailDto };
    return body.task;
  }

  async createTask(input: CreateRuntimeTaskInput): Promise<TaskDetailDto> {
    return this.#post<TaskDetailDto>("/tasks", input);
  }

  async queueTask(taskId: string): Promise<TaskDetailDto> {
    return this.#post<TaskDetailDto>(`/tasks/${taskId}/queue`);
  }

  async reopenTask(taskId: string): Promise<TaskDetailDto> {
    return this.#post<TaskDetailDto>(`/tasks/${taskId}/reopen`);
  }

  async archiveTask(taskId: string): Promise<TaskDetailDto> {
    return this.#post<TaskDetailDto>(`/tasks/${taskId}/archive`);
  }

  async abortTask(taskId: string): Promise<TaskDetailDto> {
    return this.#post<TaskDetailDto>(`/tasks/${taskId}/abort`);
  }

  async readAttemptLog(taskId: string, attemptId: string): Promise<string> {
    const response = await fetch(
      `${this.#baseUrl}/tasks/${taskId}/attempts/${attemptId}/log`
    );

    if (!response.ok) {
      throw new Error(`Failed to read attempt log for ${taskId}/${attemptId}.`);
    }

    return response.text();
  }

  async subscribe(
    listener: (event: WorkspaceRuntimeEvent) => void
  ): Promise<() => void> {
    const controller = new AbortController();
    const response = await fetch(`${this.#baseUrl}/events`, {
      headers: { Accept: "text/event-stream" },
      signal: controller.signal
    });

    if (!response.body) {
      throw new Error("Event stream body is unavailable.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const readLoop = async () => {
      while (true) {
        const result = await reader.read();

        if (result.done) {
          break;
        }

        buffer += decoder.decode(result.value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const dataLine = chunk
            .split(/\r?\n/)
            .find((line) => line.startsWith("data:"));

          if (!dataLine) {
            continue;
          }

          listener(
            JSON.parse(dataLine.slice("data:".length).trim()) as WorkspaceRuntimeEvent
          );
        }
      }
    };

    void readLoop().catch((error) => {
      if (
        controller.signal.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        return;
      }

      throw error;
    });

    return () => controller.abort();
  }

  async #post<TResponse>(path: string, body?: unknown): Promise<TResponse> {
    const response = await fetch(`${this.#baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Request to ${path} failed.`);
    }

    const payload = (await response.json()) as { task: TResponse };
    return payload.task;
  }
}
