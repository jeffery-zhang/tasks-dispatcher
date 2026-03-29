import {
  TaskEvent,
  TaskStateTransitionError,
  toTaskDetailDto,
  type Clock,
  type ExecutionStage,
  type IdGenerator,
  type TaskDetailDto,
  type TaskEventStore,
  type TaskRepository
} from "@tasks-dispatcher/core";
import { AgentProcessSupervisor } from "./AgentProcessSupervisor.js";
import { ConcurrencyGate } from "./ConcurrencyGate.js";
import { LocalAgentRuntimeRegistry } from "../agents/LocalAgentRuntimeRegistry.js";
import { NodeChildProcessRunner } from "../agents/NodeChildProcessRunner.js";
import { TaskLogFileStore } from "../persistence/TaskLogFileStore.js";
import { LocalEventBus } from "../events/LocalEventBus.js";

interface ActiveExecution {
  supervisor: AgentProcessSupervisor;
  completion: Promise<TaskDetailDto>;
}

export class ExecutionCoordinator {
  readonly #workspaceRoot: string;
  readonly #taskRepository: TaskRepository;
  readonly #taskEventStore: TaskEventStore;
  readonly #agentRuntimeRegistry: LocalAgentRuntimeRegistry;
  readonly #childProcessRunner: NodeChildProcessRunner;
  readonly #taskLogFileStore: TaskLogFileStore;
  readonly #eventBus: LocalEventBus;
  readonly #clock: Clock;
  readonly #idGenerator: IdGenerator;
  readonly #concurrencyGate: ConcurrencyGate;
  readonly #onSettled: () => Promise<void>;
  readonly #activeExecutions = new Map<string, ActiveExecution>();

  constructor(deps: {
    workspaceRoot: string;
    taskRepository: TaskRepository;
    taskEventStore: TaskEventStore;
    agentRuntimeRegistry: LocalAgentRuntimeRegistry;
    childProcessRunner: NodeChildProcessRunner;
    taskLogFileStore: TaskLogFileStore;
    eventBus: LocalEventBus;
    clock: Clock;
    idGenerator: IdGenerator;
    concurrencyGate: ConcurrencyGate;
    onSettled: () => Promise<void>;
  }) {
    this.#workspaceRoot = deps.workspaceRoot;
    this.#taskRepository = deps.taskRepository;
    this.#taskEventStore = deps.taskEventStore;
    this.#agentRuntimeRegistry = deps.agentRuntimeRegistry;
    this.#childProcessRunner = deps.childProcessRunner;
    this.#taskLogFileStore = deps.taskLogFileStore;
    this.#eventBus = deps.eventBus;
    this.#clock = deps.clock;
    this.#idGenerator = deps.idGenerator;
    this.#concurrencyGate = deps.concurrencyGate;
    this.#onSettled = deps.onSettled;
  }

  get hasActiveExecutions(): boolean {
    return this.#activeExecutions.size > 0;
  }

  get activeExecutionCount(): number {
    return this.#activeExecutions.size;
  }

  async startTask(taskId: string): Promise<void> {
    if (this.#activeExecutions.has(taskId)) {
      return;
    }

    const task = await this.#taskRepository.getById(taskId);

    if (!task || task.state !== "pending_execution") {
      return;
    }

    this.#concurrencyGate.acquire();

    try {
      task.markExecuting(this.#clock.now());
      await this.#taskRepository.save(task);
      await this.#appendTaskEvent(taskId, "execution_started");
      await this.#emitTaskUpdate(taskId);

      const detail = toTaskDetailDto(task);
      const runtime = this.#agentRuntimeRegistry.get(detail.agent);
      const childProcess = this.#childProcessRunner.start(
        runtime.createLaunchSpec(detail),
        this.#workspaceRoot
      );
      const supervisor = new AgentProcessSupervisor(childProcess);
      let stageUpdateQueue = Promise.resolve();

      let resolveCompletion: (task: TaskDetailDto) => void = () => {};
      const completion = new Promise<TaskDetailDto>((resolve) => {
        resolveCompletion = resolve;
      });

      supervisor.onChunk((event) => {
        const attemptId = task.currentAttemptId;

        if (!attemptId) {
          return;
        }

        this.#taskLogFileStore.append(taskId, attemptId, event.chunk);
        this.#eventBus.emit({
          type: "task.log",
          taskId,
          attemptId,
          chunk: event.chunk
        });
      });

      supervisor.onStage((event) => {
        stageUpdateQueue = stageUpdateQueue.then(() =>
          this.#advanceStage(taskId, event.stage)
        );
      });

      supervisor.onCompletionDeclared(() => {
        stageUpdateQueue = stageUpdateQueue.then(() =>
          this.#advanceStage(taskId, "self_check")
        );
      });

      supervisor.onExit((event) => {
        void stageUpdateQueue
          .then(() => this.#settleTask(taskId, event.reason))
          .then(resolveCompletion);
      });

      supervisor.start();
      this.#activeExecutions.set(taskId, { supervisor, completion });
    } catch (error) {
      this.#concurrencyGate.release();
      throw error;
    }
  }

  async abortTask(taskId: string): Promise<TaskDetailDto> {
    const activeExecution = this.#activeExecutions.get(taskId);

    if (!activeExecution) {
      const task = await this.#taskRepository.getById(taskId);

      if (!task) {
        throw new Error(`Task "${taskId}" was not found.`);
      }

      task.abortCurrentAttempt(this.#clock.now());
      await this.#taskRepository.save(task);
      await this.#appendTaskEvent(taskId, "task_aborted");
      await this.#emitTaskUpdate(taskId);

      return toTaskDetailDto(task);
    }

    activeExecution.supervisor.abort();
    return activeExecution.completion;
  }

  async #advanceStage(
    taskId: string,
    stage: ExecutionStage
  ): Promise<void> {
    const task = await this.#taskRepository.getById(taskId);

    if (!task || task.state !== "executing") {
      return;
    }

    try {
      task.moveCurrentAttemptToStage(stage, this.#clock.now());
      await this.#taskRepository.save(task);
      await this.#appendTaskEvent(taskId, "execution_stage_changed");
      await this.#emitTaskUpdate(taskId);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      if (!(error instanceof TaskStateTransitionError)) {
        throw error;
      }
    }
  }

  async #settleTask(
    taskId: string,
    reason:
      | "completed"
      | "process_exit_non_zero"
      | "signal_terminated"
      | "startup_failed"
      | "manually_aborted"
  ): Promise<TaskDetailDto> {
    try {
      const task = await this.#taskRepository.getById(taskId);

      if (!task) {
        throw new Error(`Task "${taskId}" was not found.`);
      }

      if (reason === "completed") {
        task.markAwaitingValidation(this.#clock.now());
        await this.#taskRepository.save(task);
        await this.#appendTaskEvent(taskId, "validation_requested");
      } else {
        task.markExecutionFailed(reason, this.#clock.now());
        await this.#taskRepository.save(task);
        await this.#appendTaskEvent(
          taskId,
          reason === "manually_aborted" ? "task_aborted" : "execution_failed"
        );
      }

      const detail = toTaskDetailDto(task);

      this.#activeExecutions.delete(taskId);
      this.#concurrencyGate.release();
      await this.#emitTaskUpdate(taskId);
      await this.#onSettled();

      return detail;
    } catch (error) {
      this.#activeExecutions.delete(taskId);
      this.#concurrencyGate.release();
      await this.#onSettled();
      throw error;
    }
  }

  async #appendTaskEvent(
    taskId: string,
    type:
      | "execution_started"
      | "execution_stage_changed"
      | "execution_failed"
      | "validation_requested"
      | "task_aborted"
  ): Promise<void> {
    await this.#taskEventStore.append(
      new TaskEvent({
        id: this.#idGenerator.next("event"),
        taskId,
        type,
        occurredAt: this.#clock.now()
      })
    );
  }

  async #emitTaskUpdate(taskId: string): Promise<void> {
    const task = await this.#taskRepository.getById(taskId);

    if (!task) {
      return;
    }

    this.#eventBus.emit({
      type: "task.updated",
      taskId,
      task: toTaskDetailDto(task)
    });
  }
}
