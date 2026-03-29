import { describe, expect, it } from "vitest";
import {
  AbortTaskService,
  ArchiveTaskService,
  CreateTaskService,
  GetTaskBoardService,
  QueueTaskService,
  ReopenTaskService
} from "../../src/application/index.js";
import { Task } from "../../src/domain/Task.js";
import { TaskEvent } from "../../src/domain/TaskEvent.js";
import type {
  AgentRuntimeRegistry,
  Clock,
  IdGenerator,
  TaskEventStore,
  TaskRepository
} from "../../src/ports/index.js";

class InMemoryTaskRepository implements TaskRepository {
  readonly #tasks = new Map<string, Task>();

  async getById(taskId: string): Promise<Task | null> {
    return this.#tasks.get(taskId) ?? null;
  }

  async list(): Promise<Task[]> {
    return [...this.#tasks.values()];
  }

  async save(task: Task): Promise<void> {
    this.#tasks.set(task.id, task);
  }
}

class InMemoryTaskEventStore implements TaskEventStore {
  readonly events: TaskEvent[] = [];

  async append(event: TaskEvent): Promise<void> {
    this.events.push(event);
  }
}

class FixedClock implements Clock {
  #tick = 0;
  readonly #base = new Date("2026-03-29T00:00:00.000Z");

  now(): Date {
    this.#tick += 1;
    return new Date(this.#base.getTime() + this.#tick * 1000);
  }
}

class IncrementingIdGenerator implements IdGenerator {
  #count = 0;

  next(prefix: string): string {
    this.#count += 1;
    return `${prefix}-${this.#count}`;
  }
}

class SupportedAgentRegistry implements AgentRuntimeRegistry {
  assertSupported(): void {}
}

function createServiceDependencies() {
  return {
    taskRepository: new InMemoryTaskRepository(),
    taskEventStore: new InMemoryTaskEventStore(),
    agentRuntimeRegistry: new SupportedAgentRegistry(),
    clock: new FixedClock(),
    idGenerator: new IncrementingIdGenerator()
  };
}

describe("task lifecycle application services", () => {
  it("creates a draft task with the default workflow", async () => {
    const deps = createServiceDependencies();
    const createTaskService = new CreateTaskService(deps);

    const task = await createTaskService.execute({
      title: "Build agent board",
      description: "Scaffold the system",
      agent: "codex-cli"
    });

    expect(task).toMatchObject({
      state: "initializing",
      workflowId: "default-plan-develop-self-check",
      workflowLabel: "Default Plan / Develop / Self-check"
    });
    expect(deps.taskEventStore.events).toHaveLength(1);
  });

  it("queues a draft task into pending execution with a new attempt", async () => {
    const deps = createServiceDependencies();
    const createTaskService = new CreateTaskService(deps);
    const queueTaskService = new QueueTaskService(deps);

    const createdTask = await createTaskService.execute({
      title: "Fix bug",
      description: "Debug something",
      agent: "claude-code"
    });
    const queuedTask = await queueTaskService.execute(createdTask.id);

    expect(queuedTask).toMatchObject({
      id: createdTask.id,
      state: "pending_execution"
    });
    expect(queuedTask.attempts).toHaveLength(1);
    expect(queuedTask.attempts[0]).toMatchObject({
      status: "queued",
      stage: "plan"
    });
  });

  it("reopens a failed task and allows it to be queued again with a fresh attempt", async () => {
    const deps = createServiceDependencies();
    const createTaskService = new CreateTaskService(deps);
    const queueTaskService = new QueueTaskService(deps);
    const reopenTaskService = new ReopenTaskService(deps);

    const createdTask = await createTaskService.execute({
      title: "Implement feature",
      description: "Add lifecycle core",
      agent: "codex-cli"
    });

    const task = await deps.taskRepository.getById(createdTask.id);

    if (!task) {
      throw new Error("Task should exist after creation.");
    }

    await queueTaskService.execute(createdTask.id);
    task.markExecuting(deps.clock.now());
    task.markExecutionFailed("process_exit_non_zero", deps.clock.now());
    await deps.taskRepository.save(task);

    const reopenedTask = await reopenTaskService.execute(createdTask.id);
    const requeuedTask = await queueTaskService.execute(createdTask.id);

    expect(reopenedTask.state).toBe("reopened");
    expect(requeuedTask.state).toBe("pending_execution");
    expect(requeuedTask.attempts).toHaveLength(2);
  });

  it("archives validated tasks and aborts executing tasks into execution_failed", async () => {
    const deps = createServiceDependencies();
    const createTaskService = new CreateTaskService(deps);
    const queueTaskService = new QueueTaskService(deps);
    const archiveTaskService = new ArchiveTaskService(deps);
    const abortTaskService = new AbortTaskService(deps);

    const createdTask = await createTaskService.execute({
      title: "Ship feature",
      description: "Move task through lifecycle",
      agent: "claude-code"
    });

    const task = await deps.taskRepository.getById(createdTask.id);

    if (!task) {
      throw new Error("Task should exist after creation.");
    }

    await queueTaskService.execute(createdTask.id);
    task.markExecuting(deps.clock.now());
    task.moveCurrentAttemptToStage("develop", deps.clock.now());
    task.moveCurrentAttemptToStage("self_check", deps.clock.now());
    task.markAwaitingValidation(deps.clock.now());
    await deps.taskRepository.save(task);

    const archivedTask = await archiveTaskService.execute(createdTask.id);

    expect(archivedTask.state).toBe("archived");

    const createdTaskTwo = await createTaskService.execute({
      title: "Abort run",
      description: "Manual stop path",
      agent: "codex-cli"
    });

    await queueTaskService.execute(createdTaskTwo.id);
    const secondTask = await deps.taskRepository.getById(createdTaskTwo.id);

    if (!secondTask) {
      throw new Error("Second task should exist after creation.");
    }

    secondTask.markExecuting(deps.clock.now());
    await deps.taskRepository.save(secondTask);

    const abortedTask = await abortTaskService.execute(createdTaskTwo.id);

    expect(abortedTask.state).toBe("execution_failed");
    expect(abortedTask.attempts.at(-1)?.terminationReason).toBe(
      "manually_aborted"
    );
  });

  it("returns board tasks ordered by most recently updated", async () => {
    const deps = createServiceDependencies();
    const createTaskService = new CreateTaskService(deps);
    const getTaskBoardService = new GetTaskBoardService(deps.taskRepository);

    await createTaskService.execute({
      title: "Older task",
      description: "First",
      agent: "codex-cli"
    });
    await createTaskService.execute({
      title: "Newer task",
      description: "Second",
      agent: "claude-code"
    });

    const board = await getTaskBoardService.execute();

    expect(board.map((task) => task.title)).toEqual([
      "Newer task",
      "Older task"
    ]);
  });
});
