import type { AgentKind } from "./AgentKind.js";
import type { ExecutionStage } from "./ExecutionStage.js";
import type {
  TaskAttemptSnapshot,
  TaskAttemptTerminationReason
} from "./TaskAttempt.js";
import { TaskAttempt } from "./TaskAttempt.js";
import type { TaskState } from "./TaskState.js";
import { TaskStateMachine } from "./TaskStateMachine.js";
import { DEFAULT_WORKFLOW_ID, DEFAULT_WORKFLOW_LABEL } from "./TaskWorkflow.js";

export interface TaskSnapshot {
  id: string;
  title: string;
  description: string;
  agent: AgentKind;
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
  agent: AgentKind;
  createdAt: Date;
}

interface UpdateTaskDraftInput {
  title: string;
  description: string;
  agent: AgentKind;
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
  #agent: AgentKind;
  readonly #workflowId: string;
  readonly #workflowLabel: string;
  #state: TaskState;
  readonly #createdAt: Date;
  #updatedAt: Date;
  #currentAttemptId: string | null;
  readonly #attempts: TaskAttempt[];

  private constructor(props: {
    id: string;
    title: string;
    description: string;
    agent: AgentKind;
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
    this.#agent = props.agent;
    this.#workflowId = props.workflowId;
    this.#workflowLabel = props.workflowLabel;
    this.#state = props.state;
    this.#createdAt = props.createdAt;
    this.#updatedAt = props.updatedAt;
    this.#currentAttemptId = props.currentAttemptId ?? null;
    this.#attempts = props.attempts ?? [];
  }

  static createDraft(input: CreateDraftTaskInput): Task {
    return new Task({
      ...input,
      workflowId: DEFAULT_WORKFLOW_ID,
      workflowLabel: DEFAULT_WORKFLOW_LABEL,
      state: "initializing",
      updatedAt: input.createdAt
    });
  }

  static rehydrate(snapshot: TaskSnapshot): Task {
    return new Task({
      id: snapshot.id,
      title: snapshot.title,
      description: snapshot.description,
      agent: snapshot.agent,
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

  get currentAttemptId(): string | null {
    return this.#currentAttemptId;
  }

  updateDraft(input: UpdateTaskDraftInput): void {
    TaskStateMachine.assertCanEdit(this.#state);

    this.#title = input.title;
    this.#description = input.description;
    this.#agent = input.agent;
    this.#updatedAt = input.updatedAt;
  }

  queueForExecution(input: QueueTaskInput): void {
    TaskStateMachine.assertCanQueue(this.#state);

    const attempt = TaskAttempt.createQueued({
      id: input.attemptId,
      taskId: this.#id,
      agent: this.#agent,
      createdAt: input.queuedAt
    });

    this.#attempts.push(attempt);
    this.#state = "pending_execution";
    this.#currentAttemptId = attempt.id;
    this.#updatedAt = input.queuedAt;
  }

  markExecuting(startedAt: Date): void {
    TaskStateMachine.assertCanMarkExecuting(this.#state);

    this.requireCurrentAttempt().start(startedAt);
    this.#state = "executing";
    this.#updatedAt = startedAt;
  }

  moveCurrentAttemptToStage(stage: ExecutionStage, updatedAt: Date): void {
    this.requireCurrentAttempt().moveToStage(stage);
    this.#updatedAt = updatedAt;
  }

  markAwaitingValidation(finishedAt: Date): void {
    TaskStateMachine.assertCanAwaitValidation(this.#state);

    this.requireCurrentAttempt().markCompleted(finishedAt);
    this.#state = "pending_validation";
    this.#updatedAt = finishedAt;
  }

  markExecutionFailed(
    terminationReason: TaskAttemptTerminationReason,
    finishedAt: Date
  ): void {
    TaskStateMachine.assertCanFail(this.#state);

    this.requireCurrentAttempt().markFailed(terminationReason, finishedAt);
    this.#state = "execution_failed";
    this.#updatedAt = finishedAt;
  }

  abortCurrentAttempt(abortedAt: Date): void {
    TaskStateMachine.assertCanAbort(this.#state);
    this.markExecutionFailed("manually_aborted", abortedAt);
  }

  reopen(reopenedAt: Date): void {
    TaskStateMachine.assertCanReopen(this.#state);

    this.#state = "reopened";
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
      agent: this.#agent,
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
