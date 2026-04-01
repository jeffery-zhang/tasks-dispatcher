import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CreateTaskService,
  DEFAULT_WORKFLOW_ID,
  QueueTaskService,
  type Clock,
  type IdGenerator
} from "@tasks-dispatcher/core";
import { LocalAgentRuntimeRegistry } from "../../src/agents/LocalAgentRuntimeRegistry.js";
import { NodeChildProcessRunner } from "../../src/agents/NodeChildProcessRunner.js";
import { createAgentAttemptWrapperLaunchSpec } from "../../src/agents/AgentRuntime.js";
import { ConcurrencyGate } from "../../src/dispatching/ConcurrencyGate.js";
import { ExecutionCoordinator } from "../../src/dispatching/ExecutionCoordinator.js";
import { TaskScheduler } from "../../src/dispatching/TaskScheduler.js";
import { LocalEventBus } from "../../src/events/LocalEventBus.js";
import { AttemptAbortSignalStore } from "../../src/persistence/AttemptAbortSignalStore.js";
import { AttemptResultFileStore } from "../../src/persistence/AttemptResultFileStore.js";
import { SqliteTaskEventStore } from "../../src/persistence/SqliteTaskEventStore.js";
import { SqliteTaskRepository } from "../../src/persistence/SqliteTaskRepository.js";
import { TaskLogFileStore } from "../../src/persistence/TaskLogFileStore.js";
import { WorkspaceStorage } from "../../src/persistence/WorkspaceStorage.js";

const tempDirectories: string[] = [];

function createWorkspaceRoot(): string {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tasks-dispatcher-exec-"));

  tempDirectories.push(workspaceRoot);
  return workspaceRoot;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

function writeWrapperLikeScript(scriptPath: string): void {
  writeFileSync(
    scriptPath,
    [
      "const [mode] = process.argv.slice(2);",
      "if (mode === 'success') {",
      "  console.log('TASKS_DISPATCHER_RESULT:{\"status\":\"completed\",\"finishedAt\":\"2026-03-29T00:00:00.000Z\"}');",
      "  console.log('step complete');",
      "  process.exit(0);",
      "} else if (mode === 'protocol-missing') {",
      "  console.log('planning only');",
      "  process.exit(0);",
      "} else if (mode === 'needs-input') {",
      "  console.log('TASKS_DISPATCHER_RESULT:{\"status\":\"failed\",\"failureReason\":\"needs_input\",\"finishedAt\":\"2026-03-29T00:00:00.000Z\"}');",
      "  process.exit(0);",
      "} else if (mode === 'abortable') {",
      "  console.log('running');",
      "  setInterval(() => {}, 1000);",
      "} else if (mode === 'success-no-newline-hangs') {",
      "  process.stdout.write('TASKS_DISPATCHER_RESULT:{\"status\":\"completed\",\"finishedAt\":\"2026-03-29T00:00:00.000Z\"}');",
      "  setInterval(() => {}, 1000);",
      "} else {",
      "  process.exit(1);",
      "}",
    ].join("\n"),
    "utf8"
  );
}

class FixedClock implements Clock {
  now(): Date {
    return new Date();
  }
}

class IncrementingIdGenerator implements IdGenerator {
  #count = 0;

  next(prefix: string): string {
    this.#count += 1;
    return `${prefix}-${this.#count}`;
  }
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

async function waitForTaskState(
  repository: SqliteTaskRepository,
  taskId: string,
  expectedState: string
) {
  const timeoutAt = Date.now() + 10_000;

  while (Date.now() < timeoutAt) {
    const task = await repository.getById(taskId);

    if (task?.state === expectedState) {
      return task;
    }

    await wait(100);
  }

  throw new Error(`Timed out waiting for task ${taskId} to reach ${expectedState}.`);
}

function createRuntimeRegistry(scriptPath: string, mode: string) {
  return new LocalAgentRuntimeRegistry([
    {
      kind: "codex-cli",
      createLaunchSpec(_task, context) {
        return createAgentAttemptWrapperLaunchSpec(
          {
            command: process.execPath,
            args: [scriptPath, mode]
          },
          context
        );
      }
    },
    {
      kind: "claude-code",
      createLaunchSpec(_task, context) {
        return createAgentAttemptWrapperLaunchSpec(
          {
            command: process.execPath,
            args: [scriptPath, mode]
          },
          context
        );
      }
    }
  ]);
}

describe("ExecutionCoordinator", () => {
  it("marks ready tasks completed only when each step writes a valid result artifact", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const storage = WorkspaceStorage.open(workspaceRoot);
    const repository = new SqliteTaskRepository(storage.database);
    const taskEventStore = new SqliteTaskEventStore(storage.database);
    const eventBus = new LocalEventBus();
    const clock = new FixedClock();
    const idGenerator = new IncrementingIdGenerator();
    const wrapperScriptPath = join(workspaceRoot, "wrapper-like-script.mjs");

    writeWrapperLikeScript(wrapperScriptPath);

    const agentRuntimeRegistry = createRuntimeRegistry(wrapperScriptPath, "success");
    const concurrencyGate = new ConcurrencyGate(2);
    let scheduler: TaskScheduler;
    const executionCoordinator = new ExecutionCoordinator({
      workspaceRoot,
      taskRepository: repository,
      taskEventStore,
      agentRuntimeRegistry,
      childProcessRunner: new NodeChildProcessRunner(),
      taskLogFileStore: new TaskLogFileStore(storage.paths),
      attemptResultFileStore: new AttemptResultFileStore(storage.paths),
      attemptAbortSignalStore: new AttemptAbortSignalStore(storage.paths),
      eventBus,
      clock,
      idGenerator,
      concurrencyGate,
      onSettled: async () => scheduler.kick()
    });
    scheduler = new TaskScheduler({
      taskRepository: repository,
      concurrencyGate,
      executionCoordinator
    });

    const createTaskService = new CreateTaskService({
      taskRepository: repository,
      taskEventStore,
      clock,
      idGenerator
    });
    const queueTaskService = new QueueTaskService({
      taskRepository: repository,
      taskEventStore,
      agentRuntimeRegistry,
      clock,
      idGenerator
    });

    try {
      const createdTask = await createTaskService.execute({
        title: "Run fake task",
        description: "Exercise execution coordinator",
        workflowId: DEFAULT_WORKFLOW_ID
      });

      await queueTaskService.execute(createdTask.id);
      await scheduler.kick();

      const completedTask = await waitForTaskState(
        repository,
        createdTask.id,
        "completed"
      );

      expect(completedTask.toSnapshot().attempts.at(-1)).toMatchObject({
        status: "completed",
        currentStepKey: null,
        terminationReason: null
      });
      expect(
        completedTask
          .toSnapshot()
          .attempts.at(-1)
          ?.steps.map((step) => step.status)
      ).toEqual(["completed", "completed", "completed"]);
    } finally {
      storage.close();
      await wait(50);
    }
  });

  it("marks protocol_failure when exit 0 does not produce a valid result artifact", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const storage = WorkspaceStorage.open(workspaceRoot);
    const repository = new SqliteTaskRepository(storage.database);
    const taskEventStore = new SqliteTaskEventStore(storage.database);
    const eventBus = new LocalEventBus();
    const clock = new FixedClock();
    const idGenerator = new IncrementingIdGenerator();
    const wrapperScriptPath = join(workspaceRoot, "wrapper-like-script.mjs");

    writeWrapperLikeScript(wrapperScriptPath);

    const agentRuntimeRegistry = createRuntimeRegistry(
      wrapperScriptPath,
      "protocol-missing"
    );
    const concurrencyGate = new ConcurrencyGate(2);
    let scheduler: TaskScheduler;
    const executionCoordinator = new ExecutionCoordinator({
      workspaceRoot,
      taskRepository: repository,
      taskEventStore,
      agentRuntimeRegistry,
      childProcessRunner: new NodeChildProcessRunner(),
      taskLogFileStore: new TaskLogFileStore(storage.paths),
      attemptResultFileStore: new AttemptResultFileStore(storage.paths),
      attemptAbortSignalStore: new AttemptAbortSignalStore(storage.paths),
      eventBus,
      clock,
      idGenerator,
      concurrencyGate,
      onSettled: async () => scheduler.kick()
    });
    scheduler = new TaskScheduler({
      taskRepository: repository,
      concurrencyGate,
      executionCoordinator
    });

    const createTaskService = new CreateTaskService({
      taskRepository: repository,
      taskEventStore,
      clock,
      idGenerator
    });
    const queueTaskService = new QueueTaskService({
      taskRepository: repository,
      taskEventStore,
      agentRuntimeRegistry,
      clock,
      idGenerator
    });

    try {
      const createdTask = await createTaskService.execute({
        title: "Run partial marker task",
        description: "Exercise protocol failure settle",
        workflowId: DEFAULT_WORKFLOW_ID
      });

      await queueTaskService.execute(createdTask.id);
      await scheduler.kick();

      const failedTask = await waitForTaskState(repository, createdTask.id, "failed");

      expect(failedTask.toSnapshot().attempts.at(-1)).toMatchObject({
        status: "failed",
        currentStepKey: "plan",
        terminationReason: "protocol_failure"
      });
      expect(
        new TaskLogFileStore(storage.paths).read(
          createdTask.id,
          failedTask.currentAttemptId!
        )
      ).toContain("planning only");
    } finally {
      storage.close();
      await wait(50);
    }
  });

  it("marks needs_input as a first-class failed attempt reason", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const storage = WorkspaceStorage.open(workspaceRoot);
    const repository = new SqliteTaskRepository(storage.database);
    const taskEventStore = new SqliteTaskEventStore(storage.database);
    const eventBus = new LocalEventBus();
    const clock = new FixedClock();
    const idGenerator = new IncrementingIdGenerator();
    const wrapperScriptPath = join(workspaceRoot, "wrapper-like-script.mjs");

    writeWrapperLikeScript(wrapperScriptPath);

    const agentRuntimeRegistry = createRuntimeRegistry(wrapperScriptPath, "needs-input");
    const concurrencyGate = new ConcurrencyGate(2);
    let scheduler: TaskScheduler;
    const executionCoordinator = new ExecutionCoordinator({
      workspaceRoot,
      taskRepository: repository,
      taskEventStore,
      agentRuntimeRegistry,
      childProcessRunner: new NodeChildProcessRunner(),
      taskLogFileStore: new TaskLogFileStore(storage.paths),
      attemptResultFileStore: new AttemptResultFileStore(storage.paths),
      attemptAbortSignalStore: new AttemptAbortSignalStore(storage.paths),
      eventBus,
      clock,
      idGenerator,
      concurrencyGate,
      onSettled: async () => scheduler.kick()
    });
    scheduler = new TaskScheduler({
      taskRepository: repository,
      concurrencyGate,
      executionCoordinator
    });

    const createTaskService = new CreateTaskService({
      taskRepository: repository,
      taskEventStore,
      clock,
      idGenerator
    });
    const queueTaskService = new QueueTaskService({
      taskRepository: repository,
      taskEventStore,
      agentRuntimeRegistry,
      clock,
      idGenerator
    });

    try {
      const createdTask = await createTaskService.execute({
        title: "Prompt asks for more input",
        description: "Exercise needs_input settle",
        workflowId: DEFAULT_WORKFLOW_ID
      });

      await queueTaskService.execute(createdTask.id);
      await scheduler.kick();

      const failedTask = await waitForTaskState(repository, createdTask.id, "failed");

      expect(failedTask.toSnapshot().attempts.at(-1)).toMatchObject({
        status: "failed",
        terminationReason: "needs_input"
      });
    } finally {
      storage.close();
      await wait(50);
    }
  });

  it("completes the task when a step prints a valid result but does not exit cleanly on its own", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const storage = WorkspaceStorage.open(workspaceRoot);
    const repository = new SqliteTaskRepository(storage.database);
    const taskEventStore = new SqliteTaskEventStore(storage.database);
    const eventBus = new LocalEventBus();
    const clock = new FixedClock();
    const idGenerator = new IncrementingIdGenerator();
    const wrapperScriptPath = join(workspaceRoot, "wrapper-like-script.mjs");

    writeWrapperLikeScript(wrapperScriptPath);

    const agentRuntimeRegistry = createRuntimeRegistry(
      wrapperScriptPath,
      "success-no-newline-hangs"
    );
    const concurrencyGate = new ConcurrencyGate(2);
    let scheduler: TaskScheduler;
    const executionCoordinator = new ExecutionCoordinator({
      workspaceRoot,
      taskRepository: repository,
      taskEventStore,
      agentRuntimeRegistry,
      childProcessRunner: new NodeChildProcessRunner(),
      taskLogFileStore: new TaskLogFileStore(storage.paths),
      attemptResultFileStore: new AttemptResultFileStore(storage.paths),
      attemptAbortSignalStore: new AttemptAbortSignalStore(storage.paths),
      eventBus,
      clock,
      idGenerator,
      concurrencyGate,
      onSettled: async () => scheduler.kick()
    });
    scheduler = new TaskScheduler({
      taskRepository: repository,
      concurrencyGate,
      executionCoordinator
    });

    const createTaskService = new CreateTaskService({
      taskRepository: repository,
      taskEventStore,
      clock,
      idGenerator
    });
    const queueTaskService = new QueueTaskService({
      taskRepository: repository,
      taskEventStore,
      agentRuntimeRegistry,
      clock,
      idGenerator
    });

    try {
      const createdTask = await createTaskService.execute({
        title: "Result line without graceful exit",
        description: "Exercise wrapper finalization path",
        workflowId: DEFAULT_WORKFLOW_ID
      });

      await queueTaskService.execute(createdTask.id);
      await scheduler.kick();

      const completedTask = await waitForTaskState(
        repository,
        createdTask.id,
        "completed"
      );

      expect(completedTask.toSnapshot().attempts.at(-1)).toMatchObject({
        status: "completed",
        currentStepKey: null,
        terminationReason: null
      });
    } finally {
      storage.close();
      await wait(50);
    }
  });

  it("marks manually_aborted only after the wrapper exits with abort confirmation", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const storage = WorkspaceStorage.open(workspaceRoot);
    const repository = new SqliteTaskRepository(storage.database);
    const taskEventStore = new SqliteTaskEventStore(storage.database);
    const eventBus = new LocalEventBus();
    const clock = new FixedClock();
    const idGenerator = new IncrementingIdGenerator();
    const wrapperScriptPath = join(workspaceRoot, "wrapper-like-script.mjs");

    writeWrapperLikeScript(wrapperScriptPath);

    const agentRuntimeRegistry = new LocalAgentRuntimeRegistry([
      {
        kind: "codex-cli",
        createLaunchSpec(_task, context) {
          return createAgentAttemptWrapperLaunchSpec(
            {
              command: process.execPath,
              args: [wrapperScriptPath, "abortable"]
            },
            context
          );
        }
      },
      {
        kind: "claude-code",
        createLaunchSpec(_task, context) {
          return createAgentAttemptWrapperLaunchSpec(
            {
              command: process.execPath,
              args: [wrapperScriptPath, "abortable"]
            },
            context
          );
        }
      }
    ]);
    const concurrencyGate = new ConcurrencyGate(2);
    let scheduler: TaskScheduler;
    const executionCoordinator = new ExecutionCoordinator({
      workspaceRoot,
      taskRepository: repository,
      taskEventStore,
      agentRuntimeRegistry,
      childProcessRunner: new NodeChildProcessRunner(),
      taskLogFileStore: new TaskLogFileStore(storage.paths),
      attemptResultFileStore: new AttemptResultFileStore(storage.paths),
      attemptAbortSignalStore: new AttemptAbortSignalStore(storage.paths),
      eventBus,
      clock,
      idGenerator,
      concurrencyGate,
      onSettled: async () => scheduler.kick()
    });
    scheduler = new TaskScheduler({
      taskRepository: repository,
      concurrencyGate,
      executionCoordinator
    });

    const createTaskService = new CreateTaskService({
      taskRepository: repository,
      taskEventStore,
      clock,
      idGenerator
    });
    const queueTaskService = new QueueTaskService({
      taskRepository: repository,
      taskEventStore,
      agentRuntimeRegistry,
      clock,
      idGenerator
    });

    try {
      const createdTask = await createTaskService.execute({
        title: "Abort wrapper task",
        description: "Exercise strong abort settle",
        workflowId: DEFAULT_WORKFLOW_ID
      });

      await queueTaskService.execute(createdTask.id);
      await scheduler.kick();
      await waitForTaskState(repository, createdTask.id, "executing");
      await wait(250);

      const abortedTask = await executionCoordinator.abortTask(createdTask.id);

      expect(abortedTask.state).toBe("failed");
      expect(abortedTask.attempts.at(-1)).toMatchObject({
        status: "failed",
        terminationReason: "manually_aborted"
      });
    } finally {
      storage.close();
      await wait(50);
    }
  });
});
