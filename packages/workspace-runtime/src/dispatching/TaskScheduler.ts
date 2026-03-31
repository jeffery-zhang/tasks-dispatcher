import type { TaskRepository } from "@tasks-dispatcher/core";
import type { ExecutionCoordinator } from "./ExecutionCoordinator.js";
import { ConcurrencyGate } from "./ConcurrencyGate.js";

export class TaskScheduler {
  readonly #taskRepository: TaskRepository;
  readonly #concurrencyGate: ConcurrencyGate;
  readonly #executionCoordinator: ExecutionCoordinator;
  #running = false;

  constructor(deps: {
    taskRepository: TaskRepository;
    concurrencyGate: ConcurrencyGate;
    executionCoordinator: ExecutionCoordinator;
  }) {
    this.#taskRepository = deps.taskRepository;
    this.#concurrencyGate = deps.concurrencyGate;
    this.#executionCoordinator = deps.executionCoordinator;
  }

  async kick(): Promise<void> {
    if (this.#running) {
      return;
    }

    this.#running = true;

    try {
      while (this.#concurrencyGate.hasCapacity) {
        const tasks = await this.#taskRepository.list();
        const nextTask = tasks
          .filter((task) => task.state === "ready")
          .sort((left, right) =>
            left.toSnapshot().updatedAt.localeCompare(right.toSnapshot().updatedAt)
          )[0];

        if (!nextTask) {
          break;
        }

        await this.#executionCoordinator.startTask(nextTask.id);
      }
    } finally {
      this.#running = false;
    }
  }
}
