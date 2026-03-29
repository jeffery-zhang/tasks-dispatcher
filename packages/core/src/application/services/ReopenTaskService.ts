import { TaskEvent } from "../../domain/index.js";
import { toTaskDetailDto } from "../../contracts/TaskDtos.js";
import type {
  Clock,
  IdGenerator,
  TaskEventStore,
  TaskRepository
} from "../../ports/index.js";
import { TaskNotFoundError } from "./TaskNotFoundError.js";

export class ReopenTaskService {
  readonly #taskRepository: TaskRepository;
  readonly #taskEventStore: TaskEventStore;
  readonly #clock: Clock;
  readonly #idGenerator: IdGenerator;

  constructor(deps: {
    taskRepository: TaskRepository;
    taskEventStore: TaskEventStore;
    clock: Clock;
    idGenerator: IdGenerator;
  }) {
    this.#taskRepository = deps.taskRepository;
    this.#taskEventStore = deps.taskEventStore;
    this.#clock = deps.clock;
    this.#idGenerator = deps.idGenerator;
  }

  async execute(taskId: string) {
    const task = await this.#taskRepository.getById(taskId);

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    const now = this.#clock.now();
    task.reopen(now);

    await this.#taskRepository.save(task);
    await this.#taskEventStore.append(
      new TaskEvent({
        id: this.#idGenerator.next("event"),
        taskId,
        type: "task_reopened",
        occurredAt: now
      })
    );

    return toTaskDetailDto(task);
  }
}

