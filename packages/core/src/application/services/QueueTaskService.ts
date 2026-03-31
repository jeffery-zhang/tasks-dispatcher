import { toTaskDetailDto } from "../../contracts/TaskDtos.js";
import { TaskEvent } from "../../domain/index.js";
import { getTaskWorkflowDefinition } from "../../domain/TaskWorkflow.js";
import type {
  AgentRuntimeRegistry,
  Clock,
  IdGenerator,
  TaskEventStore,
  TaskRepository
} from "../../ports/index.js";
import { TaskNotFoundError } from "./TaskNotFoundError.js";

export class QueueTaskService {
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

  async execute(taskId: string) {
    const task = await this.#taskRepository.getById(taskId);

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    const workflow = getTaskWorkflowDefinition(task.workflowId);
    this.#agentRuntimeRegistry.assertSupportedAgents(
      workflow.steps.map((step) => step.agent)
    );

    const now = this.#clock.now();
    task.queueForExecution({
      attemptId: this.#idGenerator.next("attempt"),
      queuedAt: now
    });

    await this.#taskRepository.save(task);
    await this.#taskEventStore.append(
      new TaskEvent({
        id: this.#idGenerator.next("event"),
        taskId,
        type: "task_queued",
        occurredAt: now
      })
    );

    return toTaskDetailDto(task);
  }
}
