import type { ExecutionStage } from "./ExecutionStage.js";
import type {
  TaskAttemptSnapshot,
  TaskAttemptTerminationReason
} from "./TaskAttempt.js";
import { TaskAttempt } from "./TaskAttempt.js";
import type { TaskState } from "./TaskState.js";
import { TaskStateMachine } from "./TaskStateMachine.js";
import { getTaskWorkflowDefinition } from "./TaskWorkflow.js";

export interface TaskSnapshot {
  id: string;
  title: string;
  description: string;
  workflowId: string;
  workflowLabel: string;
  state: TaskState;
  createdAt: string;
  updatedAt: string;
  currentAttemptId: string | null;
  attempts: TaskAttemptSnapshot[];
}

interface CreateDraftTaskInput {
  id: string;
  title: string;
  description: string;
  workflowId: string;
  createdAt: Date;
}

interface UpdateTaskDraftInput {
  title: string;
  description: string;
  workflowId: string;
  updatedAt: Date;
}

interface QueueTaskInput {
  attemptId: string;
  queuedAt: Date;
}

export class Task {
  readonly #id: string;
  #title: string;
  #description: string;
  #workflowId: string;
  #workflowLabel: string;
  #state: TaskState;
  readonly #createdAt: Date;
  #updatedAt: Date;
  #currentAttemptId: string | null;
  readonly #attempts: TaskAttempt[];

  private constructor(props: {
    id: string;
    title: string;
    description: string;
    workflowId: string;
    workflowLabel: string;
    state: TaskState;
    createdAt: Date;
    updatedAt: Date;
    currentAttemptId?: string | null;
    attempts?: TaskAttempt[];
  }) {
    this.#id = props.id;
    this.#title = props.title;
    this.#description = props.description;
    this.#workflowId = props.workflowId;
    this.#workflowLabel = props.workflowLabel;
    this.#state = props.state;
    this.#createdAt = props.createdAt;
    this.#updatedAt = props.updatedAt;
    this.#currentAttemptId = props.currentAttemptId ?? null;
    this.#attempts = props.attempts ?? [];
  }

  static createDraft(input: CreateDraftTaskInput): Task {
    const workflow = getTaskWorkflowDefinition(input.workflowId);

    return new Task({
      ...input,
      workflowId: workflow.id,
      workflowLabel: workflow.label,
      state: "draft",
      updatedAt: input.createdAt
    });
  }

  static rehydrate(snapshot: TaskSnapshot): Task {
    return new Task({
      id: snapshot.id,
      title: snapshot.title,
      description: snapshot.description,
      workflowId: snapshot.workflowId,
      workflowLabel: snapshot.workflowLabel,
      state: snapshot.state,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
      currentAttemptId: snapshot.currentAttemptId,
      attempts: snapshot.attempts.map((attempt) => TaskAttempt.rehydrate(attempt))
    });
  }

  get id(): string {
    return this.#id;
  }

  get state(): TaskState {
    return this.#state;
  }

  get workflowId(): string {
    return this.#workflowId;
  }

  get currentAttemptId(): string | null {
    return this.#currentAttemptId;
  }

  updateDraft(input: UpdateTaskDraftInput): void {
    TaskStateMachine.assertCanEdit(this.#state);

    const workflow = getTaskWorkflowDefinition(input.workflowId);
    this.#title = input.title;
    this.#description = input.description;
    this.#workflowId = workflow.id;
    this.#workflowLabel = workflow.label;
    this.#updatedAt = input.updatedAt;
  }

  queueForExecution(input: QueueTaskInput): void {
    TaskStateMachine.assertCanQueue(this.#state);

    const workflow = getTaskWorkflowDefinition(this.#workflowId);
    const attempt = TaskAttempt.createQueued({
      id: input.attemptId,
      taskId: this.#id,
      workflowId: workflow.id,
      workflowLabel: workflow.label,
      steps: workflow.steps,
      createdAt: input.queuedAt
    });

    this.#attempts.push(attempt);
    this.#state = "ready";
    this.#currentAttemptId = attempt.id;
    this.#updatedAt = input.queuedAt;
  }

  markExecuting(startedAt: Date): void {
    TaskStateMachine.assertCanMarkExecuting(this.#state);

    this.requireCurrentAttempt().start(startedAt);
    this.#state = "executing";
    this.#updatedAt = startedAt;
  }

  startCurrentAttemptStep(stepKey: ExecutionStage, updatedAt: Date): void {
    this.requireCurrentAttempt().startStep(stepKey, updatedAt);
    this.#updatedAt = updatedAt;
  }

  completeCurrentAttemptStep(stepKey: ExecutionStage, updatedAt: Date): void {
    this.requireCurrentAttempt().completeStep(stepKey, updatedAt);
    this.#updatedAt = updatedAt;
  }

  markCompleted(finishedAt: Date): void {
    TaskStateMachine.assertCanComplete(this.#state);

    this.requireCurrentAttempt().markCompleted(finishedAt);
    this.#state = "completed";
    this.#updatedAt = finishedAt;
  }

  markExecutionFailed(
    terminationReason: TaskAttemptTerminationReason,
    finishedAt: Date
  ): void {
    TaskStateMachine.assertCanFail(this.#state);

    this.requireCurrentAttempt().markFailed(terminationReason, finishedAt);
    this.#state = "failed";
    this.#updatedAt = finishedAt;
  }

  abortCurrentAttempt(abortedAt: Date): void {
    TaskStateMachine.assertCanAbort(this.#state);
    this.markExecutionFailed("manually_aborted", abortedAt);
  }

  reopen(reopenedAt: Date): void {
    TaskStateMachine.assertCanReopen(this.#state);

    this.#state = "draft";
    this.#updatedAt = reopenedAt;
  }

  archive(archivedAt: Date): void {
    TaskStateMachine.assertCanArchive(this.#state);

    this.#state = "archived";
    this.#updatedAt = archivedAt;
  }

  toSnapshot(): TaskSnapshot {
    return {
      id: this.#id,
      title: this.#title,
      description: this.#description,
      workflowId: this.#workflowId,
      workflowLabel: this.#workflowLabel,
      state: this.#state,
      createdAt: this.#createdAt.toISOString(),
      updatedAt: this.#updatedAt.toISOString(),
      currentAttemptId: this.#currentAttemptId,
      attempts: this.#attempts.map((attempt) => attempt.toSnapshot())
    };
  }

  private requireCurrentAttempt(): TaskAttempt {
    const attempt = this.#attempts.at(-1);

    if (!attempt || attempt.id !== this.#currentAttemptId) {
      throw new Error(`Task "${this.#id}" has no current attempt.`);
    }

    return attempt;
  }
}
