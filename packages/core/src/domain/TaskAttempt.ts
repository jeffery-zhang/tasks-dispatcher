import type { AgentKind } from "./AgentKind.js";
import type { ExecutionStage } from "./ExecutionStage.js";

export const ATTEMPT_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed"
] as const;

export type TaskAttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const ATTEMPT_TERMINATION_REASONS = [
  "process_exit_non_zero",
  "signal_terminated",
  "startup_failed",
  "manually_aborted"
] as const;

export type TaskAttemptTerminationReason =
  (typeof ATTEMPT_TERMINATION_REASONS)[number];

export interface TaskAttemptSnapshot {
  id: string;
  taskId: string;
  agent: AgentKind;
  status: TaskAttemptStatus;
  stage: ExecutionStage;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  terminationReason: TaskAttemptTerminationReason | null;
}

interface CreateQueuedTaskAttemptInput {
  id: string;
  taskId: string;
  agent: AgentKind;
  createdAt: Date;
}

export class TaskAttempt {
  readonly #id: string;
  readonly #taskId: string;
  readonly #agent: AgentKind;
  #status: TaskAttemptStatus;
  #stage: ExecutionStage;
  readonly #createdAt: Date;
  #startedAt: Date | null;
  #finishedAt: Date | null;
  #terminationReason: TaskAttemptTerminationReason | null;

  private constructor(props: {
    id: string;
    taskId: string;
    agent: AgentKind;
    status: TaskAttemptStatus;
    stage: ExecutionStage;
    createdAt: Date;
    startedAt?: Date | null;
    finishedAt?: Date | null;
    terminationReason?: TaskAttemptTerminationReason | null;
  }) {
    this.#id = props.id;
    this.#taskId = props.taskId;
    this.#agent = props.agent;
    this.#status = props.status;
    this.#stage = props.stage;
    this.#createdAt = props.createdAt;
    this.#startedAt = props.startedAt ?? null;
    this.#finishedAt = props.finishedAt ?? null;
    this.#terminationReason = props.terminationReason ?? null;
  }

  static createQueued(input: CreateQueuedTaskAttemptInput): TaskAttempt {
    return new TaskAttempt({
      ...input,
      status: "queued",
      stage: "plan"
    });
  }

  static rehydrate(snapshot: TaskAttemptSnapshot): TaskAttempt {
    return new TaskAttempt({
      id: snapshot.id,
      taskId: snapshot.taskId,
      agent: snapshot.agent,
      status: snapshot.status,
      stage: snapshot.stage,
      createdAt: new Date(snapshot.createdAt),
      startedAt: snapshot.startedAt ? new Date(snapshot.startedAt) : null,
      finishedAt: snapshot.finishedAt ? new Date(snapshot.finishedAt) : null,
      terminationReason: snapshot.terminationReason
    });
  }

  get id(): string {
    return this.#id;
  }

  start(startedAt: Date): void {
    if (this.#status !== "queued") {
      throw new Error(`Attempt "${this.#id}" cannot start from ${this.#status}.`);
    }

    this.#status = "running";
    this.#startedAt = startedAt;
    this.#finishedAt = null;
    this.#terminationReason = null;
  }

  moveToStage(stage: ExecutionStage): void {
    if (this.#status !== "running") {
      throw new Error(
        `Attempt "${this.#id}" cannot change stage from ${this.#status}.`
      );
    }

    this.#stage = stage;
  }

  markCompleted(finishedAt: Date): void {
    if (this.#status !== "running") {
      throw new Error(
        `Attempt "${this.#id}" cannot complete from ${this.#status}.`
      );
    }

    this.#status = "completed";
    this.#finishedAt = finishedAt;
    this.#terminationReason = null;
  }

  markFailed(
    terminationReason: TaskAttemptTerminationReason,
    finishedAt: Date
  ): void {
    if (this.#status !== "running") {
      throw new Error(`Attempt "${this.#id}" cannot fail from ${this.#status}.`);
    }

    this.#status = "failed";
    this.#finishedAt = finishedAt;
    this.#terminationReason = terminationReason;
  }

  toSnapshot(): TaskAttemptSnapshot {
    return {
      id: this.#id,
      taskId: this.#taskId,
      agent: this.#agent,
      status: this.#status,
      stage: this.#stage,
      createdAt: this.#createdAt.toISOString(),
      startedAt: this.#startedAt?.toISOString() ?? null,
      finishedAt: this.#finishedAt?.toISOString() ?? null,
      terminationReason: this.#terminationReason
    };
  }
}
