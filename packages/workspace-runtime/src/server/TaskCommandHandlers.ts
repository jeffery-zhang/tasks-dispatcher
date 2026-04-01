import type {
  CreateRuntimeTaskInput,
  UpdateRuntimeTaskInput
} from "@tasks-dispatcher/core/contracts";
import { WorkspaceRuntimeService } from "./WorkspaceRuntimeService.js";

export class TaskCommandHandlers {
  readonly #service: WorkspaceRuntimeService;

  constructor(service: WorkspaceRuntimeService) {
    this.#service = service;
  }

  createTask(input: CreateRuntimeTaskInput) {
    return this.#service.createTask(input);
  }

  updateTask(taskId: string, input: UpdateRuntimeTaskInput) {
    return this.#service.updateTask(taskId, input);
  }

  queueTask(taskId: string) {
    return this.#service.queueTask(taskId);
  }

  reopenTask(taskId: string) {
    return this.#service.reopenTask(taskId);
  }

  archiveTask(taskId: string) {
    return this.#service.archiveTask(taskId);
  }

  abortTask(taskId: string) {
    return this.#service.abortTask(taskId);
  }
}
