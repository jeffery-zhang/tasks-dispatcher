import { WorkspaceRuntimeService } from "./WorkspaceRuntimeService.js";

export class TaskQueryHandlers {
  readonly #service: WorkspaceRuntimeService;

  constructor(service: WorkspaceRuntimeService) {
    this.#service = service;
  }

  listTasks() {
    return this.#service.listTasks();
  }

  getTask(taskId: string) {
    return this.#service.getTask(taskId);
  }

  readAttemptLog(taskId: string, attemptId: string) {
    return this.#service.readAttemptLog(taskId, attemptId);
  }
}

