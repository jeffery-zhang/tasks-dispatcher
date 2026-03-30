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
import { WRAPPER_ABORT_EXIT_CODE } from "../agents/wrapper/AgentAttemptWrapperProtocol.js";
import { TaskLogFileStore } from "../persistence/TaskLogFileStore.js";
import { AttemptResultFileStore } from "../persistence/AttemptResultFileStore.js";
import { AttemptAbortSignalStore } from "../persistence/AttemptAbortSignalStore.js";
import { LocalEventBus } from "../events/LocalEventBus.js";

interface ActiveExecution {
  supervisor: AgentProcessSupervisor;
  completion: Promise<TaskDetailDto>;
  abortRequested: boolean;
  attemptId: string;
  abortConfirmed: boolean;
}

export class ExecutionCoordinator {
  readonly #workspaceRoot: string;
  readonly #taskRepository: TaskRepository;
  readonly #taskEventStore: TaskEventStore;
  readonly #agentRuntimeRegistry: LocalAgentRuntimeRegistry;
  readonly #childProcessRunner: NodeChildProcessRunner;
  readonly #taskLogFileStore: TaskLogFileStore;
  readonly #attemptResultFileStore: AttemptResultFileStore;
  readonly #attemptAbortSignalStore: AttemptAbortSignalStore;
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
    attemptResultFileStore: AttemptResultFileStore;
    attemptAbortSignalStore: AttemptAbortSignalStore;
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
    this.#attemptResultFileStore = deps.attemptResultFileStore;
    this.#attemptAbortSignalStore = deps.attemptAbortSignalStore;
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
      const attemptId = task.currentAttemptId;

      if (!attemptId) {
        throw new Error(`Task "${taskId}" has no current attempt.`);
      }

      const childProcess = this.#childProcessRunner.start(
        runtime.createLaunchSpec(detail, {
          workspaceRoot: this.#workspaceRoot,
          taskId,
          attemptId,
          resultPaths: this.#attemptResultFileStore.getPaths(taskId, attemptId),
          abortSignalPath: this.#attemptAbortSignalStore.getPath(taskId, attemptId)
        }),
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
        stageUpdateQueue = stageUpdateQueue
          .then(() => this.#advanceStage(taskId, event.stage))
          .catch(() => undefined);
      });

      supervisor.onCompletionDeclared(() => {
        stageUpdateQueue = stageUpdateQueue
          .then(() => this.#advanceStage(taskId, "self_check"))
          .catch(() => undefined);
      });
      supervisor.onAbortConfirmed(() => {
        const activeExecution = this.#activeExecutions.get(taskId);

        if (activeExecution) {
          activeExecution.abortConfirmed = true;
        }
      });
      supervisor.onExit((event) => {
        void stageUpdateQueue
          .catch(() => undefined)
          .then(() => this.#settleTask(taskId, event))
          .then(resolveCompletion);
      });

      supervisor.start();
      this.#attemptAbortSignalStore.clear(taskId, attemptId);
      this.#activeExecutions.set(taskId, {
        supervisor,
        completion,
        abortRequested: false,
        attemptId,
        abortConfirmed: false
      });
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

      if (task.state !== "executing") {
        return toTaskDetailDto(task);
      }

      throw new Error(
        `Task "${taskId}" is executing but has no active runtime process.`
      );
    }

    activeExecution.abortRequested = true;
    this.#attemptAbortSignalStore.requestAbort(taskId, activeExecution.attemptId);
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
    exitEvent: {
      code: number | null;
      signal: NodeJS.Signals | null;
      reason: "startup_failed" | null;
    }
  ): Promise<TaskDetailDto> {
    try {
      const task = await this.#taskRepository.getById(taskId);

      if (!task) {
        throw new Error(`Task "${taskId}" was not found.`);
      }

      const activeExecution = this.#activeExecutions.get(taskId);
      const currentAttemptId = task.currentAttemptId;

      if (!currentAttemptId) {
        throw new Error(`Task "${taskId}" has no current attempt.`);
      }

      const abortConfirmedFromLog = activeExecution?.abortRequested
        ? this.#didWrapperConfirmAbort(taskId, currentAttemptId)
        : false;
      const abortConfirmed =
        activeExecution?.abortRequested === true &&
        (activeExecution.abortConfirmed === true ||
          abortConfirmedFromLog ||
          exitEvent.code === WRAPPER_ABORT_EXIT_CODE);
      const attemptResult = this.#attemptResultFileStore.read(taskId, currentAttemptId);

      if (abortConfirmed) {
        task.markExecutionFailed("manually_aborted", this.#clock.now());
        await this.#taskRepository.save(task);
        await this.#appendTaskEvent(taskId, "task_aborted");
      } else if (exitEvent.reason === "startup_failed") {
        task.markExecutionFailed("startup_failed", this.#clock.now());
        await this.#taskRepository.save(task);
        await this.#appendTaskEvent(taskId, "execution_failed");
      } else if (exitEvent.code === 0 && attemptResult) {
        task.markAwaitingValidation(this.#clock.now());
        await this.#taskRepository.save(task);
        await this.#appendTaskEvent(taskId, "validation_requested");
      } else if (exitEvent.code === 0) {
        task.markExecutionFailed("protocol_failure", this.#clock.now());
        await this.#taskRepository.save(task);
        await this.#appendTaskEvent(taskId, "execution_failed");
      } else if (exitEvent.signal) {
        task.markExecutionFailed("signal_terminated", this.#clock.now());
        await this.#taskRepository.save(task);
        await this.#appendTaskEvent(taskId, "execution_failed");
      } else {
        task.markExecutionFailed("process_exit_non_zero", this.#clock.now());
        await this.#taskRepository.save(task);
        await this.#appendTaskEvent(taskId, "execution_failed");
      }

      const detail = toTaskDetailDto(task);

      this.#activeExecutions.delete(taskId);
      this.#attemptAbortSignalStore.clear(taskId, currentAttemptId);
      this.#concurrencyGate.release();
      await this.#emitTaskUpdate(taskId);
      await this.#onSettled();

      return detail;
    } catch (error) {
      const activeExecution = this.#activeExecutions.get(taskId);

      this.#activeExecutions.delete(taskId);
      if (activeExecution) {
        this.#attemptAbortSignalStore.clear(taskId, activeExecution.attemptId);
      }
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

  #didWrapperConfirmAbort(taskId: string, attemptId: string): boolean {
    try {
      return this.#taskLogFileStore
        .read(taskId, attemptId)
        .includes("TASKS_DISPATCHER_ABORT_CONFIRMED");
    } catch {
      return false;
    }
  }
}
