import type { AgentKind, TaskEvent, Task } from "../../domain/index.js";
import { Task as TaskAggregate, TaskEvent as DomainTaskEvent } from "../../domain/index.js";
import { toTaskDetailDto } from "../../contracts/TaskDtos.js";
import type {
  AgentRuntimeRegistry,
  Clock,
  IdGenerator,
  TaskEventStore,
  TaskRepository
} from "../../ports/index.js";

export interface CreateTaskInput {
  title: string;
  description: string;
  agent: AgentKind;
}

export class CreateTaskService {
  readonly #taskRepository: TaskRepository;
  readonly #taskEventStore: TaskEventStore;
  readonly #agentRuntimeRegistry: AgentRuntimeRegistry;
  readonly #clock: Clock;
  readonly #idGenerator: IdGenerator;

  constructor(deps: {
    taskRepository: TaskRepository;
    taskEventStore: TaskEventStore;
    agentRuntimeRegistry: AgentRuntimeRegistry;
    clock: Clock;
    idGenerator: IdGenerator;
  }) {
    this.#taskRepository = deps.taskRepository;
    this.#taskEventStore = deps.taskEventStore;
    this.#agentRuntimeRegistry = deps.agentRuntimeRegistry;
    this.#clock = deps.clock;
    this.#idGenerator = deps.idGenerator;
  }

  async execute(input: CreateTaskInput) {
    this.#agentRuntimeRegistry.assertSupported(input.agent);

    const now = this.#clock.now();
    const task = TaskAggregate.createDraft({
      id: this.#idGenerator.next("task"),
      title: input.title,
      description: input.description,
      agent: input.agent,
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

