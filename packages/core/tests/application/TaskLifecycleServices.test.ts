import { describe, expect, it } from "vitest";
import {
  AbortTaskService,
  ArchiveTaskService,
  CreateTaskService,
  GetTaskBoardService,
  QueueTaskService,
  ReopenTaskService,
  UpdateTaskService
} from "../../src/application/index.js";
import { Task } from "../../src/domain/Task.js";
import { TaskEvent } from "../../src/domain/TaskEvent.js";
import { DEFAULT_WORKFLOW_ID } from "../../src/domain/TaskWorkflow.js";
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
  assertSupportedAgents(): void {}
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
  it("creates a draft task with the selected workflow", async () => {
    const deps = createServiceDependencies();
    const createTaskService = new CreateTaskService(deps);

    const task = await createTaskService.execute({
      title: "Build agent board",
      description: "Scaffold the system",
      workflowId: DEFAULT_WORKFLOW_ID
    });

    expect(task).toMatchObject({
      state: "draft",
      workflowId: DEFAULT_WORKFLOW_ID,
      workflowLabel: "Default Plan / Work / Review"
    });
    expect(deps.taskEventStore.events).toHaveLength(1);
  });

  it("queues a draft task into ready with a new queued attempt", async () => {
    const deps = createServiceDependencies();
    const createTaskService = new CreateTaskService(deps);
    const queueTaskService = new QueueTaskService(deps);

    const createdTask = await createTaskService.execute({
      title: "Fix bug",
      description: "Debug something",
      workflowId: DEFAULT_WORKFLOW_ID
    });
    const queuedTask = await queueTaskService.execute(createdTask.id);

    expect(queuedTask).toMatchObject({
      id: createdTask.id,
      state: "ready"
    });
    expect(queuedTask.attempts).toHaveLength(1);
    expect(queuedTask.attempts[0]).toMatchObject({
      status: "queued",
      workflowId: DEFAULT_WORKFLOW_ID,
      currentStepKey: null
    });
    expect(queuedTask.attempts[0].steps.map((step) => step.status)).toEqual([
      "pending",
      "pending",
      "pending"
    ]);
  });

  it("updates a draft task and keeps it editable only in draft", async () => {
    const deps = createServiceDependencies();
    const createTaskService = new CreateTaskService(deps);
    const updateTaskService = new UpdateTaskService(deps);

    const createdTask = await createTaskService.execute({
      title: "Initial title",
      description: "Initial description",
      workflowId: DEFAULT_WORKFLOW_ID
    });

    const updatedTask = await updateTaskService.execute({
      taskId: createdTask.id,
      title: "Updated title",
      description: "Updated description",
      workflowId: DEFAULT_WORKFLOW_ID
    });

    expect(updatedTask).toMatchObject({
      id: createdTask.id,
      state: "draft",
      title: "Updated title",
      description: "Updated description"
    });
    expect(deps.taskEventStore.events.at(-1)?.toSnapshot().type).toBe("task_updated");
  });

  it("reopens a failed task and allows it to be queued again with a fresh attempt", async () => {
    const deps = createServiceDependencies();
    const createTaskService = new CreateTaskService(deps);
    const queueTaskService = new QueueTaskService(deps);
    const reopenTaskService = new ReopenTaskService(deps);

    const createdTask = await createTaskService.execute({
      title: "Implement feature",
      description: "Add lifecycle core",
      workflowId: DEFAULT_WORKFLOW_ID
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

    expect(reopenedTask.state).toBe("draft");
    expect(requeuedTask.state).toBe("ready");
    expect(requeuedTask.attempts).toHaveLength(2);
  });

  it("archives completed or failed tasks and aborts executing tasks into failed", async () => {
    const deps = createServiceDependencies();
    const createTaskService = new CreateTaskService(deps);
    const queueTaskService = new QueueTaskService(deps);
    const archiveTaskService = new ArchiveTaskService(deps);
    const abortTaskService = new AbortTaskService(deps);

    const createdTask = await createTaskService.execute({
      title: "Ship feature",
      description: "Move task through lifecycle",
      workflowId: DEFAULT_WORKFLOW_ID
    });

    const task = await deps.taskRepository.getById(createdTask.id);

    if (!task) {
      throw new Error("Task should exist after creation.");
    }

    await queueTaskService.execute(createdTask.id);
    task.markExecuting(deps.clock.now());
    task.completeCurrentAttemptStep("plan", deps.clock.now());
    task.startCurrentAttemptStep("work", deps.clock.now());
    task.completeCurrentAttemptStep("work", deps.clock.now());
    task.startCurrentAttemptStep("review", deps.clock.now());
    task.completeCurrentAttemptStep("review", deps.clock.now());
    task.markCompleted(deps.clock.now());
    await deps.taskRepository.save(task);

    const archivedTask = await archiveTaskService.execute(createdTask.id);

    expect(archivedTask.state).toBe("archived");

    const createdTaskTwo = await createTaskService.execute({
      title: "Abort run",
      description: "Manual stop path",
      workflowId: DEFAULT_WORKFLOW_ID
    });

    await queueTaskService.execute(createdTaskTwo.id);
    const secondTask = await deps.taskRepository.getById(createdTaskTwo.id);

    if (!secondTask) {
      throw new Error("Second task should exist after creation.");
    }

    secondTask.markExecuting(deps.clock.now());
    await deps.taskRepository.save(secondTask);

    const abortedTask = await abortTaskService.execute(createdTaskTwo.id);

    expect(abortedTask.state).toBe("failed");
    expect(abortedTask.attempts.at(-1)?.terminationReason).toBe(
      "manually_aborted"
    );

    const archivedFailedTask = await archiveTaskService.execute(createdTaskTwo.id);

    expect(archivedFailedTask.state).toBe("archived");
  });

  it("returns board tasks ordered by most recently updated", async () => {
    const deps = createServiceDependencies();
    const createTaskService = new CreateTaskService(deps);
    const getTaskBoardService = new GetTaskBoardService(deps.taskRepository);

    await createTaskService.execute({
      title: "Older task",
      description: "First",
      workflowId: DEFAULT_WORKFLOW_ID
    });
    await createTaskService.execute({
      title: "Newer task",
      description: "Second",
      workflowId: DEFAULT_WORKFLOW_ID
    });

    const board = await getTaskBoardService.execute();

    expect(board.map((task) => task.title)).toEqual([
      "Newer task",
      "Older task"
    ]);
  });
});
