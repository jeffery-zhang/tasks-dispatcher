import type { TaskAttemptTerminationReason } from "./TaskAttempt.js";
import type { WorkflowStepDefinition } from "./TaskWorkflow.js";
import type { WorkflowStepStatus } from "./WorkflowStepStatus.js";

export interface TaskAttemptStepSnapshot {
  key: WorkflowStepDefinition["key"];
  name: string;
  agent: WorkflowStepDefinition["agent"];
  prompt: string;
  status: WorkflowStepStatus;
  startedAt: string | null;
  finishedAt: string | null;
  failureReason: TaskAttemptTerminationReason | null;
}

export class TaskAttemptStep {
  readonly #key: WorkflowStepDefinition["key"];
  readonly #name: string;
  readonly #agent: WorkflowStepDefinition["agent"];
  readonly #prompt: string;
  #status: WorkflowStepStatus;
  #startedAt: Date | null;
  #finishedAt: Date | null;
  #failureReason: TaskAttemptTerminationReason | null;

  private constructor(props: {
    key: WorkflowStepDefinition["key"];
    name: string;
    agent: WorkflowStepDefinition["agent"];
    prompt: string;
    status: WorkflowStepStatus;
    startedAt?: Date | null;
    finishedAt?: Date | null;
    failureReason?: TaskAttemptTerminationReason | null;
  }) {
    this.#key = props.key;
    this.#name = props.name;
    this.#agent = props.agent;
    this.#prompt = props.prompt;
    this.#status = props.status;
    this.#startedAt = props.startedAt ?? null;
    this.#finishedAt = props.finishedAt ?? null;
    this.#failureReason = props.failureReason ?? null;
  }

  static fromDefinition(step: WorkflowStepDefinition): TaskAttemptStep {
    return new TaskAttemptStep({
      key: step.key,
      name: step.name,
      agent: step.agent,
      prompt: step.prompt,
      status: "pending"
    });
  }

  static rehydrate(snapshot: TaskAttemptStepSnapshot): TaskAttemptStep {
    return new TaskAttemptStep({
      key: snapshot.key,
      name: snapshot.name,
      agent: snapshot.agent,
      prompt: snapshot.prompt,
      status: snapshot.status,
      startedAt: snapshot.startedAt ? new Date(snapshot.startedAt) : null,
      finishedAt: snapshot.finishedAt ? new Date(snapshot.finishedAt) : null,
      failureReason: snapshot.failureReason
    });
  }

  get key(): WorkflowStepDefinition["key"] {
    return this.#key;
  }

  get status(): WorkflowStepStatus {
    return this.#status;
  }

  start(startedAt: Date): void {
    if (this.#status !== "pending") {
      throw new Error(`Step "${this.#key}" cannot start from ${this.#status}.`);
    }

    this.#status = "running";
    this.#startedAt = startedAt;
    this.#finishedAt = null;
    this.#failureReason = null;
  }

  markCompleted(finishedAt: Date): void {
    if (this.#status !== "running") {
      throw new Error(
        `Step "${this.#key}" cannot complete from ${this.#status}.`
      );
    }

    this.#status = "completed";
    this.#finishedAt = finishedAt;
    this.#failureReason = null;
  }

  markFailed(
    failureReason: TaskAttemptTerminationReason,
    finishedAt: Date
  ): void {
    if (this.#status !== "running") {
      throw new Error(`Step "${this.#key}" cannot fail from ${this.#status}.`);
    }

    this.#status = "failed";
    this.#finishedAt = finishedAt;
    this.#failureReason = failureReason;
  }

  toSnapshot(): TaskAttemptStepSnapshot {
    return {
      key: this.#key,
      name: this.#name,
      agent: this.#agent,
      prompt: this.#prompt,
      status: this.#status,
      startedAt: this.#startedAt?.toISOString() ?? null,
      finishedAt: this.#finishedAt?.toISOString() ?? null,
      failureReason: this.#failureReason
    };
  }
}
