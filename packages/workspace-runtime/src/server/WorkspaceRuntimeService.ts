import {
  ArchiveTaskService,
  CreateTaskService,
  GetTaskBoardService,
  ReopenTaskService,
  QueueTaskService,
  UpdateTaskService,
  TaskEvent,
  WorkspaceSession,
  toTaskDetailDto,
  type CreateRuntimeTaskInput,
  type UpdateRuntimeTaskInput,
  type TaskDetailDto
} from "@tasks-dispatcher/core";
import { SystemClock } from "../bootstrap/SystemClock.js";
import { RandomIdGenerator } from "../bootstrap/RandomIdGenerator.js";
import { ConcurrencyGate } from "../dispatching/ConcurrencyGate.js";
import { ExecutionCoordinator } from "../dispatching/ExecutionCoordinator.js";
import { TaskScheduler } from "../dispatching/TaskScheduler.js";
import { LocalAgentRuntimeRegistry } from "../agents/LocalAgentRuntimeRegistry.js";
import { NodeChildProcessRunner } from "../agents/NodeChildProcessRunner.js";
import { LocalEventBus } from "../events/LocalEventBus.js";
import { TaskLogFileStore } from "../persistence/TaskLogFileStore.js";
import { AttemptResultFileStore } from "../persistence/AttemptResultFileStore.js";
import { AttemptAbortSignalStore } from "../persistence/AttemptAbortSignalStore.js";
import { SqliteTaskEventStore } from "../persistence/SqliteTaskEventStore.js";
import { SqliteTaskRepository } from "../persistence/SqliteTaskRepository.js";
import { SqliteWorkspaceSessionStore } from "../persistence/SqliteWorkspaceSessionStore.js";
import { WorkspaceStorage } from "../persistence/WorkspaceStorage.js";

export class WorkspaceRuntimeService {
  readonly #workspaceRoot: string;
  readonly #storage: WorkspaceStorage;
  readonly #taskRepository: SqliteTaskRepository;
  readonly #taskEventStore: SqliteTaskEventStore;
  readonly #workspaceSessionStore: SqliteWorkspaceSessionStore;
  readonly #taskLogFileStore: TaskLogFileStore;
  readonly #eventBus: LocalEventBus;
  readonly #clock: SystemClock;
  readonly #idGenerator: RandomIdGenerator;
  readonly #scheduler: TaskScheduler;
  readonly #executionCoordinator: ExecutionCoordinator;
  readonly #createTaskService: CreateTaskService;
  readonly #updateTaskService: UpdateTaskService;
  readonly #queueTaskService: QueueTaskService;
  readonly #reopenTaskService: ReopenTaskService;
  readonly #archiveTaskService: ArchiveTaskService;
  readonly #getTaskBoardService: GetTaskBoardService;

  private constructor(workspaceRoot: string) {
    this.#workspaceRoot = workspaceRoot;
    this.#storage = WorkspaceStorage.open(workspaceRoot);
    this.#taskRepository = new SqliteTaskRepository(this.#storage.database);
    this.#taskEventStore = new SqliteTaskEventStore(this.#storage.database);
    this.#workspaceSessionStore = new SqliteWorkspaceSessionStore(
      this.#storage.database
    );
    this.#taskLogFileStore = new TaskLogFileStore(this.#storage.paths);
    this.#eventBus = new LocalEventBus();
    this.#clock = new SystemClock();
    this.#idGenerator = new RandomIdGenerator();
    const agentRuntimeRegistry = new LocalAgentRuntimeRegistry();
    const concurrencyGate = new ConcurrencyGate(2);

    this.#executionCoordinator = new ExecutionCoordinator({
      workspaceRoot,
      taskRepository: this.#taskRepository,
      taskEventStore: this.#taskEventStore,
      agentRuntimeRegistry,
      childProcessRunner: new NodeChildProcessRunner(),
      taskLogFileStore: this.#taskLogFileStore,
      attemptResultFileStore: new AttemptResultFileStore(this.#storage.paths),
      attemptAbortSignalStore: new AttemptAbortSignalStore(this.#storage.paths),
      eventBus: this.#eventBus,
      clock: this.#clock,
      idGenerator: this.#idGenerator,
      concurrencyGate,
      onSettled: async () => this.#scheduler.kick()
    });
    this.#scheduler = new TaskScheduler({
      taskRepository: this.#taskRepository,
      concurrencyGate,
      executionCoordinator: this.#executionCoordinator
    });
    const serviceDeps = {
      taskRepository: this.#taskRepository,
      taskEventStore: this.#taskEventStore,
      agentRuntimeRegistry,
      clock: this.#clock,
      idGenerator: this.#idGenerator
    };

    this.#createTaskService = new CreateTaskService(serviceDeps);
    this.#updateTaskService = new UpdateTaskService(serviceDeps);
    this.#queueTaskService = new QueueTaskService(serviceDeps);
    this.#reopenTaskService = new ReopenTaskService(serviceDeps);
    this.#archiveTaskService = new ArchiveTaskService(serviceDeps);
    this.#getTaskBoardService = new GetTaskBoardService(this.#taskRepository);
  }

  static async open(workspaceRoot: string): Promise<WorkspaceRuntimeService> {
    const service = new WorkspaceRuntimeService(workspaceRoot);

    service.#workspaceSessionStore.save(
      new WorkspaceSession(workspaceRoot, service.#clock.now())
    );
    await service.#recoverInterruptedTasks();
    await service.#scheduler.kick();

    return service;
  }

  get eventBus(): LocalEventBus {
    return this.#eventBus;
  }

  get hasActiveExecutions(): boolean {
    return this.#executionCoordinator.hasActiveExecutions;
  }

  get activeExecutionCount(): number {
    return this.#executionCoordinator.activeExecutionCount;
  }

  get workspaceRoot(): string {
    return this.#workspaceRoot;
  }

  async ping(): Promise<string> {
    return "workspace-runtime-ready";
  }

  async listTasks() {
    return this.#getTaskBoardService.execute();
  }

  async getTask(taskId: string): Promise<TaskDetailDto | null> {
    const task = await this.#taskRepository.getById(taskId);

    return task ? toTaskDetailDto(task) : null;
  }

  async createTask(input: CreateRuntimeTaskInput): Promise<TaskDetailDto> {
    const task = await this.#createTaskService.execute(input);

    this.#eventBus.emit({ type: "task.updated", taskId: task.id, task });
    return task;
  }

  async updateTask(
    taskId: string,
    input: UpdateRuntimeTaskInput
  ): Promise<TaskDetailDto> {
    const task = await this.#updateTaskService.execute({ taskId, ...input });

    this.#eventBus.emit({ type: "task.updated", taskId, task });
    return task;
  }

  async queueTask(taskId: string): Promise<TaskDetailDto> {
    const task = await this.#queueTaskService.execute(taskId);

    this.#eventBus.emit({ type: "task.updated", taskId, task });
    await this.#scheduler.kick();
    return task;
  }

  async reopenTask(taskId: string): Promise<TaskDetailDto> {
    const task = await this.#reopenTaskService.execute(taskId);

    this.#eventBus.emit({ type: "task.updated", taskId, task });
    return task;
  }

  async archiveTask(taskId: string): Promise<TaskDetailDto> {
    const task = await this.#archiveTaskService.execute(taskId);

    this.#eventBus.emit({ type: "task.updated", taskId, task });
    return task;
  }

  async abortTask(taskId: string): Promise<TaskDetailDto> {
    const task = await this.#executionCoordinator.abortTask(taskId);

    this.#eventBus.emit({ type: "task.updated", taskId, task });
    return task;
  }

  async readAttemptLog(taskId: string, attemptId: string): Promise<string> {
    return this.#taskLogFileStore.read(taskId, attemptId);
  }

  close(): void {
    this.#storage.close();
  }

  async #recoverInterruptedTasks(): Promise<void> {
    const tasks = await this.#taskRepository.list();

    for (const task of tasks) {
      if (task.state !== "executing") {
        continue;
      }

      task.markExecutionFailed("startup_failed", this.#clock.now());
      await this.#taskRepository.save(task);
      await this.#taskEventStore.append(
        new TaskEvent({
          id: this.#idGenerator.next("event"),
          taskId: task.id,
          type: "execution_failed",
          occurredAt: this.#clock.now()
        })
      );
      this.#eventBus.emit({
        type: "task.updated",
        taskId: task.id,
        task: toTaskDetailDto(task)
      });
    }
  }
}
