import type { ExecutionStage } from "./ExecutionStage.js";
import {
  TaskAttemptStep,
  type TaskAttemptStepSnapshot
} from "./TaskAttemptStep.js";
import type { WorkflowStepDefinition } from "./TaskWorkflow.js";

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
  "protocol_failure",
  "manually_aborted",
  "needs_input"
] as const;

export type TaskAttemptTerminationReason =
  (typeof ATTEMPT_TERMINATION_REASONS)[number];

export interface TaskAttemptSnapshot {
  id: string;
  taskId: string;
  status: TaskAttemptStatus;
  workflowId: string;
  workflowLabel: string;
  currentStepKey: ExecutionStage | null;
  steps: TaskAttemptStepSnapshot[];
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  terminationReason: TaskAttemptTerminationReason | null;
}

interface CreateQueuedTaskAttemptInput {
  id: string;
  taskId: string;
  workflowId: string;
  workflowLabel: string;
  steps: WorkflowStepDefinition[];
  createdAt: Date;
}

export class TaskAttempt {
  readonly #id: string;
  readonly #taskId: string;
  readonly #workflowId: string;
  readonly #workflowLabel: string;
  #status: TaskAttemptStatus;
  #currentStepKey: ExecutionStage | null;
  readonly #steps: TaskAttemptStep[];
  readonly #createdAt: Date;
  #startedAt: Date | null;
  #finishedAt: Date | null;
  #terminationReason: TaskAttemptTerminationReason | null;

  private constructor(props: {
    id: string;
    taskId: string;
    workflowId: string;
    workflowLabel: string;
    status: TaskAttemptStatus;
    currentStepKey?: ExecutionStage | null;
    steps: TaskAttemptStep[];
    createdAt: Date;
    startedAt?: Date | null;
    finishedAt?: Date | null;
    terminationReason?: TaskAttemptTerminationReason | null;
  }) {
    this.#id = props.id;
    this.#taskId = props.taskId;
    this.#workflowId = props.workflowId;
    this.#workflowLabel = props.workflowLabel;
    this.#status = props.status;
    this.#currentStepKey = props.currentStepKey ?? null;
    this.#steps = props.steps;
    this.#createdAt = props.createdAt;
    this.#startedAt = props.startedAt ?? null;
    this.#finishedAt = props.finishedAt ?? null;
    this.#terminationReason = props.terminationReason ?? null;
  }

  static createQueued(input: CreateQueuedTaskAttemptInput): TaskAttempt {
    return new TaskAttempt({
      ...input,
      steps: input.steps.map((step) => TaskAttemptStep.fromDefinition(step)),
      status: "queued"
    });
  }

  static rehydrate(snapshot: TaskAttemptSnapshot): TaskAttempt {
    return new TaskAttempt({
      id: snapshot.id,
      taskId: snapshot.taskId,
      workflowId: snapshot.workflowId,
      workflowLabel: snapshot.workflowLabel,
      status: snapshot.status,
      currentStepKey: snapshot.currentStepKey,
      steps: snapshot.steps.map((step) => TaskAttemptStep.rehydrate(step)),
      createdAt: new Date(snapshot.createdAt),
      startedAt: snapshot.startedAt ? new Date(snapshot.startedAt) : null,
      finishedAt: snapshot.finishedAt ? new Date(snapshot.finishedAt) : null,
      terminationReason: snapshot.terminationReason
    });
  }

  get id(): string {
    return this.#id;
  }

  get currentStepKey(): ExecutionStage | null {
    return this.#currentStepKey;
  }

  start(startedAt: Date): void {
    if (this.#status !== "queued") {
      throw new Error(`Attempt "${this.#id}" cannot start from ${this.#status}.`);
    }

    const firstStep = this.#steps.find((step) => step.status === "pending");

    if (!firstStep) {
      throw new Error(`Attempt "${this.#id}" has no steps to execute.`);
    }

    this.#status = "running";
    this.#startedAt = startedAt;
    this.#finishedAt = null;
    this.#terminationReason = null;
    firstStep.start(startedAt);
    this.#currentStepKey = firstStep.key;
  }

  startStep(stepKey: ExecutionStage, startedAt: Date): void {
    if (this.#status !== "running") {
      throw new Error(
        `Attempt "${this.#id}" cannot start a step from ${this.#status}.`
      );
    }

    const step = this.#steps.find((candidate) => candidate.key === stepKey);

    if (!step) {
      throw new Error(`Attempt "${this.#id}" has no step "${stepKey}".`);
    }

    step.start(startedAt);
    this.#currentStepKey = stepKey;
  }

  completeStep(stepKey: ExecutionStage, finishedAt: Date): void {
    const step = this.#steps.find((candidate) => candidate.key === stepKey);

    if (!step) {
      throw new Error(`Attempt "${this.#id}" has no step "${stepKey}".`);
    }

    step.markCompleted(finishedAt);
    this.#currentStepKey =
      this.#steps.find((candidate) => candidate.status === "pending")?.key ?? null;
  }

  markCompleted(finishedAt: Date): void {
    if (this.#status !== "running") {
      throw new Error(
        `Attempt "${this.#id}" cannot complete from ${this.#status}.`
      );
    }

    this.#status = "completed";
    this.#currentStepKey = null;
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

    const runningStep = this.#currentStepKey
      ? this.#steps.find((step) => step.key === this.#currentStepKey)
      : null;

    if (runningStep && runningStep.status === "running") {
      runningStep.markFailed(terminationReason, finishedAt);
    }

    this.#status = "failed";
    this.#finishedAt = finishedAt;
    this.#terminationReason = terminationReason;
  }

  toSnapshot(): TaskAttemptSnapshot {
    return {
      id: this.#id,
      taskId: this.#taskId,
      status: this.#status,
      workflowId: this.#workflowId,
      workflowLabel: this.#workflowLabel,
      currentStepKey: this.#currentStepKey,
      steps: this.#steps.map((step) => step.toSnapshot()),
      createdAt: this.#createdAt.toISOString(),
      startedAt: this.#startedAt?.toISOString() ?? null,
      finishedAt: this.#finishedAt?.toISOString() ?? null,
      terminationReason: this.#terminationReason
    };
  }
}
