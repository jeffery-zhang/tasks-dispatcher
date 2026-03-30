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
      "import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';",
      "import { dirname } from 'node:path';",
      "const [mode, finalPath, tempPath, taskId, attemptId] = process.argv.slice(2);",
      "const writeResult = () => {",
      "  mkdirSync(dirname(finalPath), { recursive: true });",
      "  rmSync(finalPath, { force: true });",
      "  writeFileSync(tempPath, JSON.stringify({ schemaVersion: 1, status: 'completed', taskId, attemptId, finishedAt: new Date().toISOString() }), 'utf8');",
      "  renameSync(tempPath, finalPath);",
      "};",
      "if (mode === 'success') {",
      "  console.log('TASKS_DISPATCHER_STAGE:plan');",
      "  console.log('planning');",
      "  console.log('TASKS_DISPATCHER_STAGE:develop');",
      "  console.log('developing');",
      "  console.log('TASKS_DISPATCHER_STAGE:self_check');",
      "  console.log('checking');",
      "  writeResult();",
      "  process.exit(0);",
      "} else if (mode === 'protocol-missing') {",
      "  console.log('TASKS_DISPATCHER_STAGE:plan');",
      "  console.log('planning only');",
      "  process.exit(0);",
      "} else if (mode === 'abortable') {",
      "  console.log('TASKS_DISPATCHER_STAGE:plan');",
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
        return {
          command: process.execPath,
          args: [
            scriptPath,
            mode,
            context.resultPaths.finalPath,
            context.resultPaths.tempPath,
            context.taskId,
            context.attemptId
          ]
        };
      }
    },
    {
      kind: "claude-code",
      createLaunchSpec(_task, context) {
        return {
          command: process.execPath,
          args: [
            scriptPath,
            mode,
            context.resultPaths.finalPath,
            context.resultPaths.tempPath,
            context.taskId,
            context.attemptId
          ]
        };
      }
    }
  ]);
}

describe("ExecutionCoordinator", () => {
  it("marks queued tasks pending_validation only when exit 0 includes a valid result artifact", async () => {
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
        stage: "self_check",
        terminationReason: null
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
        description: "Exercise protocol failure settle",
        agent: "codex-cli"
      });

      await queueTaskService.execute(createdTask.id);
      await scheduler.kick();

      const failedTask = await waitForTaskState(
        repository,
        createdTask.id,
        "execution_failed"
      );

      expect(failedTask.toSnapshot().attempts.at(-1)).toMatchObject({
        status: "failed",
        stage: "plan",
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
              args: [wrapperScriptPath, "abortable", "", "", context.taskId, context.attemptId]
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
              args: [wrapperScriptPath, "abortable", "", "", context.taskId, context.attemptId]
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
        title: "Abort wrapper task",
        description: "Exercise strong abort settle",
        agent: "codex-cli"
      });

      await queueTaskService.execute(createdTask.id);
      await scheduler.kick();
      await waitForTaskState(repository, createdTask.id, "executing");
      await wait(250);

      const abortedTask = await executionCoordinator.abortTask(createdTask.id);

      expect(abortedTask.state).toBe("execution_failed");
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
