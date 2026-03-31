import {
  TaskEvent,
  toTaskDetailDto,
  type Clock,
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
  supervisor: AgentProcessSupervisor | null;
  completion: Promise<TaskDetailDto>;
  resolveCompletion: (task: TaskDetailDto) => void;
  rejectCompletion: (error: unknown) => void;
  abortRequested: boolean;
  attemptId: string;
  abortConfirmed: boolean;
}

function getCurrentAttempt(task: TaskDetailDto) {
  const attempt = task.attempts.find((candidate) => candidate.id === task.currentAttemptId);

  if (!attempt) {
    throw new Error(`Task "${task.id}" has no current attempt DTO.`);
  }

  return attempt;
}

function getCurrentStep(task: TaskDetailDto) {
  const attempt = getCurrentAttempt(task);
  const step = attempt.steps.find((candidate) => candidate.key === attempt.currentStepKey);

  if (!step) {
    throw new Error(`Task "${task.id}" has no current step DTO.`);
  }

  return step;
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

    if (!task || task.state !== "ready") {
      return;
    }

    this.#concurrencyGate.acquire();

    let resolveCompletion: (task: TaskDetailDto) => void = () => {};
    let rejectCompletion: (error: unknown) => void = () => {};
    const completion = new Promise<TaskDetailDto>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });

    this.#activeExecutions.set(taskId, {
      supervisor: null,
      completion,
      resolveCompletion,
      rejectCompletion,
      abortRequested: false,
      attemptId: task.currentAttemptId ?? "",
      abortConfirmed: false
    });

    try {
      task.markExecuting(this.#clock.now());
      await this.#taskRepository.save(task);
      await this.#appendTaskEvent(taskId, "execution_started");
      await this.#emitTaskUpdate(taskId);
      await this.#launchCurrentStep(taskId);
    } catch (error) {
      this.#activeExecutions.delete(taskId);
      this.#concurrencyGate.release();
      rejectCompletion(error);
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

  async #launchCurrentStep(taskId: string): Promise<void> {
    const task = await this.#taskRepository.getById(taskId);
    const activeExecution = this.#activeExecutions.get(taskId);

    if (!task || task.state !== "executing" || !activeExecution) {
      return;
    }

    const detail = toTaskDetailDto(task);
    const currentStep = getCurrentStep(detail);
    const runtime = this.#agentRuntimeRegistry.get(currentStep.agent);
    const attemptId = task.currentAttemptId;

    if (!attemptId) {
      throw new Error(`Task "${taskId}" has no current attempt.`);
    }

    this.#attemptResultFileStore.clear(taskId, attemptId);
    this.#attemptAbortSignalStore.clear(taskId, attemptId);

    const childProcess = this.#childProcessRunner.start(
      runtime.createLaunchSpec(detail, {
        workspaceRoot: this.#workspaceRoot,
        taskId,
        attemptId,
        stepKey: currentStep.key,
        resultPaths: this.#attemptResultFileStore.getPaths(taskId, attemptId),
        abortSignalPath: this.#attemptAbortSignalStore.getPath(taskId, attemptId)
      }),
      this.#workspaceRoot
    );

    const supervisor = new AgentProcessSupervisor(childProcess);
    activeExecution.supervisor = supervisor;
    activeExecution.attemptId = attemptId;
    activeExecution.abortConfirmed = false;

    supervisor.onChunk((event) => {
      this.#taskLogFileStore.append(taskId, attemptId, event.chunk);
      this.#eventBus.emit({
        type: "task.log",
        taskId,
        attemptId,
        chunk: event.chunk
      });
    });

    supervisor.onAbortConfirmed(() => {
      const current = this.#activeExecutions.get(taskId);

      if (current) {
        current.abortConfirmed = true;
      }
    });

    supervisor.onExit((event) => {
      void this.#handleStepExit(taskId, event).catch((error) =>
        this.#failActiveExecution(taskId, error)
      );
    });

    supervisor.start();
  }

  async #handleStepExit(
    taskId: string,
    exitEvent: {
      code: number | null;
      signal: NodeJS.Signals | null;
      reason: "startup_failed" | null;
    }
  ): Promise<void> {
    const task = await this.#taskRepository.getById(taskId);
    const activeExecution = this.#activeExecutions.get(taskId);

    if (!task || !activeExecution) {
      return;
    }

    const currentAttemptId = task.currentAttemptId;

    if (!currentAttemptId) {
      throw new Error(`Task "${taskId}" has no current attempt.`);
    }

    const attemptResult = this.#attemptResultFileStore.read(taskId, currentAttemptId);
    const abortConfirmedFromLog = activeExecution.abortRequested
      ? this.#didWrapperConfirmAbort(taskId, currentAttemptId)
      : false;
    const abortConfirmed =
      activeExecution.abortRequested &&
      (activeExecution.abortConfirmed ||
        abortConfirmedFromLog ||
        exitEvent.code === WRAPPER_ABORT_EXIT_CODE);
    const now = this.#clock.now();

    if (abortConfirmed) {
      task.markExecutionFailed("manually_aborted", now);
      await this.#taskRepository.save(task);
      await this.#appendTaskEvent(taskId, "task_aborted");
      await this.#finalizeActiveExecution(taskId, toTaskDetailDto(task));
      return;
    }

    if (exitEvent.reason === "startup_failed") {
      task.markExecutionFailed("startup_failed", now);
      await this.#taskRepository.save(task);
      await this.#appendTaskEvent(taskId, "execution_failed");
      await this.#finalizeActiveExecution(taskId, toTaskDetailDto(task));
      return;
    }

    if (attemptResult?.status === "failed") {
      task.markExecutionFailed(attemptResult.failureReason ?? "protocol_failure", now);
      await this.#taskRepository.save(task);
      await this.#appendTaskEvent(taskId, "execution_failed");
      await this.#finalizeActiveExecution(taskId, toTaskDetailDto(task));
      return;
    }

    if (exitEvent.code === 0 && attemptResult?.status === "completed") {
      task.completeCurrentAttemptStep(attemptResult.stepKey, now);

      const nextDetail = toTaskDetailDto(task);
      const nextStepKey = nextDetail.currentStepKey;

      if (nextStepKey) {
        task.startCurrentAttemptStep(nextStepKey, now);
        await this.#taskRepository.save(task);
        await this.#appendTaskEvent(taskId, "execution_step_changed");
        await this.#emitTaskUpdate(taskId);
        await this.#launchCurrentStep(taskId);
        return;
      }

      task.markCompleted(now);
      await this.#taskRepository.save(task);
      await this.#appendTaskEvent(taskId, "task_completed");
      await this.#finalizeActiveExecution(taskId, toTaskDetailDto(task));
      return;
    }

    if (exitEvent.code === 0) {
      task.markExecutionFailed("protocol_failure", now);
    } else if (exitEvent.signal) {
      task.markExecutionFailed("signal_terminated", now);
    } else {
      task.markExecutionFailed("process_exit_non_zero", now);
    }

    await this.#taskRepository.save(task);
    await this.#appendTaskEvent(taskId, "execution_failed");
    await this.#finalizeActiveExecution(taskId, toTaskDetailDto(task));
  }

  async #finalizeActiveExecution(
    taskId: string,
    detail: TaskDetailDto
  ): Promise<void> {
    const activeExecution = this.#activeExecutions.get(taskId);

    this.#activeExecutions.delete(taskId);
    this.#attemptAbortSignalStore.clear(taskId, detail.currentAttemptId ?? "");
    this.#concurrencyGate.release();
    await this.#emitTaskUpdate(taskId);
    await this.#onSettled();
    activeExecution?.resolveCompletion(detail);
  }

  async #failActiveExecution(taskId: string, error: unknown): Promise<void> {
    const activeExecution = this.#activeExecutions.get(taskId);

    this.#activeExecutions.delete(taskId);

    if (activeExecution) {
      this.#attemptAbortSignalStore.clear(taskId, activeExecution.attemptId);
    }

    this.#concurrencyGate.release();
    await this.#onSettled();
    activeExecution?.rejectCompletion(error);
  }

  async #appendTaskEvent(
    taskId: string,
    type:
      | "execution_started"
      | "execution_step_changed"
      | "execution_failed"
      | "task_completed"
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
