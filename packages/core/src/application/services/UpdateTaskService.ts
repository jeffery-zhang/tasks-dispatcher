import { toTaskDetailDto } from "../../contracts/TaskDtos.js";
import { TaskEvent } from "../../domain/index.js";
import { getTaskWorkflowDefinition } from "../../domain/TaskWorkflow.js";
import type {
  Clock,
  IdGenerator,
  TaskEventStore,
  TaskRepository
} from "../../ports/index.js";
import { TaskNotFoundError } from "./TaskNotFoundError.js";

export interface UpdateTaskInput {
  taskId: string;
  title: string;
  description: string;
  workflowId: string;
}

export class UpdateTaskService {
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

  async execute(input: UpdateTaskInput) {
    const task = await this.#taskRepository.getById(input.taskId);

    if (!task) {
      throw new TaskNotFoundError(input.taskId);
    }

    getTaskWorkflowDefinition(input.workflowId);

    const now = this.#clock.now();
    task.updateDraft({
      title: input.title,
      description: input.description,
      workflowId: input.workflowId,
      updatedAt: now
    });

    await this.#taskRepository.save(task);
    await this.#taskEventStore.append(
      new TaskEvent({
        id: this.#idGenerator.next("event"),
        taskId: input.taskId,
        type: "task_updated",
        occurredAt: now
      })
    );

    return toTaskDetailDto(task);
  }
}
