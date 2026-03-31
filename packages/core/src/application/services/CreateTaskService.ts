import { toTaskDetailDto } from "../../contracts/TaskDtos.js";
import { Task as TaskAggregate, TaskEvent as DomainTaskEvent } from "../../domain/index.js";
import { getTaskWorkflowDefinition } from "../../domain/TaskWorkflow.js";
import type {
  Clock,
  IdGenerator,
  TaskEventStore,
  TaskRepository
} from "../../ports/index.js";

export interface CreateTaskInput {
  title: string;
  description: string;
  workflowId: string;
}

export class CreateTaskService {
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

  async execute(input: CreateTaskInput) {
    getTaskWorkflowDefinition(input.workflowId);

    const now = this.#clock.now();
    const task = TaskAggregate.createDraft({
      id: this.#idGenerator.next("task"),
      title: input.title,
      description: input.description,
      workflowId: input.workflowId,
      createdAt: now
    });

    await this.#taskRepository.save(task);
    await this.#taskEventStore.append(
      new DomainTaskEvent({
        id: this.#idGenerator.next("event"),
        taskId: task.id,
        type: "task_created",
        occurredAt: now
      })
    );

    return toTaskDetailDto(task);
  }
}
