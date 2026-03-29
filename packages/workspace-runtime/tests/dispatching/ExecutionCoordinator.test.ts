import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CreateTaskService,
  QueueTaskService,
  type Clock,
  type IdGenerator
} from "@tasks-dispatcher/core";
import { LocalAgentRuntimeRegistry } from "../../src/agents/LocalAgentRuntimeRegistry.js";
import { NodeChildProcessRunner } from "../../src/agents/NodeChildProcessRunner.js";
import { ConcurrencyGate } from "../../src/dispatching/ConcurrencyGate.js";
import { ExecutionCoordinator } from "../../src/dispatching/ExecutionCoordinator.js";
import { TaskScheduler } from "../../src/dispatching/TaskScheduler.js";
import { LocalEventBus } from "../../src/events/LocalEventBus.js";
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

describe("ExecutionCoordinator", () => {
  it("runs a queued task through to pending_validation and records log output", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const storage = WorkspaceStorage.open(workspaceRoot);
    const repository = new SqliteTaskRepository(storage.database);
    const taskEventStore = new SqliteTaskEventStore(storage.database);
    const eventBus = new LocalEventBus();
    const clock = new FixedClock();
    const idGenerator = new IncrementingIdGenerator();
    const successScriptPath = join(workspaceRoot, "success-script.mjs");

    writeFileSync(
      successScriptPath,
      [
        "console.log('TASKS_DISPATCHER_STAGE:plan');",
        "console.log('planning');",
        "console.log('TASKS_DISPATCHER_STAGE:develop');",
        "console.log('developing');",
        "console.log('TASKS_DISPATCHER_STAGE:self_check');",
        "console.log('checking');"
      ].join("\n"),
      "utf8"
    );

    const agentRuntimeRegistry = new LocalAgentRuntimeRegistry([
      {
        kind: "codex-cli",
        createLaunchSpec() {
          return {
            command: process.execPath,
            args: [successScriptPath]
          };
        }
      },
      {
        kind: "claude-code",
        createLaunchSpec() {
          return {
            command: process.execPath,
            args: [successScriptPath]
          };
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
      agentRuntimeRegistry,
      clock,
      idGenerator
    });
    const queueTaskService = new QueueTaskService({
      taskRepository: repository,
      taskEventStore,
      clock,
      idGenerator
    });

    try {
      const createdTask = await createTaskService.execute({
        title: "Run fake task",
        description: "Exercise execution coordinator",
        agent: "codex-cli"
      });

      await queueTaskService.execute(createdTask.id);
      await scheduler.kick();

      const completedTask = await waitForTaskState(
        repository,
        createdTask.id,
        "pending_validation"
      );

      expect(completedTask.toSnapshot().attempts.at(-1)).toMatchObject({
        status: "completed",
        stage: "self_check"
      });
      expect(
        new TaskLogFileStore(storage.paths).read(
          createdTask.id,
          completedTask.currentAttemptId!
        )
      ).toContain("developing");
    } finally {
      storage.close();
      await wait(50);
    }
  });

  it("settles to pending_validation even when the agent only emits plan and complete markers", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const storage = WorkspaceStorage.open(workspaceRoot);
    const repository = new SqliteTaskRepository(storage.database);
    const taskEventStore = new SqliteTaskEventStore(storage.database);
    const eventBus = new LocalEventBus();
    const clock = new FixedClock();
    const idGenerator = new IncrementingIdGenerator();
    const partialMarkerScriptPath = join(workspaceRoot, "partial-marker-script.mjs");

    writeFileSync(
      partialMarkerScriptPath,
      [
        "console.log('TASKS_DISPATCHER_STAGE:plan');",
        "console.log('planning only');",
        "console.log('TASKS_DISPATCHER_STAGE:complete');"
      ].join("\n"),
      "utf8"
    );

    const agentRuntimeRegistry = new LocalAgentRuntimeRegistry([
      {
        kind: "codex-cli",
        createLaunchSpec() {
          return {
            command: process.execPath,
            args: [partialMarkerScriptPath]
          };
        }
      },
      {
        kind: "claude-code",
        createLaunchSpec() {
          return {
            command: process.execPath,
            args: [partialMarkerScriptPath]
          };
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
      agentRuntimeRegistry,
      clock,
      idGenerator
    });
    const queueTaskService = new QueueTaskService({
      taskRepository: repository,
      taskEventStore,
      clock,
      idGenerator
    });

    try {
      const createdTask = await createTaskService.execute({
        title: "Run partial marker task",
        description: "Exercise completion marker fallback",
        agent: "codex-cli"
      });

      await queueTaskService.execute(createdTask.id);
      await scheduler.kick();

      const completedTask = await waitForTaskState(
        repository,
        createdTask.id,
        "pending_validation"
      );

      expect(completedTask.toSnapshot().attempts.at(-1)).toMatchObject({
        status: "completed",
        stage: "self_check"
      });
      expect(
        new TaskLogFileStore(storage.paths).read(
          createdTask.id,
          completedTask.currentAttemptId!
        )
      ).toContain("planning only");
    } finally {
      storage.close();
      await wait(50);
    }
  });
});
